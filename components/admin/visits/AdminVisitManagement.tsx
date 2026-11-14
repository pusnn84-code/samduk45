"use client";
import type { InternalVisitPatch } from "../../../src/features/visits/internal-calendar";

import { fetchJson } from "../../../src/lib/fetch-json";
import { useEffect, useMemo, useState } from "react";
import type { AdminVisitRecord } from "../../../src/features/visits/admin-service";
import type { VisitStatus } from "../../../src/features/visits/types";
import { AdminVisitDetail } from "./AdminVisitDetail";
import { AdminVisitList } from "./AdminVisitList";
import { AdminVisitSchedule } from "./AdminVisitSchedule";

async function readJson(url: string, init?: RequestInit) {
  return fetchJson<{ visits?: AdminVisitRecord[] }>(url, {
    cache: "no-store", ...init,
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
  });
}

function errorCopy(cause: unknown): string {
  const code = cause instanceof Error ? cause.message : "";
  if (code === "VISIT_ALREADY_EXISTS") return "해당 날짜에 이미 다른 신청이나 일정이 있습니다.";
  if (code === "VISIT_NOT_EDITABLE") return "취소되거나 완료된 일정은 수정할 수 없습니다. 다시 조회해 주세요.";
  return "처리 결과를 확인하지 못했습니다. 다시 조회한 뒤 시도해 주세요.";
}

export function AdminVisitManagement({
  initialStatus = "all",
}: {
  initialStatus?: "all" | VisitStatus;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [visits, setVisits] = useState<AdminVisitRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"all" | VisitStatus>(initialStatus);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selected = useMemo(
    () => visits.find((visit) => visit.id === selectedId) ?? null,
    [visits, selectedId],
  );

  async function load() {
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const body = await readJson(
        "/api/admin/visits" + (params.size ? "?" + params.toString() : ""),
      );
      const next = (body.visits ?? []) as AdminVisitRecord[];
      setVisits(next);
      setRefreshKey(value => value + 1);
      setSelectedId((current) =>
        current && next.some((visit) => visit.id === current)
          ? current
          : next[0]?.id ?? null,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "심방 신청을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (initialStatus !== "all") params.set("status", initialStatus);

    void readJson(
      "/api/admin/visits" + (params.size ? "?" + params.toString() : ""),
    )
      .then((body) => {
        if (cancelled) return;
        const next = (body.visits ?? []) as AdminVisitRecord[];
        setVisits(next);
        setSelectedId(next[0]?.id ?? null);
        setLoading(false);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "심방 신청을 불러오지 못했습니다.",
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialStatus]);

  async function save(patch: InternalVisitPatch) {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      await readJson("/api/admin/visits/" + selected.id, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "수정하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function action(actionName: "confirm" | "complete" | "cancel" | "delete" | "decline") {
    if (!selected || busy) return;
    if (actionName === "delete" && !window.confirm(`${selected.requesterName}님의 ${selected.visitDate} 심방 신청을 삭제할까요? 삭제한 신청 내용은 복구할 수 없습니다.`)) return;
    if (actionName === "cancel" && !window.confirm("이 심방 신청을 취소할까요?")) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await readJson(
        "/api/admin/visits/" + selected.id + (actionName === "delete" ? "" : "/" + actionName),
        { method: actionName === "delete" ? "DELETE" : "POST" },
      );
      await load();
    } catch (cause) {
      setError(errorCopy(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-visit-management">
      <section className="admin-page-heading">
        <p className="eyebrow">상담 & 심방</p>
        <h1>심방 신청 관리</h1>
        <p>성도의 신청을 수락하면 캘린더에 반영됩니다. 목사님은 일정을 직접 등록할 수 있습니다.</p>
      </section>

      <AdminVisitSchedule refreshKey={refreshKey} onChanged={() => { void load(); }} onSelect={id => {
        setStatus("all"); setFrom(""); setTo("");
        void readJson("/api/admin/visits").then(body => { setVisits(body.visits ?? []); setSelectedId(id); }).catch(() => setError("일정을 불러오지 못했습니다."));
      }} />
      {error && <p className="error-text" role="alert">{error}</p>}
      {loading ? (
        <section className="card empty-state">
          <strong>심방 신청을 불러오는 중입니다.</strong>
        </section>
      ) : (
        <div className="admin-visit-layout">
          <AdminVisitList
            visits={visits}
            selectedId={selectedId}
            status={status}
            from={from}
            to={to}
            onStatusChange={setStatus}
            onFromChange={setFrom}
            onToChange={setTo}
            onSearch={() => void load()}
            onSelect={(visit) => { if (!busy) setSelectedId(visit.id); }}
          />
          <AdminVisitDetail
            key={selected?.id ?? "none"}
            visit={selected}
            busy={busy}
            onSave={save}
            onAction={action}
          />
        </div>
      )}
    </div>
  );
}
