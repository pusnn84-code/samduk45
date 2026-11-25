import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { BIBLE_READING_PLAN, getBibleReadingDay, readingCycle } from "../../content/bible-reading-plan";
import { getDb } from "../../db/client";
import { bibleReadingEntries, users } from "../../db/schema";
import { DomainError } from "../../lib/http";
import type { BibleReadingState, BibleReadingUpdate } from "./types";

type ReadingDatabase = Pick<ReturnType<typeof getDb>, "select">;

const scheduleDates = BIBLE_READING_PLAN.map(day => day.date);

function validateDate(date: string) {
  if (!getBibleReadingDay(date)) throw new DomainError("INVALID_READING_DATE", 400);
}

async function readState(db: ReadingDatabase, userId: string, date: string): Promise<BibleReadingState> {
  const cycleDates=readingCycle(date).map(day=>day.date);
  const entries = await db.select({
    userId: bibleReadingEntries.userId,
    name: users.displayName,
    completed: bibleReadingEntries.completed,
    sharing: bibleReadingEntries.sharing,
    sharingId: bibleReadingEntries.sharingId,
    empathyCount: sql<number>`(select count(*) from prayer_app.bible_sharing_empathy e join prayer_app.users reactor on reactor.id=e.user_id and reactor.is_active where e.sharing_id=${bibleReadingEntries.sharingId})`,
    hasEmpathized: sql<boolean>`exists(select 1 from prayer_app.bible_sharing_empathy e where e.sharing_id=${bibleReadingEntries.sharingId} and e.user_id=${userId}::uuid)`,
    sharingAnonymous: bibleReadingEntries.sharingAnonymous,
    anonymousNumber: bibleReadingEntries.anonymousNumber,
    observedAt: sql<string>`to_char(statement_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
  })
    .from(bibleReadingEntries)
    .innerJoin(users, eq(bibleReadingEntries.userId, users.id))
    .where(and(eq(bibleReadingEntries.readingDate, date), eq(users.isActive, true)))
    .orderBy(asc(users.displayName), asc(users.id));

  const [progress] = await db.select({ completedDays: count() })
    .from(bibleReadingEntries)
    .where(and(
      eq(bibleReadingEntries.userId, userId),
      eq(bibleReadingEntries.completed, true),
      inArray(bibleReadingEntries.readingDate, cycleDates),
    ));

  const own = entries.find(entry => entry.userId === userId);
  return {
    date,
    observedAt: entries[0]?.observedAt,
    completed: own?.completed ?? false,
    completedPeople: entries.filter(entry => entry.completed).map(entry => ({ name: entry.name })),
    progress: { completedDays: progress.completedDays, totalDays: cycleDates.length },
    sharing: own?.sharing ?? null,
    sharingAnonymous: own?.sharingAnonymous ?? false,
    sharedLines: entries.flatMap(entry => entry.sharing === null ? [] : [
      { id: entry.sharingId, name: entry.sharingAnonymous ? `무명${entry.anonymousNumber ?? ""}` : entry.name, text: entry.sharing, isOwn: entry.userId === userId, empathyCount: Number(entry.empathyCount ?? 0), hasEmpathized: entry.hasEmpathized === true },
    ]),
  };
}

export async function getBibleReadingState(userId: string, date = scheduleDates[0]): Promise<BibleReadingState> {
  validateDate(date);
  return readState(getDb(), userId, date);
}

export async function updateBibleReadingState(userId: string, update: BibleReadingUpdate): Promise<BibleReadingState> {
  validateDate(update.date);
  const changes = {
    ...(update.completed !== undefined ? { completed: update.completed } : {}),
    ...(update.sharing !== undefined ? { sharing: update.sharing } : {}),
    ...(update.sharingAnonymous !== undefined ? { sharingAnonymous: update.sharingAnonymous } : {}),
  };

  return getDb().transaction(async tx => {
    let anonymousNumber: number | undefined;
    if (update.sharingAnonymous && update.sharing) {
      // Date-scoped serialization prevents two simultaneous shares receiving the same alias.
      await tx.execute(sql`select pg_advisory_xact_lock(560046,hashtext(${update.date}))`);
      const [existing] = await tx.select({ number: bibleReadingEntries.anonymousNumber }).from(bibleReadingEntries)
        .where(and(eq(bibleReadingEntries.userId, userId), eq(bibleReadingEntries.readingDate, update.date)));
      if (existing?.number != null) anonymousNumber = existing.number;
      else {
        const [allocation] = await tx.select({ next: sql<number>`greatest(coalesce(max(${bibleReadingEntries.anonymousNumber}),0),coalesce((select max(anonymous_number) from prayer_app.bible_reading_shares where reading_date=${update.date}::date),0))+1` }).from(bibleReadingEntries).where(eq(bibleReadingEntries.readingDate, update.date));
        anonymousNumber = Number(allocation.next);
      }
    }
    const savedChanges = { ...changes, ...(anonymousNumber !== undefined ? { anonymousNumber } : {}) };
    // Only update fields supplied by this request. A concurrent check and
    // sharing edit must not overwrite each other.
    await tx.insert(bibleReadingEntries)
      .values({ userId, readingDate: update.date, ...savedChanges })
      .onConflictDoUpdate({
        target: [bibleReadingEntries.userId, bibleReadingEntries.readingDate],
        set: savedChanges,
      });
    return readState(tx, userId, update.date);
  });
}
