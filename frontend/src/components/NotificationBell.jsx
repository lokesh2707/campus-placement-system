import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { notificationDateTime, safeNotificationPath } from "../utils/notificationPresentation";

export default function NotificationBell() {
  const { token } = useAuth(); const [count, setCount] = useState(0); const [open, setOpen] = useState(false); const [items, setItems] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const root = useRef(null);
  const request = async (path, options = {}) => {
    const response = await fetch(`/api/notifications${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
    if (!response.ok) throw new Error("Notifications could not be loaded."); return response.json();
  };
  const refreshCount = () => request("/unread-count").then((data) => setCount(data.count)).catch(() => {});
  useEffect(() => { if (token) refreshCount(); }, [token]);
  useEffect(() => { const key = (event) => { if (event.key === "Escape") setOpen(false); }; const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); }; document.addEventListener("keydown", key); document.addEventListener("mousedown", outside); return () => { document.removeEventListener("keydown", key); document.removeEventListener("mousedown", outside); }; }, []);
  const toggle = async () => { const next = !open; setOpen(next); if (next) { setLoading(true); setError(""); try { const data = await request("?limit=5"); setItems(data.notifications); } catch (_) { setItems([]); setError("Notifications could not be loaded."); } finally { setLoading(false); } } };
  const markRead = async (item) => { try { await request(`/${item.id}/read`, { method: "PATCH" }); setItems((rows) => rows.map((row) => row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row)); refreshCount(); } catch (_) { setError("Notification could not be marked as read."); } };
  const markAllRead = async () => { try { await request("/read-all", { method: "PATCH" }); setItems((rows) => rows.map((row) => ({ ...row, readAt: row.readAt || new Date().toISOString() }))); setCount(0); } catch (_) { setError("Notifications could not be marked as read."); } };
  return <div className="relative" ref={root}>
    <button type="button" onClick={toggle} aria-label={`Notifications${count ? `, ${count} unread` : ""}`} aria-expanded={open} className="relative inline-flex items-center justify-center h-9 w-9 text-ink-muted hover:text-teal-deep hover:bg-teal-soft rounded-lg"><Bell className="w-5 h-5" />{count > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[10px] leading-4">{count > 99 ? "99+" : count}</span>}</button>
    {open && <section aria-label="Recent notifications" className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-sage rounded-xl shadow-xl z-50 p-3"><div className="flex justify-between items-center px-2 pb-2"><h2 className="font-semibold text-ink">Notifications</h2>{count > 0 && <button onClick={markAllRead} className="text-xs font-semibold text-teal">Mark all read</button>}</div>{loading ? <p role="status" className="text-sm text-ink-muted px-2 py-3">Loading notifications…</p> : error ? <p role="alert" className="text-sm text-red-700 px-2 py-3">{error}</p> : items.length ? items.map((item) => { const time = notificationDateTime(item.createdAt); return <div key={item.id} className={`p-2 rounded-lg ${item.readAt ? "" : "bg-teal-soft/60"}`}><Link onClick={() => { if (!item.readAt) void markRead(item); setOpen(false); }} to={safeNotificationPath(item.actionPath)} className="block break-words"><span className="font-medium text-sm">{item.title}</span><span className="block text-xs text-ink-muted mt-1">{item.message}</span><time className="block text-[11px] text-ink-muted mt-1" dateTime={time.dateTime}>{time.label}</time></Link></div>; }) : <p className="text-sm text-ink-muted px-2 py-3">You’re all caught up.</p>}<Link to="/notifications" onClick={() => setOpen(false)} className="block text-center text-sm font-semibold text-teal mt-2 pt-2 border-t border-sage">View all</Link></section>}
  </div>;
}
