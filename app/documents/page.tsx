"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "../components/Toast";
import { fetchDocuments, DocumentResponse } from "../lib/api";

export default function DocumentCollectionPage() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
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
      <h1 className="text-2xl font-bold text-primary">Document Collection</h1>
      <p className="text-[14px] text-muted mt-1 mb-7">Verify and approve physical documents submitted by students.</p>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <div className="text-3xl font-extrabold text-primary">{documents.length}</div>
          <div className="text-[13px] text-muted mt-1">Total Submissions</div>
        </div>
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
          <div className="py-16 text-center">
            <p className="text-muted text-[14px]">No documents submitted yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Student ID</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Document Type</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Details</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Image</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id} className="hover:bg-background transition-colors border-b border-border last:border-b-0">
                    <td className="px-4 py-3 font-semibold">{d.enrollmentNo}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary-faint text-primary">
                        {d.documentType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted">
                      {d.semester && <div>Sem: {d.semester}</div>}
                      {d.examType && <div>Type: {d.examType}</div>}
                      {d.nocDuration && <div>Duration: {d.nocDuration}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => setSelectedImage(d.imageBase64)}
                        className="text-primary hover:underline font-medium text-[12px]"
                      >
                        View Image
                      </button>
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

      {/* Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface rounded-xl p-2 max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative">
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70 z-10"
            >
              ✕
            </button>
            <div className="overflow-auto rounded-lg">
              <img src={selectedImage} alt="Document" className="w-full h-auto max-h-[85vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
