import { z } from "zod";
import { prayerActor, prayerError, json } from "../../../../src/features/prayer-requests/http";
import { listCommunityPrayers } from "../../../../src/features/prayer-requests/community-list";
export async function GET(request:Request) {
  try {
    const actor=await prayerActor();
    const page=z.coerce.number().int().min(0).max(10000).safeParse(new URL(request.url).searchParams.get("page")??0);
    if(!page.success)return json({code:"INVALID_INPUT"},400);
    return json(await listCommunityPrayers(actor,page.data));
  } catch(error){return prayerError(error);}
}
