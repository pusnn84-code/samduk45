import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { acknowledgeMenuActivity, activityObservationTime, getMenuActivityCounts } from "../../src/features/menu-activity/service";
const dialect = new PgDialect();
describe("account-scoped activity cursors", () => {
  it("counts only other members' published stories and unread sharing without exposing identity", async () => {
    const execute=vi.fn().mockResolvedValue({rows:[{community:2,reading:1,readingDates:["2026-11-12"]}]});
    expect(await getMenuActivityCounts("viewer",{execute})).toEqual({community:2,members:0,reading:1,readingDates:["2026-11-12"]});
    expect(execute).toHaveBeenCalledTimes(1);
    const query=dialect.sqlToQuery(execute.mock.calls[0][0]);
    expect(query.sql).toContain("e.sharing is not null");
    expect(query.sql).toContain("e.sharing_updated_at");
    expect(query.sql).toContain("bible_sharing_views");
    expect(query.sql).toContain("p.author_user_id is distinct from u.id");
    expect(query.sql).not.toMatch(/phone|ciphertext|password|family|source_name/);
  });
  it.each(["community", "members"] as const)("advances only the viewer's %s cursor monotonically, clamped to server time", async kind => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: "viewer" }] });
    const time = "2026-11-05T06:00:00.123456Z";
    await acknowledgeMenuActivity("viewer", kind, time, { execute });
    const query = dialect.sqlToQuery(execute.mock.calls[0][0]);
    expect(query.params).toEqual([time, "viewer"]);
    expect(query.sql).toContain(kind === "community" ? "community_menu_seen_at" : "directory_menu_seen_at");
    expect(query.sql).toContain("greatest("); expect(query.sql).toContain("least(");
    expect(query.sql).toContain("clock_timestamp()"); expect(query.sql).toContain("and is_active returning id");
  });
  it("rejects inactive or missing viewers", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await expect(getMenuActivityCounts("missing", { execute })).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
    await expect(acknowledgeMenuActivity("missing", "members", "2026-11-05T06:00:00Z", { execute })).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });
  it("preserves server timestamp precision for content acknowledgements", async () => {
    const time = "2026-11-05T06:00:00.123456Z";
    const execute = vi.fn().mockResolvedValue({ rows: [{ observedAt: time }] });
    expect(await activityObservationTime({ execute })).toBe(time);
  });
});


// Independent date cursors ensure reading today's sharing cannot mark another day read.
it("acknowledges only the selected reading date, monotonically and clamped",async()=>{
 const execute=vi.fn().mockResolvedValue({rows:[{user_id:"viewer"}]});
 await acknowledgeMenuActivity("viewer","reading","2026-11-12T01:00:00Z",{execute},"2026-11-11");
 const query=dialect.sqlToQuery(execute.mock.calls[0][0]);
 expect(query.sql).toContain("on conflict(user_id,reading_date)");
 expect(query.sql).toContain("greatest(");expect(query.sql).toContain("least(");
 expect(query.params).toContain("2026-11-11");
});
