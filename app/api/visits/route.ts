import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { DomainError } from "../../../src/lib/http";
import { VisitDetailsInput, submitInternalVisit, createInternalAppointment, listOwnVisits } from "../../../src/features/visits/internal-calendar";
import { scheduleEmailDelivery } from "../../../src/features/email/wakeup";
import { z } from "zod";
import { recipientForVisit } from "../../../src/features/visits/shared-calendar";
import { checkOrigin, readReportJson, ReportError } from "../../../src/features/pastoral/policy";
const Input = VisitDetailsInput.extend({ recipientRosterId: z.uuid().optional(), recipientName: z.string().trim().max(120).optional() });

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try { checkOrigin(request); body = await readReportJson(request); }
  catch (error) { if (error instanceof ReportError) return NextResponse.json({code:error.code},{status:error.status}); throw error; }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    const isAdmin = user.role === "admin";
    const recipient = await recipientForVisit(user, parsed.data);
    const { recipientRosterId: _roster, recipientName: _name, ...details } = parsed.data;
    const result = await (isAdmin ? createInternalAppointment : submitInternalVisit)(
      {
        requesterUserId: user.id,
        ...details, ...recipient,
      },
    );
    if (!isAdmin) scheduleEmailDelivery(request);
    return NextResponse.json({ status: "ok", ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    throw error;
  }
}

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ visits: await listOwnVisits(user.id) }, { headers: { "Cache-Control": "private, no-store" } });
}
