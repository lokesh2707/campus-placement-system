import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Activity,
  AlertCircle,
  Briefcase,
  Building2,
  CheckCircle2,
  Filter,
  Users,
  XCircle,
} from "lucide-react";

const emptyTotals = {
  activeDrives: 0,
  totalJobPostings: 0,
  participatingCompanies: 0,
  totalApplicants: 0,
  eligible: 0,
  ineligible: 0,
  shortlisted: 0,
  interview: 0,
  selected: 0,
  rejected: 0,
  pendingOfferResolutions: 0,
  placedOutcomes: 0,
};

const RecruitmentMonitorPage = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totals, setTotals] = useState(emptyTotals);
  const [applications, setApplications] = useState([]);
  const [pendingOffers, setPendingOffers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [companies, setCompanies] = useState([]);
  const [drives, setDrives] = useState([]);
  const [filters, setFilters] = useState({
    batch: "",
    department: "",
    company: "",
    job: "",
    status: "",
    page: 1,
  });

  const authHeaders = { Authorization: `Bearer ${token}` };

  const loadLookups = useCallback(async () => {
    try {
      const [cRes, dRes] = await Promise.all([
        fetch("/api/officer/authorized-companies", { headers: authHeaders }),
        fetch("/api/officer/drives?limit=100", { headers: authHeaders }),
      ]);
      const cData = await cRes.json();
      const dData = await dRes.json();
      if (cData.success) setCompanies(cData.data || []);
      if (dData.success) setDrives(dData.data || []);
    } catch {
      /* lookups optional */
    }
  }, [token]);

  const loadMonitor = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filters.batch) params.set("batch", filters.batch);
      if (filters.department) params.set("department", filters.department);
      if (filters.company) params.set("company", filters.company);
      if (filters.job) params.set("job", filters.job);
      if (filters.status) params.set("status", filters.status);
      params.set("page", String(filters.page || 1));
      params.set("limit", "25");

      const res = await fetch(`/api/officer/recruitment-monitor?${params}`, {
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load monitoring data");
      setTotals(data.totals || emptyTotals);
      setApplications(data.applications || []);
      setPendingOffers(data.pendingOffers || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      setError(err.message);
      setTotals(emptyTotals);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [token, filters]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    loadMonitor();
  }, [loadMonitor]);

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: key === "page" ? value : 1 }));
  };

  const cards = [
    { label: "Active drives", value: totals.activeDrives, icon: Briefcase },
    { label: "Job postings", value: totals.totalJobPostings, icon: Briefcase },
    { label: "Companies", value: totals.participatingCompanies, icon: Building2 },
    { label: "Applicants", value: totals.totalApplicants, icon: Users },
    { label: "Eligible", value: totals.eligible, icon: CheckCircle2 },
    { label: "Ineligible", value: totals.ineligible, icon: XCircle },
    { label: "Shortlisted", value: totals.shortlisted, icon: Activity },
    { label: "Interview", value: totals.interview, icon: Activity },
    { label: "Selected", value: totals.selected, icon: CheckCircle2 },
    { label: "Rejected", value: totals.rejected, icon: XCircle },
    { label: "Pending offers", value: totals.pendingOfferResolutions, icon: AlertCircle },
    { label: "Placed outcomes", value: totals.placedOutcomes, icon: CheckCircle2 },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold text-ink tracking-tight">
            Recruitment monitoring
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Live institute-scoped counts from applications, drives, and offer resolutions.
          </p>
        </div>
        <Link
          to="/placement-officer/dashboard"
          className="text-sm font-semibold text-teal hover:underline"
        >
          Back to dashboard
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="panel p-4 mb-6">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-ink">
          <Filter className="w-4 h-4 text-teal" />
          Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="number"
            placeholder="Batch"
            value={filters.batch}
            onChange={(e) => setFilter("batch", e.target.value)}
            className="px-3 py-2 rounded-xl border border-sage text-sm"
          />
          <input
            type="text"
            placeholder="Department / branch"
            value={filters.department}
            onChange={(e) => setFilter("department", e.target.value)}
            className="px-3 py-2 rounded-xl border border-sage text-sm"
          />
          <select
            value={filters.company}
            onChange={(e) => setFilter("company", e.target.value)}
            className="px-3 py-2 rounded-xl border border-sage text-sm"
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={filters.job}
            onChange={(e) => setFilter("job", e.target.value)}
            className="px-3 py-2 rounded-xl border border-sage text-sm"
          >
            <option value="">All jobs</option>
            {drives.map((d) => (
              <option key={d._id} value={d._id}>
                {d.title}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
            className="px-3 py-2 rounded-xl border border-sage text-sm"
          >
            <option value="">All statuses</option>
            {["Applied", "Shortlisted", "Interview", "Selected", "Rejected"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="panel p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-muted">{c.label}</span>
                <Icon className="w-4 h-4 text-teal" />
              </div>
              <div className="text-2xl font-semibold text-ink">
                {loading ? "—" : c.value}
              </div>
            </div>
          );
        })}
      </div>

      {pendingOffers.length > 0 && (
        <div className="panel p-4 mb-6 border border-amber-200 bg-amber-50/40">
          <h2 className="text-sm font-semibold text-ink mb-2">
            Pending offer resolutions ({pendingOffers.length})
          </h2>
          <ul className="space-y-2 text-xs text-ink">
            {pendingOffers.map((p) => (
              <li key={p.applicationId} className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="font-medium">{p.studentName}</span>
                <span className="text-ink-muted">{p.jobTitle}</span>
                <span className="text-ink-muted">{p.companyName}</span>
                <span className="text-amber-800">PENDING</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-sage flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Applications</h2>
          <span className="text-xs text-ink-muted">
            {pagination.total} matching · page {pagination.page} of {pagination.pages}
          </span>
        </div>
        {loading ? (
          <div className="p-8 text-sm text-ink-muted">Loading institute recruitment data…</div>
        ) : applications.length === 0 ? (
          <div className="p-8 text-sm text-ink-muted">
            No applications match the current filters for your institute.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-paper text-xs uppercase text-ink-muted">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Student</th>
                  <th className="text-left px-4 py-2 font-semibold">Job</th>
                  <th className="text-left px-4 py-2 font-semibold">Status</th>
                  <th className="text-left px-4 py-2 font-semibold">Eligibility</th>
                  <th className="text-left px-4 py-2 font-semibold">Score</th>
                  <th className="text-left px-4 py-2 font-semibold">Placement</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((row) => (
                  <tr key={row.id} className="border-t border-sage">
                    <td className="px-4 py-2">
                      <div className="font-medium text-ink">{row.studentName}</div>
                      <div className="text-xs text-ink-muted">
                        {row.rollNumber} · {row.department} · {row.batch}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div>{row.jobTitle}</div>
                      <div className="text-xs text-ink-muted">{row.companyName}</div>
                    </td>
                    <td className="px-4 py-2">{row.status}</td>
                    <td className="px-4 py-2">{row.eligibilityStatus || "—"}</td>
                    <td className="px-4 py-2">
                      {row.matchScore != null ? `${row.matchScore}%` : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {row.pendingOffer ? (
                        <span className="text-amber-700 font-medium">Offer pending</span>
                      ) : (
                        row.placementStatus || "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pagination.pages > 1 && (
          <div className="px-4 py-3 border-t border-sage flex gap-2 justify-end">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setFilter("page", pagination.page - 1)}
              className="px-3 py-1.5 text-xs rounded-lg border border-sage disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.pages}
              onClick={() => setFilter("page", pagination.page + 1)}
              className="px-3 py-1.5 text-xs rounded-lg border border-sage disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecruitmentMonitorPage;
