"use client";
import { useId, type ReactNode } from "react";

export function DirectorySamAccordion({ label, leaderName, count, open, onToggle, children }: {
  label: string; leaderName: string; count: number; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  const id = useId();
  return <div className="directory-sam-item">
    <button type="button" id={id + "-trigger"} className="directory-sam-trigger" aria-expanded={open} aria-controls={id + "-members"} onClick={onToggle}>
      <span className="directory-tree-square" aria-hidden="true" />
      <span><strong>{label}</strong><span className="directory-sam-leader"><span>샘리더</span> <b>{leaderName}</b></span></span>
      <span className="directory-sam-count">{count}명 <span className="directory-sam-toggle" aria-hidden="true">{open ? "−" : "＋"}</span></span>
    </button>
    <section className="directory-sam-panel" id={id + "-members"} hidden={!open} aria-labelledby={id + "-trigger"}>
      {open && <><h4 className="directory-sam-panel-heading">{label} 샘원 명단 <small>{count}명</small></h4>{children}</>}
    </section>
  </div>;
}
