import { z } from "zod";
import { DomainError } from "../../lib/http";
import { ReportError } from "../pastoral/policy";
export { prayerActor as questionActor, prayerId as questionId, boundedJson, sameOrigin, json } from "../prayer-requests/http";
import { json } from "../pastoral/http";
const text = (max: number) => z.string().trim().min(1).max(max).refine(v=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(v));
export const QuestionInput = z.object({title:text(100),content:text(5000)}).strict();
export const ReplyInput = z.object({content:text(5000)}).strict();
export const MessageCursor = z.string().regex(/^[1-9]\d{0,17}$/);
export function questionError(error: unknown) {
  if(error instanceof DomainError || error instanceof ReportError) return json({code:error.code},error.status);
  return json({code:"QUESTIONS_UNAVAILABLE"},503);
}
