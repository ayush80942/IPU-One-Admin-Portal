"use client";

import { useState, useMemo } from "react";
import { ChevronRight, Search, Plus, Trash2, Building2, Layers, Calculator, AlertTriangle } from "lucide-react";
import { useToast } from "../components/Toast";
import { useIsSuperAdmin } from "../components/AuthGate";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import {
  saveCreditRule,
  deleteCreditRule,
  GroupedCredits,
  GroupedSchool,
  GroupedProgram,
  GroupedPaper,
  NeedsAttentionPaper,
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

/** Stable identity for a school. There is no synthetic "not identified" chip any more — a paper
 *  the university hasn't tied to a school yet isn't shown on this page at all. */
function schoolKey(school: GroupedSchool) {
  return school.instituteCode ?? "__unplaced";
}

/** The chip label is deliberately just the short form — the full name is shown separately as
 *  the section heading once a school is picked, not folded into the scroll strip. */
function schoolChipLabel(school: GroupedSchool) {
  return school.shortName || school.instituteCode || school.instituteName;
}

function matchesPaper(paper: GroupedPaper, query: string) {
  if (!query) return true;
  return (
    paper.paperCode.toLowerCase().includes(query) ||
    (paper.subjectName ?? "").toLowerCase().includes(query)
  );
}

function matchesNeedsAttention(paper: NeedsAttentionPaper, query: string) {
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
  // Credit rules are university-wide configuration. An institute's Student Cell gets its own
  // branch of the tree to read - useful for checking what a paper is worth - but the backend
  // refuses every write here, so the controls are not offered.
  const readOnly = !useIsSuperAdmin();
  const [search, setSearch] = useState("");
  // Keys the user has flipped away from the default. Programmes default closed, because four of
  // them open at once is the wall of rows this grouping exists to break up.
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  // Which school's tab is active. The backend already hands an institute admin nothing but
  // their own schools, so this narrows what is on screen — it is not a permission boundary.
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCredits, setNewCredits] = useState("");

  const query = search.trim().toLowerCase();

  // The "school not identified" bucket never reaches this page: with a school-first picker
  // there is no tab for it to live under, and a paper with no institute yet is exactly the kind
  // of not-done-yet mapping this page is meant to stop surfacing.
  const knownSchools = useMemo(() => data.schools.filter((s) => !s.unknown), [data.schools]);

  // Filtering happens over the whole tree so a search reaches papers inside collapsed
  // sections; sections that keep nothing drop out entirely rather than showing as empty.
  const schools = useMemo(() => {
    if (!query) return knownSchools;
    return knownSchools
      .map((school) => {
        const programs = school.programs
          .map((program) => {
            const semesters = program.semesters
              .map((s) => ({ ...s, papers: s.papers.filter((p) => matchesPaper(p, query)) }))
              .filter((s) => s.papers.length > 0)
              .map((s) => ({ ...s, paperCount: s.papers.length }));
            const paperCount = semesters.reduce((n, s) => n + s.paperCount, 0);
            return { ...program, semesters, paperCount };
          })
          .filter((p) => p.paperCount > 0);
        const needsAttention = school.needsAttention.filter((p) => matchesNeedsAttention(p, query));
        const paperCount = programs.reduce((n, p) => n + p.paperCount, 0);
        return { ...school, programs, needsAttention, paperCount };
      })
      .filter((s) => s.paperCount > 0 || s.needsAttention.length > 0);
  }, [knownSchools, query]);

  const shown = schools.reduce((n, s) => n + s.paperCount, 0);

  // Derived rather than stored, so a search that empties the chosen school falls through to one
  // that still has matches instead of showing an empty tree and no explanation.
  const school = schools.find((s) => schoolKey(s) === selectedSchool) ?? schools[0] ?? null;

  const addRule = async () => {
    const code = newCode.trim().toUpperCase();
    try {
      await saveCreditRule(code, Number(newCredits), newName.trim() || undefined);
      toast(`Added ${code}`, "success");
      setNewCode("");
      setNewName("");
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
      {/* A horizontal strip of every registered school, short name only — the full name and
          everything below belongs to whichever one is tapped, not to the strip itself. */}
      <div className="border-b border-border bg-background">
        <div className="px-6 pt-3.5 flex items-center gap-2 overflow-x-auto pb-3">
          <Building2 className="w-4 h-4 text-primary shrink-0" />
          {knownSchools.length === 0 ? (
            <span className="text-[13px] text-muted">No schools to show</span>
          ) : (
            knownSchools.map((s) => {
              const active = school ? schoolKey(s) === schoolKey(school) : false;
              return (
                <button
                  key={schoolKey(s)}
                  onClick={() => setSelectedSchool(schoolKey(s))}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-colors border ${
                    active
                      ? "bg-primary text-white border-primary"
                      : "bg-surface text-foreground border-border hover:border-primary"
                  }`}
                >
                  {schoolChipLabel(s)}
                  {s.needsAttention.length > 0 && (
                    <span className={`ml-1.5 ${active ? "text-white/80" : "text-danger"}`}>
                      · {s.needsAttention.length}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
        {school && (
          <div className="px-6 pb-3.5">
            <div className="text-[15px] font-bold text-foreground">{school.instituteName}</div>
            <div className="text-[12px] text-muted mt-0.5">
              {school.paperCount} paper{school.paperCount === 1 ? "" : "s"}
              {" · "}
              {school.programs.length} section{school.programs.length === 1 ? "" : "s"}
              {school.needsAttention.length > 0 && (
                <>
                  {" · "}
                  <span className="text-danger font-semibold">
                    {school.needsAttention.length} need{school.needsAttention.length === 1 ? "s" : ""} attention
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

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
              {shown} of {data.totalPapers} across {schools.length} school{schools.length === 1 ? "" : "s"}
            </span>
          )}
          {!readOnly && (
            <button
              onClick={() => setAdding((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:underline"
            >
              <Plus className="w-4 h-4" /> Add paper code
            </button>
          )}
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
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Subject name (optional)"
            className={`${INPUT} w-72`}
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

      {!school ? (
        <EmptyState
          icon={Calculator}
          message={query ? "No paper code or subject matches that search." : "No credit rules yet."}
        />
      ) : (
        <>
          {school.needsAttention.length > 0 && (
            <NeedsAttentionSection papers={school.needsAttention} readOnly={readOnly} onChanged={onChanged} />
          )}
          <SchoolSection school={school} isOpen={isOpen} onToggle={toggle} onChanged={onChanged} />
        </>
      )}
    </>
  );
}

/** Papers this school's students hold that resolve to no exact rule yet — a regex guess or a
 *  silent zero. Kept as its own quick-action list rather than folded into the branch tree below,
 *  since these papers usually have no settled programme/semester home yet either. */
function NeedsAttentionSection({
  papers,
  readOnly,
  onChanged,
}: {
  papers: NeedsAttentionPaper[];
  readOnly: boolean;
  onChanged: () => void;
}) {
  return (
    <div className="mx-6 mt-4 mb-2 border border-danger/30 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-danger-faint flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0" />
        <span className="text-[13px] font-bold text-danger">Needs attention</span>
        <span className="text-[12px] text-danger/80">
          — a paper counting for zero is silently left out of its semester&apos;s SGPA
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="bg-primary-faint">
              <th className={TH}>Paper Code</th>
              <th className={TH}>Subject</th>
              <th className={TH}>Current</th>
              <th className={TH}>Students</th>
              {!readOnly && <th className={TH}>Set Credits</th>}
            </tr>
          </thead>
          <tbody>
            {papers.map((p) => (
              <NeedsAttentionRow key={p.paperCode} paper={p} readOnly={readOnly} onSaved={onChanged} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NeedsAttentionRow({
  paper,
  readOnly,
  onSaved,
}: {
  paper: NeedsAttentionPaper;
  readOnly: boolean;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [credits, setCredits] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveCreditRule(paper.paperCode, Number(credits));
      toast(`${paper.paperCode} set to ${credits} credits`, "success");
      onSaved();
    } catch (err) {
      toast(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const zero = paper.creditSource === "NONE";

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-background transition-colors">
      <td className="px-4 py-3 font-mono text-[13px]">{paper.paperCode}</td>
      <td className="px-4 py-3 text-[12px] text-muted">{paper.subjectName || "—"}</td>
      <td className="px-4 py-3">
        {zero ? (
          <Pill color="text-danger" colorFaint="bg-danger-faint">0 — not counted</Pill>
        ) : (
          <Pill color="text-orange" colorFaint="bg-orange-faint">{paper.currentCredits} — guessed</Pill>
        )}
      </td>
      <td className="px-4 py-3 tabular-nums">{paper.studentCount}</td>
      {!readOnly && (
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              placeholder="—"
              className={`${INPUT} w-20`}
            />
            {credits.trim() !== "" && (
              <button
                onClick={save}
                disabled={saving}
                className="text-[12px] font-bold text-primary hover:underline disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

/** The selected school's programmes. The school itself is chosen above, not expanded here. */
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
  const key = `school:${schoolKey(school)}`;
  // With one school on screen at a time, a handful of sections can all start open — the reason
  // programmes default closed is a wall of rows, and three sections is not one. A school with
  // more than that goes back to closed, so it still reads as a table of contents.
  const programsDefaultOpen = school.programs.length <= 3;

  if (school.programs.length === 0) {
    return school.needsAttention.length === 0 ? (
      <EmptyState icon={Calculator} message="No papers placed under a programme for this school yet." />
    ) : null;
  }

  return (
    <div className="py-2">
      {school.programs.map((program) => (
        <ProgramSection
          key={`${key}:${program.kind}:${program.programCode ?? ""}`}
          parentKey={key}
          program={program}
          defaultOpen={programsDefaultOpen}
          isOpen={isOpen}
          onToggle={onToggle}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function ProgramSection({
  parentKey,
  program,
  defaultOpen,
  isOpen,
  onToggle,
  onChanged,
}: {
  parentKey: string;
  program: GroupedProgram;
  defaultOpen: boolean;
  isOpen: (key: string, defaultOpen: boolean) => boolean;
  onToggle: (key: string) => void;
  onChanged: () => void;
}) {
  const key = `${parentKey}:program:${program.kind}:${program.programCode ?? ""}`;
  const open = isOpen(key, defaultOpen);

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
                    <th className={TH}>Subject Name</th>
                    <th className={TH}>Credits</th>
                    <th className={TH}>Students</th>
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

/**
 * Where the name in the box came from. Only worth saying when it is not the admin's own: a
 * scheme name is provisional, and an empty one is a gap somebody should fill.
 */
function NameSourceHint({ source }: { source: GroupedPaper["nameSource"] }) {
  if (source === "ADMIN") return null;

  const hint =
    source === "SCHEME"
      ? { text: "from scheme", title: "From the published scheme — no student has imported this paper yet" }
      : source === "RESULT"
        ? { text: "from results", title: "The name the university's result portal printed. Edit to override it." }
        : { text: "unnamed", title: "No result and no scheme entry names this paper yet." };

  return (
    <div className="text-[11px] text-muted mt-0.5" title={hint.title}>
      {hint.text}
    </div>
  );
}

function PaperRow({ paper, onChanged }: { paper: GroupedPaper; onChanged: () => void }) {
  const { toast } = useToast();
  const readOnly = !useIsSuperAdmin();
  const [credits, setCredits] = useState(String(paper.credits));
  const [name, setName] = useState(paper.subjectName ?? "");
  const [saving, setSaving] = useState(false);

  // Saving a row, or publishing, reloads the tree underneath an open page. Without this the
  // inputs would keep showing what was typed before the reload and the Save link would stay
  // lit for a change that already landed. Adjusting during render rather than in an effect is
  // React's own recommendation for state that has to follow a prop.
  const [syncedTo, setSyncedTo] = useState({ credits: paper.credits, subjectName: paper.subjectName });
  if (syncedTo.credits !== paper.credits || syncedTo.subjectName !== paper.subjectName) {
    setSyncedTo({ credits: paper.credits, subjectName: paper.subjectName });
    setCredits(String(paper.credits));
    setName(paper.subjectName ?? "");
  }

  const nameChanged = name !== (paper.subjectName ?? "");
  const dirty = credits !== String(paper.credits) || nameChanged;

  const save = async () => {
    setSaving(true);
    try {
      // Only send the name when it was actually edited. The box is pre-filled with whatever the
      // tree resolved — often a result's or the scheme's name — so sending it unconditionally
      // would quietly promote those to admin-set on any credits-only edit, and a later portal
      // rename would then stop showing through.
      await saveCreditRule(paper.paperCode, Number(credits), nameChanged ? name.trim() : undefined);
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
        {readOnly ? (
          <span className="text-[13px] text-foreground">{paper.subjectName || "—"}</span>
        ) : (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this paper"
            className={`${INPUT} w-full min-w-[16rem]`}
          />
        )}
        <NameSourceHint source={paper.nameSource} />
      </td>
      <td className="px-4 py-2.5">
        {readOnly ? (
          <span className="text-[13px] tabular-nums">{paper.credits}</span>
        ) : (
          <input
            type="number"
            min={0}
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            className={`${INPUT} w-20`}
          />
        )}
      </td>
      <td className="px-4 py-2.5 text-[12px] text-muted tabular-nums whitespace-nowrap">
        {paper.studentCount > 0 ? paper.studentCount : "—"}
      </td>
      <td className="px-4 py-2.5">
        {!readOnly && (
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
        )}
      </td>
    </tr>
  );
}
