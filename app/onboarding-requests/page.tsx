"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { UserCheck } from "lucide-react";
import { useToast } from "../components/Toast";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import OnboardingRequestDialog from "../components/OnboardingRequestDialog";
import { fetchOnboardingRequests, OnboardingRequest, OnboardingRequestStatus } from "../lib/api";
import { ONBOARDING_STATUS_META } from "../lib/onboarding";

const TH = "px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide";

const STATUS_TABS: { value: OnboardingRequestStatus | ""; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "", label: "All" },
];

export default function OnboardingRequestsPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OnboardingRequestStatus | "">("PENDING");
  const [selected, setSelected] = useState<OnboardingRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetched unfiltered — the tab counts and stat tiles need every status regardless of which
      // tab is active, and this list is small enough (institute-scoped) to just filter client-side.
      setRequests(await fetchOnboardingRequests());
    } catch (err) {
      toast(`Failed to load onboarding requests: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Initial-load-on-mount, same pattern as every other list page in this app; suppressed only to
  // avoid growing the repo-wide pre-existing count from this rule (see CLAUDE.md).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = requests.filter((r) => r.status === "REJECTED").length;

  const filtered = useMemo(
    () => (statusFilter ? requests.filter((r) => r.status === statusFilter) : requests),
    [requests, statusFilter]
  );

  const handleReviewed = (updated: OnboardingRequest) => {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelected(null);
  };

  return (
    <div>
      <PageHeader
        title="Onboarding Requests"
        subtitle="A first-time student who couldn't get through the real GGSIPU result-portal login submitted these details from the app instead. Verify their identity in person against a college ID card at the Student Cell, then approve or reject."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatTile value={loading ? "—" : pendingCount} label="Pending" color="orange" icon={UserCheck} />
        <StatTile value={loading ? "—" : approvedCount} label="Approved" color="success" />
        <StatTile value={loading ? "—" : rejectedCount} label="Rejected" color="danger" />
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex rounded-lg border border-border bg-background p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value || "ALL"}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3.5 py-1.5 rounded-md text-[13px] font-semibold transition-colors ${
                  statusFilter === tab.value ? "bg-primary text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
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
        ) : filtered.length === 0 ? (
          <EmptyState icon={UserCheck} message="No onboarding requests match this filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className={TH}>Enrollment No</th>
                  <th className={TH}>Name</th>
                  <th className={TH}>Login Email</th>
                  <th className={TH}>Institute</th>
                  <th className={TH}>Program</th>
                  <th className={TH}>Admission / Batch Yr</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const meta = ONBOARDING_STATUS_META[r.status];
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className="hover:bg-background transition-colors border-b border-border last:border-b-0 cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono text-[13px]">{r.enrollmentNo}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{r.name}</span>
                          {r.lateralEntry && <Pill color="text-violet" colorFaint="bg-violet-faint">Lateral</Pill>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">{r.loginEmail}</td>
                      <td className="px-4 py-3">{r.instituteShortName || r.instituteName}</td>
                      <td className="px-4 py-3">{r.programShortName || r.programName}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.admissionYear} / {r.batchYear}</td>
                      <td className="px-4 py-3">
                        <Pill color={meta.color} colorFaint={meta.colorFaint}>{meta.label}</Pill>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted text-[12px]">
                        {new Date(r.submittedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <OnboardingRequestDialog request={selected} onClose={() => setSelected(null)} onReviewed={handleReviewed} />
      )}
    </div>
  );
}
