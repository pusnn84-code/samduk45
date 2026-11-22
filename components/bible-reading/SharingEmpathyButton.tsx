"use client";
import type { BibleReadingState } from "../../src/features/bible-reading/types";

export function SharingEmpathyButton({line,disabled,busy,onClick}: {
  line:BibleReadingState["sharedLines"][number];disabled:boolean;busy:boolean;onClick:()=>void;
}) {
  return <button type="button" className="sharing-empathy" aria-label={`${line.name}님의 묵상 나눔 공감 ${line.empathyCount}개`} aria-pressed={line.hasEmpathized} aria-busy={busy} disabled={disabled} onClick={onClick}>
    <span className="sharing-empathy-pill"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21S3 15.3 3 9a5.5 5.5 0 0 1 9-4.1A5.5 5.5 0 0 1 21 9c0 6.3-9 12-9 12Z" fill={line.hasEmpathized?"currentColor":"none"} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg><span>{line.empathyCount}</span></span>
  </button>;
}
