import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { calendarPeople } from "../../../../src/features/visits/shared-calendar";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({code:"FORBIDDEN"},{status:403});
  return NextResponse.json({ people: (await calendarPeople()).map(({id,name,sam,leaderName}) => ({id,name,sam,leaderName})) },
    {headers:{"Cache-Control":"private, no-store"}});
}
