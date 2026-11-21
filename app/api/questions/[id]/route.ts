import {schedulePushDelivery} from "../../../../src/features/push/wakeup";
import { questionActor, questionId, boundedJson, sameOrigin, json, questionError, ReplyInput, MessageCursor } from "../../../../src/features/questions/http";
import { questionDetail, replyQuestion, readQuestion } from "../../../../src/features/questions/service";
import { z } from "zod";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context) {
  try {const actor=await questionActor(),id=await questionId(context),before=new URL(request.url).searchParams.get('before');
    if(before&&!MessageCursor.safeParse(before).success)return json({code:'INVALID_INPUT'},400);
    return json(await questionDetail(actor,id,before??undefined));
  }catch(e){return questionError(e);}
}
export async function POST(request:Request,context:Context) {
  try {sameOrigin(request);const actor=await questionActor(),id=await questionId(context),input=ReplyInput.safeParse(await boundedJson(request));
    if(!input.success)return json({code:'INVALID_INPUT'},400);
    await replyQuestion(actor,id,input.data.content);schedulePushDelivery();return json({status:'ok'},201);
  }catch(e){return questionError(e);}
}
export async function PATCH(request:Request,context:Context) {
  try {sameOrigin(request);const actor=await questionActor(),id=await questionId(context),input=z.object({through:MessageCursor}).strict().safeParse(await boundedJson(request));
    if(!input.success)return json({code:'INVALID_INPUT'},400);
    await readQuestion(actor,id,input.data.through);return json({status:'ok'});
  }catch(e){return questionError(e);}
}
