import {describe,it,expect,vi,afterEach} from "vitest";
import {wrapPrayer} from "../../components/autumn-light/prayer-card-image";
import {autumnDestination,rememberAutumnDestination,takeLoginDestination} from "../../src/features/auth/prayer-return";
afterEach(()=>vi.unstubAllGlobals());
describe("prayer image text and authenticated share destination",()=>{
 it("wraps every character and preserves paragraphs without truncating",()=>{const ctx={measureText:(s:string)=>({width:Array.from(s).length*10})} as CanvasRenderingContext2D;expect(wrapPrayer(ctx,"하나님 사랑\n함께 기도",30)).toEqual(["하나님"," 사랑","함께 ","기도"]);});
 it("allows only an opaque prayer-card path and consumes it after login",()=>{const m=new Map<string,string>();vi.stubGlobal("sessionStorage",{getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>m.set(k,v),removeItem:(k:string)=>m.delete(k)});const id="00000000-0000-4000-8000-000000000001";expect(autumnDestination("https://evil.test")).toBeNull();const path=autumnDestination(id)!;rememberAutumnDestination(path);expect(takeLoginDestination()).toBe(path);expect(takeLoginDestination()).toBe("/");rememberAutumnDestination("//evil.test");expect(takeLoginDestination()).toBe("/");});
});
