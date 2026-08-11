"use client";

import { useState, useMemo } from "react";
import { ChevronRight, Search, Plus, Trash2, Building2, Layers, Calculator } from "lucide-react";
import { useToast } from "../components/Toast";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import {
  saveCreditRule,
  deleteCreditRule,
  GroupedCredits,
  GroupedSchool,
  GroupedProgram,
  GroupedPaper,
} from "../lib/api";

const INPUT =
  "px-2.5 py-1.5 border border-border rounded-lg text-[13px] bg-surface focus:outline-none focus:border-primary";
const TH = "px-4 py-2 text-left text-[11px] font-bold text-primary uppercase tracking-wide";

// The scheme's own Group column. Colour separates the bands an admin treats differently:
// electives carry credits that don't count towards promotion, cores always do.
const GROUP_COLOURS: Record<string, { color: string; colorFaint: string }> = {
  PC: { color: "text-primary", colorFaint: "bg-primary-faint" },
  PCE: { color: "text-violet", colorFaint: "bg-violet-faint" },
  OAE: { color: "text-teal", colorFaint: "bg-teal-faint" },
  BS: { color: "text-info", colorFaint: "bg-info-faint" },
  "HS/MS": { color: "text-orange", colorFaint: "bg-orange-faint" },
  HS: { color: "text-orange", colorFaint: "bg-orange-faint" },
  MS: { color: "text-orange", colorFaint: "bg-orange-faint" },
};

function programLabel(program: GroupedProgram) {
  if (program.kind !== "PROGRAM") return program.programName ?? "";
  const name = program.shortName || program.programName || program.programCode;
  return program.programCode ? `${program.programCode} — ${name}` : (name ?? "");
}

function matches(paper: GroupedPaper, query: string) {
  if (!query) return true;
  return (
    paper.paperCode.toLowerCase().includes(query) ||
    (paper.subjectName ?? "").toLowerCase().includes(query)
  );
}

export default function GroupedRules({
  data,
  onChanged,
}: {
  data: GroupedCredits;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  // Keys the user has flipped away from their level's default. Schools default open so the page
  // reads as an overview; programmes default closed, because four of them open at once is the
  // wall of rows this grouping exists to break up.
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newCredits, setNewCredits] = useState("");

  const query = search.trim().toLowerCase();

  // Filtering happens over the whole tree so a search reaches papers inside collapsed
  // sections; sections that keep nothing drop out entirely rather than showing as empty.
  const schools = useMemo(() => {
    if (!query) return data.schools;
    return data.schools
      .map((school) => {
        const programs = school.programs
          .map((program) => {
            const semesters = program.semesters
              .map((s) => ({ ...s, papers: s.papers.filter((p) => matches(p, query)) }))
              .filter((s) => s.papers.length > 0)
              .map((s) => ({ ...s, paperCount: s.papers.length }));
            const paperCount = semesters.reduce((n, s) => n + s.paperCount, 0);
            return { ...program, semesters, paperCount };
          })
          .filter((p) => p.paperCount > 0);
        const paperCount = programs.reduce((n, p) => n + p.paperCount, 0);
        return { ...school, programs, paperCount };
      })
      .filter((s) => s.paperCount > 0);
  }, [data.schools, query]);

  const shown = schools.reduce((n, s) => n + s.paperCount, 0);

  const addRule = async () => {
    const code = newCode.trim().toUpperCase();
    try {
      await saveCreditRule(code, Number(newCredits));
      toast(`Added ${code}`, "success");
      setNewCode("");
      setNewCredits("");
      setAdding(false);
      onChanged();
    } catch (err) {
      toast(`Failed to add: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    }
  };

  const toggle = (key: string) =>
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // A search result is useless behind a closed section, so searching forces everything open.
  const isOpen = (key: string, defaultOpen: boolean) =>
    query.length > 0 || (defaultOpen ? !toggled.has(key) : toggled.has(key));

  return (
    <>
      <div className="px-6 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search paper code or subject…"
            className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-[13px] bg-background focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-3">
          {query && (
            <span className="text-[12px] text-muted">
              {shown} of {data.totalPapers}
            </span>
          )}
          <button
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:underline"
          >
            <Plus className="w-4 h-4" /> Add paper code
          </button>
        </div>
      </div>

      {adding && (
        <div className="px-6 py-3 border-b border-border bg-background flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="Paper code e.g. ARD299"
            className={`${INPUT} font-mono w-52`}
          />
          <input
            type="number"
            min={0}
            value={newCredits}
            onChange={(e) => setNewCredits(e.target.value)}
            placeholder="Credits"
            className={`${INPUT} w-24`}
          />
          <button
            onClick={addRule}
            disabled={!newCode.trim() || newCredits.trim() === ""}
            className="text-[12px] font-bold text-primary hover:underline disabled:opacity-40"
          >
            Save
          </button>
          <button onClick={() => setAdding(false)} className="text-[12px] font-semibold text-muted hover:text-foreground">
            Cancel
          </button>
          <span className="text-[11px] text-muted">
            It lands under its school once the scheme lists it or a student imports it.
          </span>
        </div>
      )}

      {schools.length === 0 ? (
        <EmptyState
          icon={Calculator}
          message={query ? "No paper code or subject matches that search." : "No credit rules yet."}
        />
      ) : (
        <div>
          {schools.map((school) => (
            <SchoolSection
              key={school.instituteCode ?? "__unplaced"}
              school={school}
              isOpen={isOpen}
              onToggle={toggle}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </>
  );
}

function SchoolSection({
  school,
  isOpen,
  onToggle,
  onChanged,
}: {
  school: GroupedSchool;
  isOpen: (key: string, defaultOpen: boolean) => boolean;
  onToggle: (key: string) => void;
  onChanged: () => void;
}) {
  const key = `school:${school.instituteCode ?? "__unplaced"}`;
  const open = isOpen(key, true);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => onToggle(key)}
        className="w-full px-6 py-3.5 flex items-center gap-3 hover:bg-background transition-colors text-left"
      >
        <ChevronRight className={`w-4 h-4 text-muted shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        <Building2 className="w-4 h-4 text-primary shrink-0" />
        <span className="text-[14px] font-bold text-foreground">
          {school.shortName ?? school.instituteName}
        </span>
        {school.shortName && (
          <span className="text-[12px] text-muted truncate hidden sm:inline">{school.instituteName}</span>
        )}
        <span className="ml-auto text-[12px] text-muted tabular-nums shrink-0">
          {school.paperCount} paper{school.paperCount === 1 ? "" : "s"}
        </span>
      </button>

      {open && (
        <div className="pb-2">
          {school.unknown && (
            <p className="px-6 pb-3 text-[12px] text-muted max-w-3xl">
              Neither the published scheme nor any imported result places these papers under a
              programme. They still count towards SGPA exactly as they always did — they are just
              waiting on a student importing them, or on the scheme being added to the catalog.
            </p>
          )}
          {school.programs.map((program) => (
            <ProgramSection
              key={`${key}:${program.kind}:${program.programCode ?? ""}`}
              parentKey={key}
              program={program}
              isOpen={isOpen}
              onToggle={onToggle}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProgramSection({
  parentKey,
  program,
  isOpen,
  onToggle,
  onChanged,
}: {
  parentKey: string;
  program: GroupedProgram;
  isOpen: (key: string, defaultOpen: boolean) => boolean;
  onToggle: (key: string) => void;
  onChanged: () => void;
}) {
  const key = `${parentKey}:program:${program.kind}:${program.programCode ?? ""}`;
  const open = isOpen(key, false);

  return (
    <div className="mx-6 mb-2 border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => onToggle(key)}
        className="w-full px-4 py-2.5 flex items-center gap-2.5 bg-background hover:bg-primary-faint transition-colors text-left"
      >
        <ChevronRight className={`w-3.5 h-3.5 text-muted shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        <Layers className="w-3.5 h-3.5 text-muted shrink-0" />
        <span className="text-[13px] font-bold text-foreground truncate">{programLabel(program)}</span>
        {program.kind === "SHARED" && (
          <Pill color="text-violet" colorFaint="bg-violet-faint">shared</Pill>
        )}
        {program.kind === "FIRST_YEAR" && (
          <Pill color="text-info" colorFaint="bg-info-faint">common</Pill>
        )}
        <span className="ml-auto text-[12px] text-muted tabular-nums shrink-0">{program.paperCount}</span>
      </button>

      {open &&
        program.semesters.map((semester) => (
          <div key={semester.semester ?? "unknown"}>
            <div className="px-4 py-1.5 bg-surface border-t border-border text-[11px] font-bold text-muted uppercase tracking-wide">
              {semester.semester ? `Semester ${semester.semester}` : "Semester not known"}
              <span className="ml-2 font-normal normal-case tabular-nums">{semester.paperCount}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="bg-primary-faint">
                    <th className={TH}>Paper</th>
                    <th className={TH}>Subject</th>
                    <th className={TH}>Credits</th>
                    <th className={TH}>Note</th>
                    <th className={`${TH} w-8`} />
                  </tr>
                </thead>
                <tbody>
                  {semester.papers.map((paper) => (
                    <PaperRow key={paper.paperCode} paper={paper} onChanged={onChanged} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </div>
  );
}

function PaperRow({ paper, onChanged }: { paper: GroupedPaper; onChanged: () => void }) {
  const { toast } = useToast();
  const [credits, setCredits] = useState(String(paper.credits));
  const [note, setNote] = useState(paper.note ?? "");
  const [saving, setSaving] = useState(false);

  // Saving a row, or publishing, reloads the tree underneath an open page. Without this the
  // inputs would keep showing what was typed before the reload and the Save link would stay
  // lit for a change that already landed. Adjusting during render rather than in an effect is
  // React's own recommendation for state that has to follow a prop.
  const [syncedTo, setSyncedTo] = useState({ credits: paper.credits, note: paper.note });
  if (syncedTo.credits !== paper.credits || syncedTo.note !== paper.note) {
    setSyncedTo({ credits: paper.credits, note: paper.note });
    setCredits(String(paper.credits));
    setNote(paper.note ?? "");
  }

  const dirty = credits !== String(paper.credits) || note !== (paper.note ?? "");

  const save = async () => {
    setSaving(true);
    try {
      await saveCreditRule(paper.paperCode, Number(credits), note.trim() || null);
      toast(`${paper.paperCode} updated`, "success");
      onChanged();
    } catch (err) {
      toast(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete the credit rule for ${paper.paperCode}? It will fall back to the patterns, or to 0 credits.`))
      return;
    try {
      await deleteCreditRule(paper.paperCode);
      toast(`${paper.paperCode} deleted`, "success");
      onChanged();
    } catch (err) {
      toast(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    }
  };

  const groupStyle = paper.paperGroup ? GROUP_COLOURS[paper.paperGroup] : undefined;

  return (
    <tr className="hover:bg-background transition-colors border-b border-border last:border-b-0">
      <td className="px-4 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px]">{paper.paperCode}</span>
          {paper.paperGroup && groupStyle && (
            <Pill color={groupStyle.color} colorFaint={groupStyle.colorFaint}>{paper.paperGroup}</Pill>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5">
        {paper.subjectName ? (
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] text-foreground">{paper.subjectName}</span>
            {paper.nameSource === "SCHEME" && (
              <span
                className="text-[11px] text-muted shrink-0"
                title="From the published scheme — no student has imported this paper yet"
              >
                from scheme
              </span>
            )}
          </div>
        ) : (
          <span className="text-[12px] text-muted">—</span>
        )}
        {paper.studentCount > 0 && (
          <div className="text-[11px] text-muted mt-0.5 tabular-nums">
            {paper.studentCount} student{paper.studentCount === 1 ? "" : "s"}
          </div>
        )}
      </td>
      <td className="px-4 py-2.5">
        <input
          type="number"
          min={0}
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          className={`${INPUT} w-20`}
        />
      </td>
      <td className="px-4 py-2.5">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={paper.adminEdited ? "—" : "imported default"}
          className={`${INPUT} w-full max-w-[14rem]`}
        />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          {dirty && (
            <button
              onClick={save}
              disabled={saving}
              className="text-[12px] font-bold text-primary hover:underline disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
          <button
            onClick={remove}
            aria-label={`Delete ${paper.paperCode}`}
            className="text-muted/50 hover:text-danger transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
