import {
  bigint,
  bigserial,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
export const appSchema = pgSchema("prayer_app");
export const visitBookingSettings = appSchema.table("visit_booking_settings", {
  id: integer("id").primaryKey(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const roleEnum = appSchema.enum("prayer_role", ["member", "admin"]);

export const challenges = appSchema.table(
  "challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull().default("말씀 묵상 1달 도전"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    timezone: text("timezone").notNull().default("Asia/Seoul"),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("challenges_one_active_uq")
      .on(t.isActive)
      .where(sql`${t.isActive} = true`),
  ],
);

export const sams = appSchema.table(
  "sams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    leaderName: varchar("leader_name", { length: 100 }).notNull(),
    leaderRosterId: uuid("leader_roster_id").references(() => memberRoster.id, { onDelete: "set null" }),
    leaderBindingLocked: boolean("leader_binding_locked").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sams_name_uq").on(t.name)],
);

export const memberRoster = appSchema.table(
  "member_roster",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceName: varchar("source_name", { length: 120 }).notNull(),
    canonicalName: varchar("canonical_name", { length: 80 }).notNull(),
    position: varchar("position", { length: 80 }),
    directoryAge: integer("directory_age"),
    birthDate: date("birth_date"),
    isDeputyAdmin: boolean("is_deputy_admin").notNull().default(false),
    directoryGender: text("directory_gender"),
    directoryFamily: text("directory_family"),
    directoryGroupRole: text("directory_group_role"),
    phoneLookupHash: varchar("phone_lookup_hash", { length: 64 }),
    phoneCiphertext: text("phone_ciphertext"),
    passwordHash: text("password_hash"),
    village: varchar("village", { length: 80 }),
    sam: varchar("sam", { length: 80 }),
    samLabel: varchar("sam_label", { length: 100 }),
    isActive: boolean("is_active").notNull().default(true),
    isAdmin: boolean("is_admin").notNull().default(false),
    isNoticeOfficer: boolean("is_notice_officer").notNull().default(false),
    source: varchar("source", { length: 20 }).notNull(),
    sourceRow: integer("source_row"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("member_roster_name_phone_uq")
      .on(t.canonicalName, t.phoneLookupHash)
      .where(sql`${t.phoneLookupHash} is not null`),
    index("member_roster_name_idx").on(t.canonicalName),
    index("member_roster_sam_idx").on(t.samLabel),
  ],
);

export const users = appSchema.table(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 80 }).notNull(),
    phoneLookupHash: varchar("phone_lookup_hash", { length: 64 }).notNull(),
    phonePasswordHash: text("phone_password_hash").notNull(),
    firstLoginAt: timestamp("first_login_at", { withTimezone: true }),
    communityMenuSeenAt: timestamp("community_menu_seen_at", { withTimezone: true }).notNull().defaultNow(),
    directoryMenuSeenAt: timestamp("directory_menu_seen_at", { withTimezone: true }).notNull().defaultNow(),
    samId: uuid("sam_id").references(() => sams.id),
    rosterId: uuid("roster_id").references(() => memberRoster.id),
    role: roleEnum("role").notNull().default("member"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_name_phone_uq").on(t.normalizedName, t.phoneLookupHash),
    uniqueIndex("users_roster_uq").on(t.rosterId),
    index("users_sam_idx").on(t.samId),
  ],
);

export const prayerCheckins = appSchema.table(
  "prayer_checkins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prayerDate: date("prayer_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("checkin_user_date_uq").on(t.challengeId, t.userId, t.prayerDate),
    index("checkin_date_idx").on(t.challengeId, t.prayerDate),
    index("checkin_user_idx").on(t.userId),
  ],
);

export const bibleReadingEntries = appSchema.table("bible_reading_entries", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  readingDate: date("reading_date").notNull(),
  completed: boolean("completed").notNull().default(false),
  sharing: varchar("sharing", { length: 150 }),
  sharingId: uuid("sharing_id").notNull().defaultRandom(),
  sharingUpdatedAt: timestamp("sharing_updated_at", { withTimezone: true }),
  sharingAnonymous: boolean("sharing_anonymous").notNull().default(false),
  anonymousNumber: integer("anonymous_number"),
}, t => [
  primaryKey({ columns: [t.userId, t.readingDate] }),
  index("bible_reading_entries_date_idx").on(t.readingDate),
  uniqueIndex("bible_reading_sharing_id_uq").on(t.sharingId),
  uniqueIndex("bible_reading_anonymous_number_uq").on(t.readingDate, t.anonymousNumber).where(sql`${t.anonymousNumber} is not null`),
  check("bible_reading_anonymous_has_number", sql`not ${t.sharingAnonymous} or ${t.anonymousNumber} is not null`),
  check("bible_reading_entries_plan_year", sql`${t.readingDate} >= date '2026-01-01' and ${t.readingDate} < date '2028-01-01'`),
]);

export const bibleSharingViews = appSchema.table("bible_sharing_views", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  readingDate: date("reading_date").notNull(),
  viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull(),
}, t => [primaryKey({ columns: [t.userId, t.readingDate] })]);

export const bibleSharingEmpathy = appSchema.table("bible_sharing_empathy", {
  sharingId: uuid("sharing_id").notNull().references(() => bibleReadingEntries.sharingId, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.sharingId, t.userId] }), index("bible_sharing_empathy_user_idx").on(t.userId)]);

export const sessions = appSchema.table(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("sessions_token_uq").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
    index("sessions_expiry_idx").on(t.expiresAt),
  ],
);

export const authRateLimits = appSchema.table("auth_rate_limits", {
  keyHash: varchar("key_hash", { length: 64 }).primaryKey(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  failureCount: integer("failure_count").notNull().default(0),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
});


export const notices = appSchema.table(
  "notices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notices_status_published_idx").on(t.status, t.publishedAt),
  ],
);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const noticeImages = appSchema.table("notice_images", {
  noticeId: uuid("notice_id").primaryKey().references(() => notices.id, { onDelete: "cascade" }),
  version: uuid("version").defaultRandom().notNull(),
  data: bytea("data").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
});

export const noticeReads = appSchema.table(
  "notice_reads",
  {
    noticeId: uuid("notice_id")
      .notNull()
      .references(() => notices.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.noticeId, t.userId] }),
  ],
);

export const noticeConfirmations = appSchema.table("notice_confirmations", {
  noticeId: uuid("notice_id").notNull().references(() => notices.id, { onDelete: "cascade" }),
  rosterId: uuid("roster_id").notNull().references(() => memberRoster.id, { onDelete: "cascade" }),
  noticeRevision: varchar("notice_revision", { length: 32 }).notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedByUserId: uuid("confirmed_by_user_id").references(() => users.id, { onDelete: "set null" }),
}, t => [primaryKey({ columns: [t.noticeId, t.rosterId] })]);

export const pushSubscriptions = appSchema.table(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("push_subscriptions_endpoint_uq").on(t.endpoint),
    index("push_subscriptions_user_idx").on(t.userId),
  ],
);


export const prayerRequests = appSchema.table(
  "prayer_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    visibility: text("visibility").notNull().default("private"),
    status: varchar("status", { length: 20 }).notNull().default("received"),
    version: integer("version").notNull().default(1),
    completedByRequester: boolean("completed_by_requester").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    requesterReadSequence: bigint("requester_read_sequence", { mode: "number" }).notNull().default(0),
    adminReadSequence: bigint("admin_read_sequence", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("prayer_requests_status_created_idx").on(t.status, t.createdAt),
    index("prayer_requests_user_created_idx").on(t.userId, t.createdAt),
  ],
);


export const prayerRequestComments = appSchema.table(
  "prayer_request_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id").notNull().references(() => prayerRequests.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    authorRole: roleEnum("author_role").notNull(),
    content: text("content").notNull(),
    version: integer("version").notNull().default(1),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    clientId: uuid("client_id").notNull(),
    sequence: bigserial("sequence", { mode: "number" }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("prayer_request_comments_request_sequence_idx").on(t.requestId, t.sequence),
    uniqueIndex("prayer_request_comments_client_uq").on(t.requestId, t.authorUserId, t.clientId),
  ],
);

export const visitRequests = appSchema.table(
  "visit_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requesterUserId: uuid("requester_user_id")
      .notNull()
      .references(() => users.id),
    visitDate: date("visit_date").notNull(),
    endDate: date("end_date"),
    allDay: boolean("all_day").notNull().default(false),
    recipientLeaderName: varchar("recipient_leader_name", {length:100}),
    visitType: varchar("visit_type", { length: 20 }).notNull(),
    attendees: text("attendees").notNull(),
    recipientName: varchar("recipient_name", { length: 120 }),
    recipientSam: varchar("recipient_sam", { length: 100 }),
    isUnavailable: boolean("is_unavailable").notNull().default(false),
    location: text("location").notNull(),
    preferredTime: text("preferred_time").notNull(),
    reason: text("reason").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("requested"),
    calendarSyncStatus: varchar("calendar_sync_status", { length: 20 })
      .notNull()
      .default("pending"),
    googleEventId: text("google_event_id"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedByUserId: uuid("confirmed_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("visit_requests_active_date_idx")
      .on(t.visitDate)
      .where(sql`${t.status} <> 'cancelled'`),
    index("visit_requests_status_date_idx").on(t.status, t.visitDate),
  ],
);

export const ministrySchedules = appSchema.table("ministry_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
  title: varchar("title", { length: 120 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  eventEndDate: date("event_end_date"),
  allDay: boolean("all_day").notNull().default(false),
  time: varchar("time", { length: 5 }).notNull(),
  location: varchar("location", { length: 500 }).notNull().default(""),
  repeat: varchar("repeat", { length: 10 }).notNull().default("none"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("ministry_schedules_date_idx").on(t.startDate)]);

export const visitBlockedDates = appSchema.table("visit_blocked_dates", {
  visitDate: date("visit_date").primaryKey(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  reason: text("reason"),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const visitBlockedWeekdays = appSchema.table("visit_blocked_weekdays", {
  weekday: integer("weekday").primaryKey(),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const prayerParticipantExclusions = appSchema.table("prayer_participant_exclusions", {
  challengeId: uuid("challenge_id").notNull().references(() => challenges.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.challengeId, t.userId] }),
  index("prayer_participant_exclusions_user_idx").on(t.userId),
]);

export const googleCalendarConnections = appSchema.table(
  "google_calendar_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectedByUserId: uuid("connected_by_user_id")
      .notNull()
      .references(() => users.id),
    googleAccountEmail: text("google_account_email"),
    refreshTokenCiphertext: text("refresh_token_ciphertext").notNull(),
    selectedCalendarId: text("selected_calendar_id"),
    selectedCalendarName: text("selected_calendar_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    uniqueIndex("google_calendar_single_connection_uq").on(sql`true`),
  ],
);

export const autumnPeople=appSchema.table("autumn_people",{
 id:uuid("id").defaultRandom().primaryKey(),sourceKey:text("source_key").unique(),personName:varchar("person_name",{length:120}).notNull(),
 samId:uuid("sam_id").notNull().references(()=>sams.id),sourceAuthorName:varchar("source_author_name",{length:120}),
 createdByUserId:uuid("created_by_user_id").references(()=>users.id,{onDelete:"set null"}),submissionKey:uuid("submission_key"),prayer:text("prayer").notNull(),
 visited:boolean("visited").notNull().default(false),registered:boolean("registered").notNull().default(false),active:boolean("active").notNull().default(true),version:integer("version").notNull().default(1),
 updatedByUserId:uuid("updated_by_user_id").references(()=>users.id,{onDelete:"set null"}),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex("autumn_people_submission_uq").on(t.createdByUserId,t.submissionKey)]);
export const autumnDaily=appSchema.table("autumn_daily",{prayerDate:date("prayer_date").primaryKey(),personId:uuid("person_id").notNull().references(()=>autumnPeople.id),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()});
export const autumnPrayers=appSchema.table("autumn_prayers",{personId:uuid("person_id").notNull().references(()=>autumnPeople.id,{onDelete:"cascade"}),userId:uuid("user_id").notNull().references(()=>users.id,{onDelete:"cascade"}),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()},t=>[primaryKey({columns:[t.personId,t.userId]})]);
