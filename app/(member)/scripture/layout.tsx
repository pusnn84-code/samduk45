import type { ReactNode } from "react";
import "../../../components/scripture/scripture.css";

export default function ScriptureLayout({ children }: { children: ReactNode }) {
  return <main className="scripture-library">{children}</main>;
}
