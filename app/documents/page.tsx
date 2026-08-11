"use client";

import { useState, useEffect, useCallback } from "react";
import { FileCheck2 } from "lucide-react";
import { useToast } from "../components/Toast";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import DetailDialog, { DetailField } from "../components/DetailDialog";
import { AuthedImage } from "../components/AuthedFile";
import { fetchDocuments, DocumentResponse } from "../lib/api";

function typeLabel(type: string) {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function docSubline(d: DocumentResponse) {
  const parts: string[] = [];
  if (d.semester) parts.push(`Sem ${d.semester}`);
  if (d.examType) parts.push(d.examType);
  if (d.nocDuration) parts.push(d.nocDuration);
  return parts.join(" • ");
}

export default function DocumentCollectionPage() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DocumentResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDocuments();
      setDocuments(data);
    } catch (err) {
      toast(`Failed to load documents: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader title="Documents" subtitle="Physical documents submitted by students to the Student Cell." />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatTile value={documents.length} label="Total Submissions" icon={FileCheck2} />
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-primary">Submissions</h2>
          <button
            onClick={load}
            className="text-[13px] font-medium text-primary hover:underline"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <EmptyState icon={FileCheck2} message="No documents submitted yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Preview</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Student ID</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Document</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setSelected(d)}
                    className="hover:bg-background transition-colors border-b border-border last:border-b-0 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <AuthedImage
                        fileUrl={d.fileUrl}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover border border-border"
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold">{d.enrollmentNo}</td>
                    <td className="px-4 py-3">
                      <Pill color="text-primary" colorFaint="bg-primary-faint">{typeLabel(d.documentType)}</Pill>
                      {docSubline(d) && <div className="text-[11px] text-muted mt-1">{docSubline(d)}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted text-[12px]">
                      {new Date(d.submittedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <DetailDialog
          title={typeLabel(selected.documentType)}
          subtitle={selected.enrollmentNo}
          onClose={() => setSelected(null)}
          maxWidthClass="max-w-3xl"
        >
          <AuthedImage
            fileUrl={selected.fileUrl}
            alt="Document"
            className="w-full max-h-[60vh] object-contain rounded-lg border border-border bg-background mb-5"
            fallbackClassName="w-full h-[40vh] rounded-lg mb-5"
          />
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <DetailField label="Student" value={selected.enrollmentNo} />
            <DetailField label="Document Type" value={typeLabel(selected.documentType)} />
            {selected.semester && <DetailField label="Semester" value={selected.semester} />}
            {selected.examType && <DetailField label="Exam Type" value={selected.examType} />}
            {selected.nocDuration && <DetailField label="NOC Duration" value={selected.nocDuration} />}
            <DetailField label="Submitted" value={new Date(selected.submittedAt).toLocaleString()} />
            <DetailField label="Last Updated" value={new Date(selected.updatedAt).toLocaleString()} />
          </div>
        </DetailDialog>
      )}
    </div>
  );
}
