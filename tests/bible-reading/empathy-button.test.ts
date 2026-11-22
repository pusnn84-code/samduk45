import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SharingEmpathyButton } from "../../components/bible-reading/SharingEmpathyButton";
vi.stubGlobal("React",React);
const line={id:"opaque-line",name:"무명1",text:"가상 나눔",isOwn:false,empathyCount:3,hasEmpathized:false};
describe("compact sharing empathy control",()=>{
 it("renders the anonymous display name, count and an unpressed outline heart",()=>{
  const html=renderToStaticMarkup(React.createElement(SharingEmpathyButton,{line,disabled:false,busy:false,onClick:()=>{}}));
  expect(html).toContain('aria-pressed="false"');expect(html).toContain('fill="none"');expect(html).toContain("무명1님의 묵상 나눔 공감 3개");expect(html).toContain(">3</span>");
 });
 it("fills the selected heart and prevents repeated clicks while saving",()=>{
  const html=renderToStaticMarkup(React.createElement(SharingEmpathyButton,{line:{...line,empathyCount:4,hasEmpathized:true},disabled:true,busy:true,onClick:()=>{}}));
  expect(html).toContain('aria-pressed="true"');expect(html).toContain('aria-busy="true"');expect(html).toContain('disabled=""');expect(html).toContain('fill="currentColor"');
 });
});
