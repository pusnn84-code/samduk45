import {z} from "zod";
import {DomainError} from "../../lib/http";
import type {AutumnActor} from "./types";
export const AutumnCreate=z.object({name:z.string().trim().min(1).max(120),samId:z.uuid(),prayer:z.string().trim().min(1).max(10000),submissionKey:z.uuid(),allowDuplicate:z.boolean().default(false)}).strict();
export const AutumnPatch=z.object({name:z.string().trim().min(1).max(120).optional(),samId:z.uuid().optional(),prayer:z.string().trim().min(1).max(10000).optional(),visited:z.boolean().optional(),registered:z.boolean().optional(),expectedVersion:z.number().int().min(1)}).strict().refine(v=>Object.keys(v).some(k=>k!=="expectedVersion"));
export const AutumnFilter=z.object({q:z.string().trim().max(120).default(""),village:z.coerce.number().int().min(1).max(5).optional(),samId:z.uuid().optional(),page:z.coerce.number().int().min(0).max(10000).default(0)}).strict();
export type AutumnCreateInput=z.infer<typeof AutumnCreate>;
export type AutumnPatchInput=z.infer<typeof AutumnPatch>;
export type AutumnListFilter=z.infer<typeof AutumnFilter>;
export function assertAutumnEdit(actor:AutumnActor,creatorId:string|null,patch:AutumnPatchInput){
 if(actor.role!=="admin"&&(creatorId!==actor.id||"visited" in patch||"registered" in patch))throw new DomainError("FORBIDDEN",403);
}
export function autumnStatusLabels(card:{visited:boolean;registered:boolean}){
 return [...(card.visited?["초청일 방문"]:[]),...(card.registered?["교회 등록"]:[])];
}

export const AutumnCommentInput=z.object({body:z.string().trim().min(1).max(10000),submissionKey:z.uuid()}).strict();
