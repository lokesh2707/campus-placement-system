import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BriefcaseBusiness, CalendarDays, CheckCircle2, Clock3, FileText, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const money = (value) => value == null || value === "" ? "Not specified" : `₹${Number(value).toLocaleString("en-IN")}`;
const date = (value) => value ? new Date(value).toLocaleDateString() : "—";
const idOf = (value) => value && typeof value === "object" ? value._id : value;
const titleCase = (value = "") => value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const statusStyle = {
  DRAFT: "bg-slate-100 text-slate-700", ISSUED: "bg-blue-50 text-blue-700", ACCEPTED: "bg-emerald-50 text-emerald-700",
  DECLINED: "bg-rose-50 text-rose-700", REVOKED: "bg-orange-50 text-orange-700", EXPIRED: "bg-slate-100 text-slate-500",
};

async function api(path, token, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}`, ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "The request could not be completed.");
  return data;
}

export default function OffersPage() {
  const { token, user } = useAuth();
  const role = ({ SUPER_ADMIN: "admin", PLACEMENT_OFFICER: "placement_officer", RECRUITER: "recruiter", STUDENT: "student" })[user?.role] || user?.role;
  const isStudent = role === "student";
  const isRecruiter = role === "recruiter";
  const isMonitor = role === "placement_officer" || role === "admin";
  const [offers, setOffers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ applicationId: "", designation: "", ctc: "", details: "", expiryDate: "", expectedJoiningDate: "" });
  const [filters, setFilters] = useState({ status: "", joiningStatus: "", institute: "", company: "" });
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [filterOptions, setFilterOptions] = useState({ companies: [], institutes: [] });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (isStudent) {
        const [o, a] = await Promise.all([
          api("/api/applications/offers/me", token),
          api("/api/applications/me", token).catch(() => ({ applications: [] })),
        ]);
        setOffers(o.offers || []); setApplications(a.applications || []);
      } else if (isRecruiter) {
        const params = new URLSearchParams({ page: String(pagination.page), limit: "25" });
        const [o, a] = await Promise.all([api(`/api/applications/offers?${params}`, token), api("/api/recruiter/applications", token)]);
        setOffers(o.offers || []); setApplications(a.data || []); setPagination(o.pagination || { page: 1, limit: 25, total: (o.offers || []).length, pages: 1 });
      } else if (isMonitor) {
        const params = new URLSearchParams({ page: String(pagination.page), limit: "25" });
        if (filters.status) params.set("status", filters.status);
        if (filters.joiningStatus) params.set("joiningStatus", filters.joiningStatus);
        if (role === "admin" && filters.company) params.set("company", filters.company);
        if (role === "admin" && filters.institute) params.set("institute", filters.institute);
        const o = await api(`/api/applications/offers?${params}`, token);
        setOffers(o.offers || []); setApplications([]); setPagination(o.pagination || { page: 1, limit: 25, total: (o.offers || []).length, pages: 1 });
        setFilterOptions(o.filterOptions || { companies: [], institutes: [] });
      } else setOffers([]);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, isStudent, isRecruiter, isMonitor, role, pagination.page, filters]);

  useEffect(() => { load(); }, [load]);

  const appById = useMemo(() => new Map(applications.map((a) => [String(a._id), a])), [applications]);
  const eligible = useMemo(() => applications.filter((a) => a.status === "Selected" && !offers.some((o) => String(idOf(o.application)) === String(a._id))), [applications, offers]);
  const visibleOffers = offers;
  const companies = filterOptions.companies || [];
  const institutes = filterOptions.institutes || [];
  const setFilter = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPagination((current) => ({ ...current, page: 1 })); };

  const beginEdit = (offer) => {
    setEditing(offer); setForm({ applicationId: String(idOf(offer.application) || ""), designation: offer.designation || "", ctc: offer.compensation?.ctc ?? "", details: offer.compensation?.details || "", expiryDate: offer.expiryDate?.slice?.(0, 10) || "", expectedJoiningDate: offer.expectedJoiningDate?.slice?.(0, 10) || "" });
  };
  const resetForm = () => { setEditing(null); setForm({ applicationId: "", designation: "", ctc: "", details: "", expiryDate: "", expectedJoiningDate: "" }); };
  const saveDraft = async (event) => {
    event.preventDefault(); if (busy) return;
    setBusy("save"); setError(""); setMessage("");
    try {
      const body = { designation: form.designation.trim(), compensation: { ctc: Number(form.ctc || 0), details: form.details }, expiryDate: form.expiryDate || null, expectedJoiningDate: form.expectedJoiningDate || null };
      await api(editing ? `/api/applications/offers/${editing._id}` : `/api/applications/${form.applicationId}/offer`, token, { method: editing ? "PUT" : "POST", body: JSON.stringify(body) });
      setMessage(editing ? "Draft updated." : "Offer draft created."); resetForm(); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(""); }
  };
  const act = async (offer, action, body = {}) => {
    if (busy) return;
    setBusy(`${offer._id}:${action}`); setError(""); setMessage("");
    try {
      const routes = { issue: ["PUT", `/api/applications/offers/${offer._id}/issue`], revoke: ["PUT", `/api/applications/offers/${offer._id}/revoke`], respond: ["PUT", `/api/applications/offers/${offer._id}/respond`], joining: ["PUT", `/api/applications/offers/${offer._id}/joining`] };
      const [method, path] = routes[action];
      await api(path, token, { method, body: JSON.stringify(body) });
      setMessage(action === "respond" ? `Offer ${body.action === "ACCEPT" ? "accepted" : "declined"}.` : action === "joining" ? "Joining status saved." : `Offer ${action === "issue" ? "issued" : "revoked"}.`);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(""); }
  };
  const confirmRevoke = (offer) => { const reason = window.prompt("Enter a reason for revoking this offer (at least 5 characters):"); if (reason == null) return; if (reason.trim().length < 5) { setError("Enter a revocation reason of at least five characters."); return; } if (!window.confirm("Revoke this offer? The action cannot be undone.")) return; act(offer, "revoke", { reason: reason.trim() }); };
  const respondStudent = (offer, action) => { if (action === "DECLINE" && !window.confirm("Decline this offer? This decision resolves the related application and cannot be reversed.")) return; act(offer, "respond", { action, ...(action === "DECLINE" ? { reason: "Student declined offer" } : {}) }); };

  const heading = isStudent ? "My Offers" : isRecruiter ? "Offer Management" : "Offer Monitoring";
  const applicationName = (offer) => { const app = appById.get(String(idOf(offer.application))); return app?.student?.name || offer.student?.name || `Student ${String(idOf(offer.student) || "").slice(-6)}`; };
  const applicationJob = (offer) => appById.get(String(idOf(offer.application)))?.job?.title || offer.job?.title || (offer.job ? `Job ${String(idOf(offer.job)).slice(-6)}` : offer.designation || "Offer");
  const referenceLabel = (value, fallback) => value?.name || (value ? `${fallback} ${String(idOf(value)).slice(-6)}` : "");

  return <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <header className="mb-7 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"><div><p className="text-xs uppercase tracking-[.16em] text-teal font-semibold">Placement lifecycle</p><h1 className="mt-1 text-3xl font-display font-semibold text-ink">{heading}</h1><p className="mt-2 text-sm text-ink-muted">{isStudent ? "Review your offers and track joining details." : isRecruiter ? "Prepare and manage offers for your selected candidates." : "View offer and joining outcomes in your authorized scope."}</p></div><button onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-sage bg-white px-4 py-2 text-sm font-semibold hover:bg-teal-soft disabled:opacity-60"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/> Refresh</button></header>
    {message && <div role="status" className="mb-5 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={18}/>{message}</div>}
    {error && <div role="alert" className="mb-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={18}/>{error}</div>}

    {isRecruiter && <section className="panel mb-7 p-5"><div className="mb-4 flex items-center gap-2"><Plus size={18} className="text-teal"/><h2 className="font-display font-semibold">{editing ? "Edit offer draft" : "Create offer draft"}</h2></div>
      {eligible.length === 0 && !editing ? <p className="text-sm text-ink-muted">No selected applications are currently eligible for a new offer.</p> : <form onSubmit={saveDraft} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!editing && <label className="text-sm font-medium">Selected application<select required value={form.applicationId} onChange={(e)=>setForm({...form,applicationId:e.target.value})} className="mt-1 block w-full rounded-lg border border-sage bg-white p-2.5"><option value="">Choose candidate</option>{eligible.map((a)=><option key={a._id} value={a._id}>{a.student?.name || "Student"} · {a.job?.title || "Selected role"}</option>)}</select></label>}
        <label className="text-sm font-medium">Designation<input required maxLength={160} value={form.designation} onChange={(e)=>setForm({...form,designation:e.target.value})} className="mt-1 block w-full rounded-lg border border-sage p-2.5"/></label>
        <label className="text-sm font-medium">CTC (₹)<input type="number" min="0" step="any" value={form.ctc} onChange={(e)=>setForm({...form,ctc:e.target.value})} className="mt-1 block w-full rounded-lg border border-sage p-2.5"/></label>
        <label className="text-sm font-medium">Offer details<input maxLength={1000} value={form.details} onChange={(e)=>setForm({...form,details:e.target.value})} className="mt-1 block w-full rounded-lg border border-sage p-2.5"/></label>
        <label className="text-sm font-medium">Expiry date<input type="date" value={form.expiryDate} onChange={(e)=>setForm({...form,expiryDate:e.target.value})} className="mt-1 block w-full rounded-lg border border-sage p-2.5"/></label>
        <label className="text-sm font-medium">Expected joining date<input type="date" value={form.expectedJoiningDate} onChange={(e)=>setForm({...form,expectedJoiningDate:e.target.value})} className="mt-1 block w-full rounded-lg border border-sage p-2.5"/></label>
        <div className="flex items-end gap-2"><button disabled={!!busy} className="rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-deep disabled:opacity-50">{busy === "save" ? "Saving…" : "Save draft"}</button>{editing && <button type="button" onClick={resetForm} className="rounded-lg border border-sage px-4 py-2.5 text-sm">Cancel</button>}</div>
      </form>}
    </section>}

    {isMonitor && <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-semibold text-ink-muted">Offer status<select value={filters.status} onChange={(e)=>setFilter("status",e.target.value)} className="mt-1 block w-full rounded-lg border border-sage bg-white p-2.5 text-sm"><option value="">All statuses</option>{["DRAFT","ISSUED","ACCEPTED","DECLINED","REVOKED","EXPIRED"].map(s=><option key={s}>{s}</option>)}</select></label><label className="text-xs font-semibold text-ink-muted">Joining status<select value={filters.joiningStatus} onChange={(e)=>setFilter("joiningStatus",e.target.value)} className="mt-1 block w-full rounded-lg border border-sage bg-white p-2.5 text-sm"><option value="">All joining statuses</option>{["PENDING","JOINED","NOT_JOINED"].map(s=><option key={s}>{s}</option>)}</select></label>{role === "admin" && <><label className="text-xs font-semibold text-ink-muted">Company<select value={filters.company} onChange={(e)=>setFilter("company",e.target.value)} className="mt-1 block w-full rounded-lg border border-sage bg-white p-2.5 text-sm"><option value="">All companies</option>{companies.map((company)=><option key={company._id} value={company._id}>{company.name}</option>)}</select></label><label className="text-xs font-semibold text-ink-muted">Institute<select value={filters.institute} onChange={(e)=>setFilter("institute",e.target.value)} className="mt-1 block w-full rounded-lg border border-sage bg-white p-2.5 text-sm"><option value="">All institutes</option>{institutes.map((institute)=><option key={institute._id} value={institute._id}>{institute.name}</option>)}</select></label></>}</div>}

    {loading ? <div aria-label="Loading offers" className="panel animate-pulse p-10 text-center text-sm text-ink-muted">Loading offers…</div> : visibleOffers.length === 0 ? <div className="panel p-12 text-center"><FileText className="mx-auto mb-3 text-ink-muted"/><h2 className="font-semibold">No offers to show</h2><p className="mt-1 text-sm text-ink-muted">Offers will appear here when they are available.</p></div> : <div className="space-y-4">{visibleOffers.map((offer)=><article key={offer._id} className="panel p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{applicationJob(offer)}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[offer.status] || statusStyle.DRAFT}`}>{titleCase(offer.status)}</span></div><p className="mt-1 text-sm text-ink-muted">{isStudent ? referenceLabel(offer.company,"Company") : isRecruiter ? applicationName(offer) : `${applicationName(offer)} · ${referenceLabel(offer.company,"Company")}`}{(offer.institute?.name || (isMonitor && offer.institute)) ? ` · ${referenceLabel(offer.institute,"Institute")}` : ""}</p></div><div className="text-lg font-semibold text-ink">{money(offer.compensation?.ctc)} <span className="text-xs font-normal text-ink-muted">CTC</span></div></div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><Info icon={<CalendarDays size={15}/>} label="Issued" value={date(offer.issueDate)}/><Info icon={<Clock3 size={15}/>} label="Expires" value={date(offer.expiryDate)}/><Info icon={<BriefcaseBusiness size={15}/>} label="Joining status" value={titleCase(offer.joiningStatus)}/><Info icon={<CalendarDays size={15}/>} label="Joining date" value={date(offer.actualJoiningDate || offer.expectedJoiningDate)}/></div>
      {offer.compensation?.details && <p className="mt-3 text-sm text-ink-muted">{offer.compensation.details}</p>}
      {isStudent && <p className="mt-3 text-sm text-ink-muted">{offer.status === "EXPIRED" ? "This offer has expired." : offer.status === "REVOKED" ? "This offer was revoked by the recruiter." : offer.status === "DECLINED" ? "You declined this offer." : offer.status === "ACCEPTED" ? "You accepted this offer." : ""}</p>}
      {isRecruiter && <div className="mt-4 flex flex-wrap gap-2">{offer.status === "DRAFT" && <><button disabled={!!busy} onClick={()=>beginEdit(offer)} className="rounded-lg border border-sage px-3 py-2 text-sm font-semibold hover:bg-teal-soft">Edit draft</button><button disabled={!!busy} onClick={()=>act(offer,"issue")} className="rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === `${offer._id}:issue` ? "Issuing…" : "Issue offer"}</button></>}{["ISSUED","ACCEPTED"].includes(offer.status) && <button disabled={!!busy} onClick={()=>confirmRevoke(offer)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">Revoke offer</button>}{offer.status === "ACCEPTED" && offer.joiningStatus === "PENDING" && <><button disabled={!!busy} onClick={()=>{const actualJoiningDate=window.prompt("Actual joining date (YYYY-MM-DD):");if(actualJoiningDate)act(offer,"joining",{joiningStatus:"JOINED",actualJoiningDate});}} className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50">Record joined</button><button disabled={!!busy} onClick={()=>{const reason=window.prompt("Reason the candidate did not join (at least 5 characters):");if(reason?.trim().length>=5)act(offer,"joining",{joiningStatus:"NOT_JOINED",reason:reason.trim()});else if(reason!==null)setError("Enter a reason of at least five characters.");}} className="rounded-lg border border-sage px-3 py-2 text-sm font-semibold disabled:opacity-50">Record not joined</button></>}</div>}
      {isStudent && offer.status === "ISSUED" && <div className="mt-4 flex flex-wrap gap-2"><button disabled={!!busy} onClick={()=>respondStudent(offer,"ACCEPT")} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === `${offer._id}:respond` ? "Saving…" : "Accept offer"}</button><button disabled={!!busy} onClick={()=>respondStudent(offer,"DECLINE")} className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">Decline offer</button></div>}
    </article>)}</div>}
    {!isStudent && <div className="mt-5 flex flex-col gap-3 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between"><span>{pagination.total} offers · Page {pagination.page} of {Math.max(pagination.pages,1)}</span><div className="flex gap-2"><button disabled={loading||pagination.page<=1} onClick={()=>setPagination((current)=>({...current,page:current.page-1}))} className="rounded-lg border border-sage px-3 py-2 font-medium disabled:opacity-50">Previous</button><button disabled={loading||pagination.page>=pagination.pages} onClick={()=>setPagination((current)=>({...current,page:current.page+1}))} className="rounded-lg border border-sage px-3 py-2 font-medium disabled:opacity-50">Next</button></div></div>}
  </main>;
}

function Info({ icon, label, value }) { return <div className="rounded-lg bg-paper p-3"><div className="flex items-center gap-1.5 text-xs text-ink-muted">{icon}{label}</div><div className="mt-1 font-medium">{value}</div></div>; }
