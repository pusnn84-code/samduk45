import { questionActor, json, questionError } from "../../../../src/features/questions/http";
import { questionUnread } from "../../../../src/features/questions/service";
export async function GET() {try {return json({count:await questionUnread(await questionActor())});}catch(e){return questionError(e);}}
