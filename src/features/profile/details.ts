import {z} from "zod";
import {eq,sql} from "drizzle-orm";
import {getDb} from "../../db/client";
import {memberRoster,users} from "../../db/schema";
import {DomainError} from "../../lib/http";
import {encryptRosterPhone} from "../roster/crypto";
import {phoneLookupHash} from "../auth/crypto";
export const ProfileDetailsSchema=z.object({
 birthDate:z.iso.date().nullable(),
 phone:z.string().trim().transform(v=>v.replace(/[\s()-]/g,"")).pipe(z.string().regex(/^\d{9,11}$/)),
 phonePrivate:z.boolean(),
}).strict().refine(v=>v.birthDate===null||(v.birthDate>="1900-01-01"&&v.birthDate<=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul"}).format(new Date())),{message:"INVALID_BIRTH_DATE"});
export async function updateProfileDetails(userId:string,input:z.infer<typeof ProfileDetailsSchema>){
 const db=getDb();
 const hash=phoneLookupHash(input.phone),ciphertext=encryptRosterPhone(input.phone);
 try{await db.transaction(async tx=>{
  const [user]=await tx.select({rosterId:users.rosterId}).from(users).where(eq(users.id,userId)).for("update");
  if(!user?.rosterId)throw new DomainError("ROSTER_NOT_LINKED",409);
  const [roster]=await tx.select({active:memberRoster.isActive,password:memberRoster.passwordHash}).from(memberRoster).where(eq(memberRoster.id,user.rosterId)).for("update");
  if(!roster?.active||!roster.password)throw new DomainError("PASSWORD_SETUP_REQUIRED",409);
  await tx.update(memberRoster).set({birthDate:input.birthDate,phonePrivate:input.phonePrivate,phoneLookupHash:hash,phoneCiphertext:ciphertext,updatedAt:new Date()}).where(eq(memberRoster.id,user.rosterId));
  await tx.update(users).set({phoneLookupHash:hash,updatedAt:new Date()}).where(eq(users.id,userId));
  // Password and remembered PIN devices are independent of the updated contact number.
  await tx.execute(sql`select 1`);
 });}catch(error){
  if(error instanceof DomainError)throw error;
  const cause=error as {code?:string;cause?:{code?:string}};
  if(cause.code==="23505"||cause.cause?.code==="23505")throw new DomainError("PHONE_CONFLICT",409);
  throw new DomainError("PROFILE_SAVE_UNAVAILABLE",503);
 }
}
