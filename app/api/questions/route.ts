import {schedulePushDelivery} from "../../../src/features/push/wakeup";
import { questionActor, boundedJson, sameOrigin, json, questionError, QuestionInput } from "../../../src/features/questions/http";
import { createQuestion, listQuestions } from "../../../src/features/questions/service";
import { z } from "zod";
export async function GET(request:Request) {
  try { const actor=await questionActor(); const page=z.coerce.number().int().min(0).max(10000).safeParse(new URL(request.url).searchParams.get('page')??0);
    if(!page.success)return json({code:'INVALID_INPUT'},400);
    return json(await listQuestions(actor,page.data));
  } catch(e){return questionError(e);}
}
export async function POST(request:Request) {
  try { sameOrigin(request); const actor=await questionActor(); const input=QuestionInput.safeParse(await boundedJson(request));
    if(!input.success)return json({code:'INVALID_INPUT'},400);
    const id=await createQuestion(actor,input.data.title,input.data.content);schedulePushDelivery();return json({id},201);
  } catch(e){return questionError(e);}
}
