"use client";

import { useState, useEffect, useCallback, useMemo, FormEvent } from "react";
import { CalendarDays, Plus, Rows3, Trash2, Pencil, Clock } from "lucide-react";
import { useToast } from "../components/Toast";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import DetailDialog from "../components/DetailDialog";
import Combobox, { ComboboxOption } from "../components/Combobox";
import {
  fetchFeedbackOfferings,
  fetchTimetableSlots,
  createTimetableSlot,
  updateTimetableSlot,
  deleteTimetableSlot,
  TeachingOfferingDto,
  TimetableSlotDto,
  TimetableDayOfWeek,
  DAYS_OF_WEEK,
} from "../lib/api";

const DAY_LABEL: Record<TimetableDayOfWeek, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

// Section/lab-group creation lives on each institute's own page (institutes/[instituteCode] ->
// a "Sections" dropdown on each course row, scoped by batch year via CourseSectionsDropdown) -
// that's where the institute+program context already lives, and not every institute/program has
// that further division, so it shouldn't be a standalone destination of its own. This page is
// now just the weekly schedule per teaching offering.
export default function TimetablePage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [offerings, setOfferings] = useState<TeachingOfferingDto[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOfferings(await fetchFeedbackOfferings());
    } catch (err) {
      toast(`Failed to load teaching offerings: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="Timetable"
        subtitle="The weekly schedule (day, time, room) for each teaching offering."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <StatTile value={loading ? "—" : offerings.length} label="Teaching Offerings" icon={Rows3} color="info" />
        <StatTile
          value={loading ? "—" : offerings.filter((o) => o.sectionId).length}
          label="Section-Scoped Offerings"
          icon={CalendarDays}
          color="violet"
        />
      </div>

      <SlotsTab offerings={offerings} loading={loading} />
    </div>
  );
}

// ============================================================================
// Timetable Slots
// ============================================================================

function offeringOptionsFrom(offerings: TeachingOfferingDto[]): ComboboxOption[] {
  return offerings.map((o) => ({
    value: o.id,
    label: `${o.subjectName} (${o.subjectCode})`,
    sublabel: `${o.teacherName} · ${o.academicTerm}${o.sectionName ? ` · ${o.sectionName}${o.groupName ? ` ${o.groupName}` : ""}` : ""}`,
  }));
}

function SlotsTab({ offerings, loading: offeringsLoading }: { offerings: TeachingOfferingDto[]; loading: boolean }) {
  const { toast } = useToast();
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [selectedOfferingLabel, setSelectedOfferingLabel] = useState("");
  const [slots, setSlots] = useState<TimetableSlotDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TimetableSlotDto | null>(null);
  const offeringOptions = useMemo(() => offeringOptionsFrom(offerings), [offerings]);

  const load = useCallback(async (offeringId: string) => {
    setLoading(true);
    try {
      setSlots(await fetchTimetableSlots(offeringId));
    } catch (err) {
      toast(`Failed to load timetable slots: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedOfferingId) load(selectedOfferingId);
    else setSlots([]);
  }, [selectedOfferingId, load]);

  const handleDelete = async (slot: TimetableSlotDto) => {
    if (!confirm(`Delete this ${DAY_LABEL[slot.dayOfWeek]} slot?`)) return;
    try {
      await deleteTimetableSlot(slot.id);
      toast("Slot deleted");
      load(selectedOfferingId);
    } catch (err) {
      toast(`Failed to delete slot: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    }
  };

  const sorted = [...slots].sort((a, b) => {
    const dayDiff = DAYS_OF_WEEK.indexOf(a.dayOfWeek) - DAYS_OF_WEEK.indexOf(b.dayOfWeek);
    return dayDiff !== 0 ? dayDiff : a.startTime.localeCompare(b.startTime);
  });

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-[15px] font-bold text-primary mb-3">Pick a Teaching Offering</h2>
        <Combobox
          label="Offering"
          value={selectedOfferingId}
          displayValue={selectedOfferingLabel}
          search={(q) => {
            const lower = q.toLowerCase();
            return offeringOptions.filter(
              (o) => o.label.toLowerCase().includes(lower) || (o.sublabel ?? "").toLowerCase().includes(lower)
            );
          }}
          onSelect={(opt) => {
            setSelectedOfferingId(opt?.value ?? "");
            setSelectedOfferingLabel(opt?.label ?? "");
          }}
          placeholder={offeringsLoading ? "Loading offerings…" : "Search subject, code, or teacher…"}
          disabled={offeringsLoading}
        />
      </div>

      {!selectedOfferingId ? (
        <EmptyState icon={Clock} message="Pick a teaching offering above to see and edit its weekly slots." />
      ) : (
        <>
          <div className="px-6 py-4 flex items-center justify-between gap-3 flex-wrap border-b border-border">
            <h3 className="text-[13.5px] font-semibold text-foreground">{selectedOfferingLabel}</h3>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13.5px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Add Slot
            </button>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">{[1, 2].map((i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
          ) : sorted.length === 0 ? (
            <EmptyState icon={Clock} message="No slots yet for this offering." />
          ) : (
            <ul className="divide-y divide-border">
              {sorted.map((s) => (
                <li key={s.id} className="px-6 py-3 flex items-center gap-4 text-[13.5px]">
                  <Pill color="text-primary" colorFaint="bg-primary-faint">{DAY_LABEL[s.dayOfWeek]}</Pill>
                  <span className="tabular-nums font-medium text-foreground">{s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}</span>
                  <span className="text-muted">{s.room}</span>
                  <div className="flex items-center gap-3 ml-auto">
                    <button onClick={() => setEditing(s)} className="text-muted hover:text-primary"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(s)} className="text-muted hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {showForm && (
        <DetailDialog title="Add Timetable Slot" subtitle={selectedOfferingLabel} onClose={() => setShowForm(false)}>
          <SlotForm offeringId={selectedOfferingId} onSaved={() => { setShowForm(false); load(selectedOfferingId); }} />
        </DetailDialog>
      )}
      {editing && (
        <DetailDialog title="Edit Timetable Slot" subtitle={selectedOfferingLabel} onClose={() => setEditing(null)}>
          <SlotForm offeringId={selectedOfferingId} existing={editing} onSaved={() => { setEditing(null); load(selectedOfferingId); }} />
        </DetailDialog>
      )}
    </div>
  );
}

function SlotForm({
  offeringId,
  existing,
  onSaved,
}: {
  offeringId: string;
  existing?: TimetableSlotDto;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState<TimetableDayOfWeek>(existing?.dayOfWeek ?? "MONDAY");
  const [startTime, setStartTime] = useState(existing?.startTime.slice(0, 5) ?? "09:00");
  const [endTime, setEndTime] = useState(existing?.endTime.slice(0, 5) ?? "10:00");
  const [room, setRoom] = useState(existing?.room ?? "");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!room.trim() || !startTime || !endTime) {
      toast("Please fill all fields", "error");
      return;
    }
    if (startTime >= endTime) {
      toast("Start time must be before end time", "error");
      return;
    }
    setSubmitting(true);
    try {
      if (existing) {
        await updateTimetableSlot(existing.id, { dayOfWeek, startTime, endTime, room: room.trim() });
        toast("Slot updated");
      } else {
        await createTimetableSlot({ offeringId, dayOfWeek, startTime, endTime, room: room.trim() });
        toast("Slot added");
      }
      onSaved();
    } catch (err) {
      toast(`Failed to save slot: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
      <Field label="Day of Week *">
        <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value as TimetableDayOfWeek)} className={selectClass}>
          {DAYS_OF_WEEK.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}
        </select>
      </Field>
      <Field label="Room *">
        <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. A-406-CR" className={inputClass} />
      </Field>
      <Field label="Start Time *">
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
      </Field>
      <Field label="End Time *">
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
      </Field>
      <div className="col-span-2 flex justify-end mt-2">
        <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-60">
          {submitting ? "Saving…" : existing ? "Save Changes" : "Add Slot"}
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// Shared field styling
// ============================================================================

const inputClass = "border border-border rounded-lg px-3 py-2.5 text-[14px] bg-background focus:outline-none focus:border-primary transition-colors w-full";
const selectClass = inputClass;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
