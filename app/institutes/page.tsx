"use client";

import { useState, useEffect, useCallback } from "react";
import { Landmark } from "lucide-react";
import { useToast } from "../components/Toast";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import DetailDialog, { DetailField } from "../components/DetailDialog";
import { fetchInstitutes, updateInstitute, Institute } from "../lib/api";

export default function InstitutesPage() {
  const { toast } = useToast();
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Institute | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchInstitutes();
      setInstitutes(data);
    } catch (err) {
      toast(`Failed to load institutes: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="Institutes"
        subtitle="Code and name are kept in sync automatically from imported results — set a short name here."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <StatTile value={institutes.length} label="Total Institutes" icon={Landmark} />
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-primary">All Institutes</h2>
          <button onClick={load} className="text-[13px] font-medium text-primary hover:underline">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : institutes.length === 0 ? (
          <EmptyState icon={Landmark} message="No institutes yet — they're created automatically as students import results." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Institute</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Short Name</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody>
                {institutes.map((institute) => (
                  <InstituteRow
                    key={institute.instituteCode}
                    institute={institute}
                    onExpand={setSelected}
                    onSaved={(updated) =>
                      setInstitutes((prev) =>
                        prev.map((i) => (i.instituteCode === updated.instituteCode ? updated : i))
                      )
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <DetailDialog
          title={selected.instituteName}
          subtitle={`Code: ${selected.instituteCode}`}
          onClose={() => setSelected(null)}
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <DetailField label="Short Name" value={selected.shortName} />
            <DetailField label="Created" value={new Date(selected.createdAt).toLocaleString()} />
            <DetailField label="Last Updated" value={new Date(selected.updatedAt).toLocaleString()} />
          </div>
        </DetailDialog>
      )}
    </div>
  );
}

function InstituteRow({
  institute,
  onExpand,
  onSaved,
}: {
  institute: Institute;
  onExpand: (institute: Institute) => void;
  onSaved: (updated: Institute) => void;
}) {
  const { toast } = useToast();
  const [shortName, setShortName] = useState(institute.shortName ?? "");
  const [saving, setSaving] = useState(false);

  const dirty = shortName !== (institute.shortName ?? "");

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateInstitute(institute.instituteCode, {
        shortName: shortName.trim() === "" ? null : shortName.trim(),
      });
      onSaved(updated);
      toast("Institute updated", "success");
    } catch (err) {
      toast(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="hover:bg-background transition-colors border-b border-border last:border-b-0">
      <td
        className="px-4 py-3 cursor-pointer group"
        onClick={() => onExpand(institute)}
      >
        <div className="font-semibold group-hover:text-primary group-hover:underline">{institute.instituteName}</div>
        <div className="text-[11px] text-muted mt-0.5">Code: {institute.instituteCode}</div>
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          placeholder="e.g. USAR"
          className="w-full px-2.5 py-1.5 border border-border rounded-lg text-[13px] bg-surface focus:outline-none focus:border-primary"
        />
      </td>
      <td className="px-4 py-3">
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="text-[12px] font-bold text-primary hover:underline disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
      </td>
    </tr>
  );
}
