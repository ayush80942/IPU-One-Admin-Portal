"use client";

import { useCallback, useEffect, useState } from "react";
import { ToggleLeft } from "lucide-react";
import { useToast } from "../components/Toast";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import {
  fetchFeatureFlags,
  setFeatureFlag,
  STUDENT_FEATURES,
  FEATURE_LABEL,
  type InstituteFeatureFlags,
  type StudentFeature,
} from "../lib/api";

export default function FeatureFlagsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<InstituteFeatureFlags[]>([]);
  const [loading, setLoading] = useState(true);
  // instituteCode:feature currently in flight, so a slow toggle can't be double-clicked into an
  // inconsistent state and the checkbox can show it's busy.
  const [pending, setPending] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchFeatureFlags());
    } catch (err) {
      toast(`Failed to load feature flags: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (row: InstituteFeatureFlags, feature: StudentFeature, enabled: boolean) => {
    const key = `${row.instituteCode}:${feature}`;
    setPending((p) => new Set(p).add(key));

    // Optimistic: flip it locally right away, and only re-fetch on failure.
    setRows((prev) =>
      prev.map((r) =>
        r.instituteCode !== row.instituteCode
          ? r
          : {
              ...r,
              enabledFeatures: enabled
                ? [...r.enabledFeatures, feature]
                : r.enabledFeatures.filter((f) => f !== feature),
            }
      )
    );

    try {
      await setFeatureFlag(row.instituteCode, feature, enabled);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update feature flag", "error");
      load();
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(key);
        return next;
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="Feature Flags"
        subtitle="Which optional tabs each school's students see in the app. Home, Results, and Profile always show — everything here is off by default until you switch it on for a school."
      />

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={ToggleLeft} message="No institutes exist yet — create one on the Institutes page first." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide sticky left-0 bg-primary-faint">
                    School
                  </th>
                  {STUDENT_FEATURES.map((feature) => (
                    <th key={feature} className="px-4 py-3 text-center text-[11px] font-bold text-primary uppercase tracking-wide whitespace-nowrap">
                      {FEATURE_LABEL[feature]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.instituteCode} className="border-b border-border last:border-b-0 hover:bg-background transition-colors">
                    <td className="px-4 py-3 sticky left-0 bg-surface">
                      <div className="font-semibold text-foreground">{row.instituteName}</div>
                      <div className="text-[11px] text-muted font-mono">{row.instituteCode}</div>
                    </td>
                    {STUDENT_FEATURES.map((feature) => {
                      const key = `${row.instituteCode}:${feature}`;
                      const checked = row.enabledFeatures.includes(feature);
                      return (
                        <td key={feature} className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={pending.has(key)}
                            onChange={(e) => toggle(row, feature, e.target.checked)}
                            className="w-4 h-4 accent-primary disabled:opacity-40"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
