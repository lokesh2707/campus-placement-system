import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { notificationDateTime, safeNotificationPath } from "../utils/notificationPresentation";

export default function NotificationsPage() {
  const { token } = useAuth(); const [rows, setRows] = useState([]); const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [unreadOnly, setUnreadOnly] = useState(false); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const request = async (path, options = {}) => { const r = await fetch(`/api/notifications${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } }); if (!r.ok) throw new Error("Unable to load notifications."); return r.json(); };
  const load = async () => { setLoading(true); try { const data = await request(`?page=${page}&limit=20&unreadOnly=${unreadOnly}`); setRows(data.notifications); setPages(Math.max(data.pages, 1)); setError(""); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [page, unreadOnly, token]);
  const markRead = async (id) => { try { await request(`/${id}/read`, { method: "PATCH" }); await load(); } catch (e) { setError(e.message); } };
  const markAll = async () => { try { await request("/read-all", { method: "PATCH" }); await load(); } catch (e) { setError(e.message); } };
  return <main className="max-w-4xl mx-auto px-4 py-8"><div className="flex flex-wrap items-center justify-between gap-3 mb-6"><div><h1 className="text-2xl font-bold text-ink">Notifications</h1><p className="text-sm text-ink-muted mt-1">Updates about your placement activity.</p></div><div className="flex items-center gap-4"><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={unreadOnly} onChange={(e) => { setPage(1); setUnreadOnly(e.target.checked); }} />Unread only</label><button onClick={markAll} className="text-sm font-semibold text-teal hover:underline">Mark all read</button></div></div>
    {loading && <p role="status" className="p-3 text-ink-muted">Loading notifications…</p>}
    {!loading && error && <p role="alert" className="p-3 rounded-lg bg-red-50 text-red-700">{error}</p>}
    {!loading && !error && rows.length === 0 && <div className="bg-white border border-sage rounded-xl p-8 text-center text-ink-muted">No notifications to show.</div>}
    {!loading && !error && <ul className="space-y-3">{rows.map((row) => { const time = notificationDateTime(row.createdAt); return <li key={row.id} className={`bg-white border border-sage rounded-xl p-4 flex gap-4 ${row.readAt ? "" : "ring-1 ring-teal/20"}`}><div className="flex-1 min-w-0"><p className="font-semibold text-ink break-words">{row.title}</p><p className="text-sm text-ink-muted mt-1 break-words">{row.message}</p><time dateTime={time.dateTime} className="block text-xs text-ink-muted mt-2">{time.label}</time></div><div className="flex flex-col items-end gap-2 shrink-0"><Link to={safeNotificationPath(row.actionPath)} onClick={() => { if (!row.readAt) void markRead(row.id); }} className="text-sm font-semibold text-teal">Open</Link>{!row.readAt && <button onClick={() => markRead(row.id)} className="text-xs text-ink-muted hover:text-teal">Mark read</button>}</div></li>; })}</ul>}
    {pages > 1 && <div className="flex justify-between mt-5"><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary disabled:opacity-50">Previous</button><span className="text-sm self-center">Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="btn-secondary disabled:opacity-50">Next</button></div>}
  </main>;
}
