import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SessionUser } from "../../src/features/auth/session";
import { DomainError } from "../../src/lib/http";

vi.mock("server-only", () => ({}));
vi.mock("../../src/features/auth/http-session", () => ({ getCurrentSessionUser: vi.fn() }));
vi.mock("../../src/features/google-calendar/repository", () => ({
  getGoogleCalendarConnection: vi.fn(), deleteGoogleCalendarConnection: vi.fn(),
  saveGoogleCalendarConnection: vi.fn(), selectGoogleCalendar: vi.fn(),
}));
vi.mock("../../src/features/google-calendar/client", () => ({
  createGoogleOAuthClient: vi.fn(), listConnectedCalendars: vi.fn(), getAuthorizedGoogleCalendarContext: vi.fn(),
}));

import { getCurrentSessionUser } from "../../src/features/auth/http-session";
import { getGoogleCalendarConnection, deleteGoogleCalendarConnection } from "../../src/features/google-calendar/repository";
import { createGoogleOAuthClient } from "../../src/features/google-calendar/client";
import { GET as connect } from "../../app/api/admin/google-calendar/connect/route";
import { GET as status } from "../../app/api/admin/google-calendar/status/route";
import { DELETE as disconnect } from "../../app/api/admin/google-calendar/connection/route";
import { GET as callback } from "../../app/api/admin/google-calendar/callback/route";
import { GET as calendars } from "../../app/api/admin/google-calendar/calendars/route";
import { POST as selection } from "../../app/api/admin/google-calendar/selection/route";

const request = () => new NextRequest("https://example.test/api/admin/google-calendar/connect");
const handlers = [
  ["connect", () => connect(request())], ["status", status], ["disconnect", () => disconnect(request())],
  ["callback", () => callback(request())], ["calendars", calendars],
  ["selection", () => selection(request())],
] as const;

beforeEach(() => vi.resetAllMocks());

describe.each([null, { id: "member", role: "member" } as SessionUser])("Calendar authorization for %j", (user) => {
  it.each(handlers)("%s returns the established JSON 403 before any Calendar access", async (_name, handler) => {
    vi.mocked(getCurrentSessionUser).mockResolvedValue(user);
    const response = await handler();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: "FORBIDDEN" });
    expect(getGoogleCalendarConnection).not.toHaveBeenCalled();
    expect(createGoogleOAuthClient).not.toHaveBeenCalled();
    expect(deleteGoogleCalendarConnection).not.toHaveBeenCalled();
  });
});

describe("Calendar administrator error handling", () => {
  beforeEach(() => vi.mocked(getCurrentSessionUser).mockResolvedValue({ id: "admin", role: "admin" } as SessionUser));

  it("status exposes connection metadata but never stored refresh tokens", async () => {
    vi.mocked(getGoogleCalendarConnection).mockResolvedValue({id:"connection",connectedByUserId:"admin",googleAccountEmail:"pastor@example.test",refreshTokenCiphertext:"private-token",selectedCalendarId:"primary",selectedCalendarName:"내 일정"});
    const response=await status();expect(response.status).toBe(200);const value=await response.json();expect(value.connected).toBe(true);expect(value.direction).toBe("app_to_google");expect(JSON.stringify(value)).not.toContain("private-token");
  });
  it("disconnect preserves DomainError status", async () => {
    vi.mocked(deleteGoogleCalendarConnection).mockRejectedValue(new DomainError("CALENDAR_UNAVAILABLE", 503));
    expect((await disconnect(request())).status).toBe(503);
  });
  it("does not report a failed local disconnect as success", async () => {
    vi.mocked(getGoogleCalendarConnection).mockResolvedValue(null);
    vi.mocked(deleteGoogleCalendarConnection).mockRejectedValue(new Error("database unavailable"));
    expect((await disconnect(request())).status).toBe(502);
  });

});
