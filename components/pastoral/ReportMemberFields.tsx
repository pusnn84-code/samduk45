"use client";

import { useEffect, useState } from "react";
import type { MemberNote } from "../../src/features/pastoral/policy";
import { api } from "./client";

type Person = Pick<MemberNote, "rosterId" | "member">;
const fields = [["sharing", "나눔"], ["prayer", "기도제목"], ["news", "소식"]] as const;

export function ReportMemberFields({ samId, notes, onChange, allowDirectInput = true }: {
  samId: string;
  notes: MemberNote[];
  onChange: (notes: MemberNote[]) => void;
  allowDirectInput?: boolean;
}) {
  const [members, setMembers] = useState<Person[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!samId) return;
    const controller = new AbortController();
    void api<{ members: Person[] }>(`/api/pastoral/sams/${encodeURIComponent(samId)}/members`, {
      cache: "no-store", signal: controller.signal,
    }).then(result => {
      if (!controller.signal.aborted) setMembers(result.members);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [samId, attempt]);

  const saved = new Map(notes.map(note => [note.rosterId, note]));
  const people = [...(members ?? []), ...notes.filter(note => !members?.some(member => member.rosterId === note.rosterId))];
  return <section className="pastoral-section" aria-label="샘원별 기록">
    <h3>샘원별 나눔 · 기도제목 · 소식</h3>
    {!samId ? <p className="helper-text">샘을 선택하면 등록된 샘원 이름과 입력칸이 표시됩니다.</p> : failed ? <div className="pastoral-toolbar">
      <p role="alert">현재 샘 명단을 불러오지 못했습니다. {allowDirectInput ? "기존 기록을 수정하거나 샘원 기록을 직접 입력할 수 있습니다." : "명단을 다시 불러와 주세요."}</p>
      <button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>명단 다시 불러오기</button>
    </div> : members === null ? <p role="status">샘 명단을 불러오는 중입니다.</p>
      : !people.length && <p>등록된 샘원이 없습니다. {allowDirectInput ? "샘원 기록을 직접 입력할 수 있습니다." : "관리자에게 샘원 등록을 확인해 주세요."}</p>}
    {people.map(person => {
      const note = saved.get(person.rosterId) ?? {
        rosterId: person.rosterId, member: person.member, sharing: "", prayer: "", news: "",
      };
      return <div className="pastoral-input-row pastoral-member-note" key={person.rosterId} role="group" aria-label={note.member}>
        <strong>{note.member}</strong>
        {fields.map(([field, label]) => <label key={field}>{label}
          <textarea aria-label={`${note.member} ${label}`} rows={2} maxLength={2000} value={note[field]} onChange={event => {
            const updated = { ...note, [field]: event.target.value };
            onChange(saved.has(note.rosterId) ? notes.map(row => row.rosterId === note.rosterId ? updated : row) : [...notes, updated]);
          }} />
        </label>)}
      </div>;
    })}
  </section>;
}
