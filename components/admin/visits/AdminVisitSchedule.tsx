"use client";
import { VisitBookingClient } from "../../visits/VisitBookingClient";
export function AdminVisitSchedule({refreshKey,onSelect,onChanged}:{refreshKey:number;onChanged:()=>void;onSelect:(id:string)=>void}) {
  return <section aria-label="심방·목회일정"><VisitBookingClient key={refreshKey} requesterName="담당 목회자" isAdmin onSelectVisit={onSelect} onChanged={onChanged}/></section>;
}
