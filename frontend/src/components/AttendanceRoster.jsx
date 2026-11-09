import React, { useCallback, useEffect, useState } from "react";

const statuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

export default function AttendanceRoster({ jobId, token, readOnly = false }) {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    if (!jobId || !token) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/jobs/${jobId}/attendance?page=${page}&limit=25`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not load attendance.");
      setRows(data.rows || []);
      setPagination(data.pagination || { pages: 1, total: 0 });
    } catch (err) {
      setRows([]);
      setError(err.message || "Could not load attendance.");
    } finally { setLoading(false); }
  }, [jobId, token, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [jobId]);

  const updateDraft = (appId, key, value) => setDrafts((current) => ({ ...current, [appId]: { ...current[appId], [key]: value } }));
  const save = async (row) => {
    const draft = drafts[row.applicationId] || {};
    const isNew = row.status === "NOT_RECORDED";
    setBusyId(row.applicationId); setError(""); setNotice("");
    try {
      const response = await fetch(isNew ? `/api/jobs/${jobId}/attendance` : `/api/attendance/${row.attendanceId}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(isNew
          ? { applicationId: row.applicationId, status: draft.status || "PRESENT" }
          : { status: draft.status || row.status, reason: draft.reason || "", expectedRevision: row.revision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 409 ? "Attendance changed in another request. Reload and try again." : data.message || "Could not save attendance.");
      setNotice(isNew ? "Attendance recorded." : "Attendance corrected.");
      setDrafts((current) => { const next = { ...current }; delete next[row.applicationId]; return next; });
      await load();
    } catch (err) { setError(err.message || "Could not save attendance."); }
    finally { setBusyId(""); }
  };

  if (!jobId) return <section className="panel p-4 text-sm text-ink-muted">Select a drive to view institute attendance.</section>;

  return (
    <section className="panel p-4 sm:p-5 mb-6" aria-labelledby="attendance-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div><h2 id="attendance-heading" className="font-semibold text-ink">Drive attendance</h2><p className="text-xs text-ink-muted">{pagination.total} applications · missing records are shown as Not recorded</p></div>
        {pagination.pages > 1 && <div className="flex gap-2 items-center text-xs"><button type="button" className="px-3 py-1 border rounded disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span>Page {page} of {pagination.pages}</span><button type="button" className="px-3 py-1 border rounded disabled:opacity-40" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</button></div>}
      </div>
      {error && <p role="alert" className="mb-3 rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mb-3 rounded bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {loading ? <p role="status" className="py-5 text-sm text-ink-muted">Loading attendance…</p>
        : rows.length === 0 ? <p className="py-5 text-sm text-ink-muted">No applications on this page.</p>
          : <div className="space-y-3">{rows.map((row) => {
            const draft = drafts[row.applicationId] || {};
            const currentStatus = draft.status || row.status;
            return <article key={row.applicationId} className="rounded-lg border border-sage p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0"><p className="font-medium text-ink">{row.student?.name || "Student"}</p><p className="text-xs text-ink-muted">{[row.student?.rollNumber, row.student?.department, row.student?.batch].filter(Boolean).join(" · ")}</p><p className="mt-1 text-sm">{row.status === "NOT_RECORDED" ? "Not recorded" : row.status}{row.recordedAt ? ` · Recorded ${new Date(row.recordedAt).toLocaleString()}` : ""}</p></div>
                {!readOnly && <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs font-medium">{row.status === "NOT_RECORDED" ? "Status" : "Correct status"}<select aria-label={`${row.status === "NOT_RECORDED" ? "Record" : "Correct"} attendance for ${row.student?.name || "student"}`} className="mt-1 block rounded border border-sage bg-white p-2" value={draft.status || (row.status === "NOT_RECORDED" ? "PRESENT" : row.status)} onChange={(event) => updateDraft(row.applicationId, "status", event.target.value)}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                  {row.status !== "NOT_RECORDED" && <label className="text-xs font-medium">Correction reason<input aria-label={`Correction reason for ${row.student?.name || "student"}`} className="mt-1 block w-44 rounded border border-sage p-2" value={draft.reason || ""} onChange={(event) => updateDraft(row.applicationId, "reason", event.target.value)} maxLength={500} /></label>}
                  <button type="button" className="btn-secondary px-3 py-2 text-xs disabled:opacity-50" disabled={busyId === row.applicationId || (row.status !== "NOT_RECORDED" && (!draft.reason?.trim() || currentStatus === row.status))} onClick={() => save(row)}>{busyId === row.applicationId ? "Saving…" : row.status === "NOT_RECORDED" ? "Record" : "Correct"}</button>
                </div>}
              </div>
              {!readOnly && row.correctionHistory?.length > 0 && <details className="mt-3 text-xs"><summary className="cursor-pointer font-medium">Correction history ({row.correctionHistory.length})</summary><ul className="mt-2 space-y-1">{row.correctionHistory.map((item, index) => <li key={`${item.changedAt}-${index}`}>{item.previousStatus} → {item.newStatus} · {new Date(item.changedAt).toLocaleString()} · {item.reason}</li>)}</ul></details>}
            </article>;
          })}</div>}
    </section>
  );
}
