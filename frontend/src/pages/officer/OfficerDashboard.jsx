import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  BarChart3,
  Award,
  Lightbulb,
  Building2,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PlusCircle,
  UserPlus,
  KeyRound,
  Copy,
  Check,
  X,
  ShieldCheck,
  Building,
  Briefcase,
  Clock,
  Users,
  Plus,
} from "lucide-react";
import PasswordInput from "../../components/PasswordInput";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

const OfficerDashboard = () => {
  const { token } = useAuth();
  const [overview, setOverview] = useState(null);
  const [skillStats, setSkillStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Corporate Partners & Campus Recruiter States
  const [activePartnerTab, setActivePartnerTab] = useState("companies"); // "companies" | "recruiters"
  const [companies, setCompanies] = useState([]);
  const [companyFilter, setCompanyFilter] = useState("all");
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companyMsg, setCompanyMsg] = useState("");
  const [companyErr, setCompanyErr] = useState("");
  const [companyBusy, setCompanyBusy] = useState(null);
  const [recruiters, setRecruiters] = useState([]);
  const [recruitersLoading, setRecruitersLoading] = useState(false);
  const [exportBusy, setExportBusy] = useState("");
  const [exportErr, setExportErr] = useState("");

  // Register Company Modal State (Officer)
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [compName, setCompName] = useState("");
  const [compIndustry, setCompIndustry] = useState("Information Technology");
  const [compWebsite, setCompWebsite] = useState("");
  const [compLocation, setCompLocation] = useState("");
  const [compDescription, setCompDescription] = useState("");
  const [submittingCompany, setSubmittingCompany] = useState(false);

  // Campus Recruitment Drives State
  const [drives, setDrives] = useState([]);
  const [drivesLoading, setDrivesLoading] = useState(true);
  const [driveFilter, setDriveFilter] = useState("all");

  // Recruiter Provisioning States (Officer)
  const [showRecruiterModal, setShowRecruiterModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [recruiterName, setRecruiterName] = useState("");
  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [recruiterPhone, setRecruiterPhone] = useState("");
  const [recruiterDesignation, setRecruiterDesignation] = useState("University Hiring Lead");
  const [recruiterPassword, setRecruiterPassword] = useState("");
  const [submittingRecruiter, setSubmittingRecruiter] = useState(false);

  // Credential Modal State
  const [credentialModal, setCredentialModal] = useState({
    isOpen: false,
    name: "",
    email: "",
    role: "",
    temporaryPassword: "",
  });
  const [copiedCredential, setCopiedCredential] = useState(false);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const downloadCsv = async (url, fallbackName) => {
    setExportErr("");
    setExportBusy(url);
    try {
      const res = await fetch(url, { headers: authHeaders });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Export failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] || fallbackName;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setExportErr(err.message);
    } finally {
      setExportBusy("");
    }
  };

  const fetchCompanies = useCallback(async () => {
    setCompaniesLoading(true);
    setCompanyErr("");
    try {
      const res = await fetch("/api/officer/verified-companies", {
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load verified companies");
      setCompanies(data.data || []);
    } catch (err) {
      setCompanyErr(err.message);
      setCompanies([]);
    } finally {
      setCompaniesLoading(false);
    }
  }, [token]);

  const fetchDrives = useCallback(async () => {
    setDrivesLoading(true);
    try {
      const res = await fetch("/api/officer/drives", { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setDrives(data.data || []);
      }
    } catch (err) {
      console.error("Failed to load recruitment drives:", err);
    } finally {
      setDrivesLoading(false);
    }
  }, [token]);

  const fetchRecruiters = useCallback(async () => {
    setRecruitersLoading(true);
    try {
      const res = await fetch("/api/officer/recruiters", { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setRecruiters(data.data || []);
      }
    } catch (err) {
      console.error("Failed to load campus recruiters:", err);
    } finally {
      setRecruitersLoading(false);
    }
  }, [token]);

  // Create new company and authorize for officer's campus
  const handleCreateCompanyOfficer = async (e) => {
    e.preventDefault();
    setCompanyMsg("");
    setCompanyErr("");
    setSubmittingCompany(true);
    try {
      const res = await fetch("/api/officer/companies", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: compName,
          industry: compIndustry,
          website: compWebsite,
          location: compLocation,
          description: compDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to register company");
      setShowCompanyModal(false);
      setCompName("");
      setCompIndustry("Information Technology");
      setCompWebsite("");
      setCompLocation("");
      setCompDescription("");
      setCompanyMsg(data.message || "Company registered and authorized for your campus successfully!");
      await fetchCompanies();
      // Auto-open recruiter modal for the newly registered company
      if (data.data) {
        openProvisionRecruiter(data.data);
      }
    } catch (err) {
      setCompanyErr(err.message);
    } finally {
      setSubmittingCompany(false);
    }
  };

  // Authorize verified company for this officer's campus
  const handleAuthorize = async (company) => {
    setCompanyBusy(company._id);
    setCompanyMsg("");
    setCompanyErr("");
    try {
      const res = await fetch(`/api/officer/companies/${company._id}/authorize`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Authorization failed");
      setCompanyMsg(data.message || `Company '${company.name}' authorized for your campus!`);
      await fetchCompanies();
    } catch (err) {
      setCompanyErr(err.message);
    } finally {
      setCompanyBusy(null);
    }
  };

  // Revoke authorization for this campus
  const handleRevoke = async (company) => {
    if (!window.confirm(`Revoke campus placement authorization for '${company.name}'? Existing jobs and applications will be preserved.`)) {
      return;
    }
    setCompanyBusy(company._id);
    setCompanyMsg("");
    setCompanyErr("");
    try {
      const res = await fetch(`/api/officer/companies/${company._id}/authorize`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Revocation failed");
      setCompanyMsg(data.message || "Company authorization revoked for your campus.");
      await fetchCompanies();
    } catch (err) {
      setCompanyErr(err.message);
    } finally {
      setCompanyBusy(null);
    }
  };

  // Open recruiter provisioning modal
  const openProvisionRecruiter = (company = null) => {
    setSelectedCompany(company);
    setRecruiterName("");
    setRecruiterEmail("");
    setRecruiterPhone("");
    setRecruiterDesignation("University Hiring Lead");
    setRecruiterPassword("");
    setShowRecruiterModal(true);
  };

  // Submit recruiter provisioning
  const handleProvisionRecruiterOfficer = async (e) => {
    e.preventDefault();
    if (!selectedCompany?._id) {
      setCompanyErr("Please select a partner company to provision a recruiter for.");
      return;
    }
    setCompanyMsg("");
    setCompanyErr("");
    setSubmittingRecruiter(true);
    try {
      const res = await fetch("/api/officer/recruiters", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: recruiterName,
          email: recruiterEmail,
          companyId: selectedCompany._id,
          phone: recruiterPhone,
          designation: recruiterDesignation,
          password: recruiterPassword || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to provision recruiter");
      setShowRecruiterModal(false);
      if (data.data?.temporaryPassword) {
        setCredentialModal({
          isOpen: true,
          name: data.data.user.name,
          email: data.data.user.email,
          role: data.data.user.role,
          temporaryPassword: data.data.temporaryPassword,
        });
      }
      setCompanyMsg(data.message || "Recruiter account provisioned successfully!");
      await fetchRecruiters();
      await fetchCompanies();
    } catch (err) {
      setCompanyErr(err.message);
    } finally {
      setSubmittingRecruiter(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCredential(true);
    setTimeout(() => setCopiedCredential(false), 2500);
  };

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [overviewRes, skillRes] = await Promise.all([
          fetch("/api/analytics/overview", {
            headers: authHeaders,
          }),
          fetch("/api/analytics/skills", {
            headers: authHeaders,
          }),
        ]);

        const oData = await overviewRes.json();
        const sData = await skillRes.json();

        if (oData.success) setOverview(oData.data);
        if (sData.success) setSkillStats(sData.data);
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [token]);

  useEffect(() => {
    fetchCompanies();
    fetchDrives();
    fetchRecruiters();
  }, [fetchCompanies, fetchDrives, fetchRecruiters]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 animate-pulse space-y-6">
        <div className="h-8 bg-[var(--color-border)] rounded w-1/4"></div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <div className="h-28 bg-[var(--color-border)] rounded-2xl"></div>
          <div className="h-28 bg-[var(--color-border)] rounded-2xl"></div>
          <div className="h-28 bg-[var(--color-border)] rounded-2xl"></div>
          <div className="h-28 bg-[var(--color-border)] rounded-2xl"></div>
        </div>
      </div>
    );
  }

  // Format stage distribution data for Recharts
  const stageChartData = overview?.stageDistribution
    ? Object.entries(overview.stageDistribution).map(([stage, count]) => ({
        stage,
        count,
      }))
    : [];

  const STAGE_COLORS = {
    Applied: "#0B5F5C",
    "Under Review": "#3D8B87",
    Assessment: "#C4A35A",
    Interview: "#084845",
    Selected: "#2F7A4A",
    Rejected: "#B4534B",
    Withdrawn: "#8A9A96",
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-ink tracking-tight">
            Campus Placement Analytics & Intelligence
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Live institutional metrics, company verification, and placement report exports.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full lg:w-auto">
          <button
            type="button"
            disabled={!!exportBusy}
            onClick={() =>
              downloadCsv("/api/analytics/export/students", "student-placement-report.csv")
            }
            className="btn-primary w-full sm:w-auto px-4 py-2 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exportBusy.includes("students") ? "Exporting..." : "Export Student Report"}
          </button>
          <button
            type="button"
            disabled={!!exportBusy}
            onClick={() =>
              downloadCsv("/api/analytics/export/placements", "placement-outcomes-report.csv")
            }
            className="btn-secondary w-full sm:w-auto px-4 py-2 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exportBusy.includes("placements") ? "Exporting..." : "Export Placement Report"}
          </button>
        </div>
      </div>

      {exportErr && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{exportErr}</span>
        </div>
      )}

      {/* Corporate Partners & Campus Recruiter Governance */}
      <div className="panel p-6 shadow-xs mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-teal" />
              <h2 className="font-display text-base font-semibold text-ink">
                Corporate Partners & Recruiter Governance
              </h2>
            </div>
            <p className="text-xs text-ink-muted mt-1">
              Register enterprise employers, authorize corporate hiring partners, and provision recruiter credentials for your campus.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCompanyModal(true)}
              className="btn-primary py-2 px-3 text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Register Company
            </button>
            <button
              type="button"
              onClick={() => openProvisionRecruiter(null)}
              className="btn-secondary py-2 px-3 text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Provision Recruiter
            </button>
          </div>
        </div>

        {/* View Selection Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-2 border-b border-sage">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActivePartnerTab("companies")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                activePartnerTab === "companies"
                  ? "bg-teal text-white shadow-xs"
                  : "bg-paper text-ink hover:bg-teal-soft"
              }`}
            >
              Partner Companies ({companies.length})
            </button>
            <button
              type="button"
              onClick={() => setActivePartnerTab("recruiters")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                activePartnerTab === "recruiters"
                  ? "bg-teal text-white shadow-xs"
                  : "bg-paper text-ink hover:bg-teal-soft"
              }`}
            >
              Campus Recruiters ({recruiters.length})
            </button>
          </div>

          {activePartnerTab === "companies" && (
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="input-campus max-w-xs text-xs"
            >
              <option value="all">All Verified Companies</option>
              <option value="authorized">Authorized on My Campus</option>
              <option value="unauthorized">Not Yet Authorized</option>
            </select>
          )}
        </div>

        {companyMsg && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
            <span>{companyMsg}</span>
            <button onClick={() => setCompanyMsg("")} className="text-emerald-700 hover:text-emerald-900 text-xs">✕</button>
          </div>
        )}
        {companyErr && (
          <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
            <span>{companyErr}</span>
            <button onClick={() => setCompanyErr("")} className="text-red-700 hover:text-red-900 text-xs">✕</button>
          </div>
        )}

        {activePartnerTab === "recruiters" ? (
          recruitersLoading ? (
            <div className="py-10 text-center text-ink-muted text-sm animate-pulse">
              Loading campus recruiters...
            </div>
          ) : recruiters.length === 0 ? (
            <div className="py-10 text-center text-ink-muted text-sm space-y-2">
              <UserPlus className="w-8 h-8 text-teal/40 mx-auto" />
              <p className="font-semibold text-ink">No recruiters provisioned yet for your campus.</p>
              <p className="text-xs max-w-md mx-auto">
                Provision recruiter logins for authorized corporate partners so they can launch drives and review candidates.
              </p>
              <button
                type="button"
                onClick={() => openProvisionRecruiter(null)}
                className="btn-primary py-2 px-4 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer mt-2"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Provision First Recruiter
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-paper text-ink-muted uppercase font-semibold border-b border-sage">
                  <tr>
                    <th className="py-3 px-3">Recruiter Profile</th>
                    <th className="py-3 px-3">Hiring Enterprise</th>
                    <th className="py-3 px-3">Designation & Role</th>
                    <th className="py-3 px-3">Contact Phone</th>
                    <th className="py-3 px-3">Account Security Status</th>
                    <th className="py-3 px-3">Provisioned On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {recruiters.map((rec) => (
                    <tr key={rec._id} className="hover:bg-paper">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-ink">{rec.name}</div>
                        <div className="text-[11px] text-teal mt-0.5">{rec.email}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-ink flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-teal" />
                          <span>{rec.company?.name || "Corporate Enterprise"}</span>
                        </div>
                        {rec.company?.industry && (
                          <div className="text-[10px] text-ink-muted">{rec.company.industry}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-ink">
                        <div>{rec.designation || "Recruiter"}</div>
                        <span className="text-[10px] uppercase font-bold text-ink-muted tracking-wider">
                          {rec.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-ink-muted">
                        {rec.phone || "—"}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              rec.isActive
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {rec.isActive ? "ACTIVE" : "INACTIVE"}
                          </span>
                          {rec.mustChangePassword && (
                            <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-amber-100 text-amber-800">
                              PENDING FIRST LOGIN
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-ink-muted">
                        {rec.createdAt ? new Date(rec.createdAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : companiesLoading ? (
          <div className="py-10 text-center text-ink-muted text-sm animate-pulse">
            Loading corporate partners...
          </div>
        ) : companies.length === 0 ? (
          <div className="py-10 text-center text-ink-muted text-sm space-y-3">
            <Building2 className="w-10 h-10 text-teal/40 mx-auto" />
            <p className="font-semibold text-ink">No corporate partners found yet.</p>
            <p className="text-xs max-w-md mx-auto">
              Register your campus's corporate hiring partners to schedule recruitment drives and provision recruiter logins.
            </p>
            <button
              type="button"
              onClick={() => setShowCompanyModal(true)}
              className="btn-primary py-2 px-4 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Register First Partner Company
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper text-ink-muted uppercase font-semibold border-b border-sage">
                <tr>
                  <th className="py-3 px-3">Company</th>
                  <th className="py-3 px-3">Industry & Location</th>
                  <th className="py-3 px-3">Platform Verification</th>
                  <th className="py-3 px-3">Campus Placement Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {companies
                  .filter((c) => {
                    if (companyFilter === "authorized") return c.isAuthorizedForMyInstitute;
                    if (companyFilter === "unauthorized") return !c.isAuthorizedForMyInstitute;
                    return true;
                  })
                  .map((c) => (
                    <tr key={c._id} className="hover:bg-paper">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-ink flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-teal" />
                          <span>{c.name}</span>
                        </div>
                        {c.website && (
                          <a
                            href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-teal hover:underline block mt-0.5"
                          >
                            {c.website}
                          </a>
                        )}
                      </td>
                      <td className="py-3 px-3 text-ink-muted">
                        <div>{c.industry || "General Industry"}</div>
                        <div className="text-[11px] text-ink-muted/80">{c.location || "Location not specified"}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-800">
                          <ShieldCheck className="w-3 h-3 text-emerald-700" />
                          Verified
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {c.isAuthorizedForMyInstitute ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-teal-soft text-teal-deep border border-teal/20">
                            <CheckCircle2 className="w-3 h-3 text-teal" />
                            Authorized for Campus
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-slate-100 text-slate-700">
                            Not Authorized
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {c.isAuthorizedForMyInstitute ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openProvisionRecruiter(c)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal text-white text-[11px] font-semibold hover:bg-teal-deep transition shadow-xs cursor-pointer"
                                title="Issue recruiter login for this company"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                Add Recruiter
                              </button>
                              <button
                                type="button"
                                disabled={companyBusy === c._id}
                                onClick={() => handleRevoke(c)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-[11px] font-semibold disabled:opacity-50 transition cursor-pointer"
                                title="Revoke campus authorization"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Revoke
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={companyBusy === c._id}
                              onClick={() => handleAuthorize(c)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal hover:bg-teal-deep text-white text-[11px] font-semibold disabled:opacity-50 transition shadow-xs cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Authorize for Campus
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Campus Recruitment Drives & Pipeline Monitoring */}
      <div className="panel p-6 shadow-xs mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-teal" />
              <h2 className="font-display text-base font-semibold text-ink">
                Campus Recruitment Drives & Pipeline Monitoring
              </h2>
            </div>
            <p className="text-xs text-ink-muted mt-1">
              Active recruitment openings for your campus from authorized corporate partners. Track applicant volume and stage progress.
            </p>
          </div>
          <select
            value={driveFilter}
            onChange={(e) => setDriveFilter(e.target.value)}
            className="input-campus max-w-xs text-xs"
          >
            <option value="all">All Campus Drives</option>
            <option value="open">Open Drives Only</option>
            <option value="closed">Closed Drives</option>
          </select>
        </div>

        {drivesLoading ? (
          <div className="py-10 text-center text-ink-muted text-sm animate-pulse">
            Loading recruitment drives...
          </div>
        ) : drives.length === 0 ? (
          <div className="py-10 text-center text-ink-muted text-sm space-y-1">
            <p className="font-semibold text-ink">No recruitment drives currently scheduled for your campus.</p>
            <p className="text-xs">Authorize verified companies above so their recruiters can launch placement drives.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper text-ink-muted uppercase font-semibold border-b border-sage">
                <tr>
                  <th className="py-3 px-3">Recruitment Drive</th>
                  <th className="py-3 px-3">Eligibility Requirements</th>
                  <th className="py-3 px-3">Status & Openings</th>
                  <th className="py-3 px-3">Campus Candidates</th>
                  <th className="py-3 px-3">Recruitment Pipeline Breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {drives
                  .filter((d) => {
                    if (driveFilter === "open") return d.status === "open";
                    if (driveFilter === "closed") return d.status === "closed";
                    return true;
                  })
                  .map((drive) => (
                    <tr key={drive._id} className="hover:bg-paper">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-ink text-sm">{drive.title}</div>
                        <div className="text-[11px] text-teal font-medium flex items-center gap-1 mt-0.5">
                          <Building className="w-3 h-3" />
                          <span>{drive.company?.name}</span>
                        </div>
                        <div className="text-[11px] text-ink-muted mt-0.5">{drive.location} • {drive.employmentType}</div>
                      </td>
                      <td className="py-3 px-3 text-ink-muted">
                        <div>Min CGPA: <strong className="text-ink">{drive.eligibilityCriteria?.minCgpa ?? 0}</strong></div>
                        <div>Max Backlogs: <strong className="text-ink">{drive.eligibilityCriteria?.maxBacklogs ?? 0}</strong></div>
                        <div className="text-[10px] text-ink-muted">
                          Branches: {drive.eligibilityCriteria?.allowedDepartments?.length > 0
                            ? drive.eligibilityCriteria.allowedDepartments.slice(0, 2).join(", ") + (drive.eligibilityCriteria.allowedDepartments.length > 2 ? "..." : "")
                            : "All Branches"}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              drive.status === "open"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {drive.status ? drive.status.toUpperCase() : "OPEN"}
                          </span>
                          {drive.vacancies && (
                            <span className="text-[11px] font-semibold text-ink">
                              {drive.vacancies} opening{drive.vacancies > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {drive.deadline && (
                          <div className="text-[10px] text-ink-muted flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" /> Ends {new Date(drive.deadline).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-teal text-sm flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {drive.instituteApplicationCount ?? 0}
                        </span>
                        <span className="text-[10px] text-ink-muted">Applications</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-blue-50 text-blue-800 border border-blue-200">
                            Applied: {drive.stageBreakdown?.Applied ?? 0}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-teal-soft text-teal-deep border border-teal/20">
                            Shortlisted: {drive.stageBreakdown?.Shortlisted ?? 0}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-200">
                            Interview: {drive.stageBreakdown?.Interview ?? 0}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                            Selected: {drive.stageBreakdown?.Selected ?? 0}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="panel p-5 shadow-xs">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Total Students</div>
          <div className="mt-2 text-2xl font-semibold text-ink">{overview?.summary?.totalStudents || 0}</div>
          <div className="text-xs text-ink-muted mt-0.5">Registered candidates</div>
        </div>

        <div className="panel p-5 shadow-xs">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Active Openings</div>
          <div className="mt-2 text-2xl font-semibold text-ink">{overview?.summary?.activeJobs || 0}</div>
          <div className="text-xs text-ink-muted mt-0.5">Open recruitment drives</div>
        </div>

        <div className="panel p-5 shadow-xs">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Total Applications</div>
          <div className="mt-2 text-2xl font-semibold text-ink">{overview?.summary?.totalApplications || 0}</div>
          <div className="text-xs text-ink-muted mt-0.5">Submitted across drives</div>
        </div>

        <div className="panel p-5 shadow-xs">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Placed Candidates</div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">{overview?.summary?.placedStudents || 0}</div>
          <div className="text-xs text-ink-muted mt-0.5">Offers extended</div>
        </div>

        <div className="panel p-5 shadow-xs">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Placement Rate</div>
          <div className="mt-2 text-2xl font-black text-teal">
            {overview?.summary?.placementRate || 0}%
          </div>
          <div className="text-xs text-ink-muted mt-0.5">Institutional conversion</div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Recruitment Stage Distribution Chart */}
        <div className="panel p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-teal" />
            <h2 className="text-base font-semibold text-ink">
              Recruitment Stage Pipeline
            </h2>
          </div>

          {stageChartData.length === 0 ? (
            <div className="text-center py-16 text-ink-muted text-sm">No applications recorded yet.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageChartData}>
                  <XAxis dataKey="stage" stroke="#4a5f5c" fontSize={11} />
                  <YAxis stroke="#4a5f5c" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid #d7e0dc", fontSize: "12px", background: "#faf8f4" }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {stageChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STAGE_COLORS[entry.stage] || "#0B5F5C"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Department Placement Breakdown */}
        <div className="panel p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-teal" />
            <h2 className="text-base font-semibold text-ink">
              Department Placement Performance
            </h2>
          </div>

          {!overview?.departmentStats || overview.departmentStats.length === 0 ? (
            <div className="text-center py-16 text-ink-muted text-sm">No department data available.</div>
          ) : (
            <div className="space-y-4">
              {overview.departmentStats.map((dept) => {
                const rate = dept.total > 0 ? Math.round((dept.placed / dept.total) * 100) : 0;
                return (
                  <div key={dept.department} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-ink">
                      <span>{dept.department}</span>
                      <span>{dept.placed} / {dept.total} Placed ({rate}%)</span>
                    </div>
                    <div className="w-full bg-teal-soft h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-teal h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${rate}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Institutional Skill Gaps Card */}
      <div className="panel p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-semibold text-ink">
            Institutional Skill Gaps (High Employer Demand vs. Low Student Supply)
          </h2>
        </div>

        {!skillStats?.skillGaps || skillStats.skillGaps.length === 0 ? (
          <div className="text-center py-10 text-ink-muted text-sm">
            Insufficient job data to compute skill supply gaps.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper text-ink-muted uppercase font-semibold border-b border-sage">
                <tr>
                  <th className="py-3 px-4">Technology Skill</th>
                  <th className="py-3 px-4">Job Demand (Open Roles)</th>
                  <th className="py-3 px-4">Student Supply (Profiles)</th>
                  <th className="py-3 px-4">Net Talent Gap</th>
                  <th className="py-3 px-4">Recommended Placement Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {skillStats.skillGaps.map((item) => (
                  <tr key={item.skill} className="hover:bg-paper">
                    <td className="py-3 px-4 font-semibold text-ink">{item.skill}</td>
                    <td className="py-3 px-4 text-ink-muted">{item.jobDemand} jobs</td>
                    <td className="py-3 px-4 text-ink-muted">{item.studentSupply} students</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-md font-bold ${
                        item.gap > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                      }`}>
                        {item.gap > 0 ? `-${item.gap} deficit` : "Balanced"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-ink-muted">
                      {item.gap > 0
                        ? `Organize a campus workshop / training drive on ${item.skill}.`
                        : "Adequate competency coverage across active students."}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* MODAL 1: REGISTER CORPORATE PARTNER */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-xs p-4">
          <div className="max-w-2xl w-full panel shadow-2xl animate-fade-up overflow-hidden flex flex-col max-h-[90vh]">
            {/* Fixed Header */}
            <div className="flex items-center justify-between p-5 border-b border-sage bg-paper">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-soft text-teal flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    Register Corporate Partner
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Register an enterprise employer to recruit from your campus and issue recruiter logins.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCompanyModal(false)}
                className="text-ink-muted hover:text-ink cursor-pointer p-1 rounded-lg hover:bg-sage/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateCompanyOfficer} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 overflow-y-auto modal-scroll space-y-4 max-h-[calc(85vh-130px)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                      Company Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={compName}
                      onChange={(e) => setCompName(e.target.value)}
                      className="w-full input-field text-sm"
                      placeholder="e.g. Acme Innovations Pvt Ltd"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                      Industry Sector
                    </label>
                    <input
                      type="text"
                      value={compIndustry}
                      onChange={(e) => setCompIndustry(e.target.value)}
                      className="w-full input-field text-sm"
                      placeholder="e.g. Information Technology"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                      Official Website
                    </label>
                    <input
                      type="url"
                      value={compWebsite}
                      onChange={(e) => setCompWebsite(e.target.value)}
                      className="w-full input-field text-sm"
                      placeholder="https://company.com"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                      Headquarters / Office Location
                    </label>
                    <input
                      type="text"
                      value={compLocation}
                      onChange={(e) => setCompLocation(e.target.value)}
                      className="w-full input-field text-sm"
                      placeholder="e.g. Bengaluru, Karnataka, India"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                      Company Overview / Description
                    </label>
                    <textarea
                      rows={3}
                      value={compDescription}
                      onChange={(e) => setCompDescription(e.target.value)}
                      className="w-full input-field text-sm resize-none"
                      placeholder="Brief overview of the hiring enterprise, recruiting domains, and operations..."
                    />
                  </div>
                </div>

                <div className="p-3 bg-teal-soft border border-teal/20 rounded-xl text-xs text-teal-deep">
                  Registering this enterprise will automatically authorize it for your campus. You will immediately be able to provision recruiter logins and coordinate campus recruitment drives.
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="p-4 border-t border-sage bg-paper flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCompanyModal(false)}
                  className="btn-secondary py-2 px-4 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCompany}
                  className="btn-primary py-2 px-5 text-xs font-semibold cursor-pointer"
                >
                  {submittingCompany ? "Registering..." : "Register Corporate Partner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PROVISION RECRUITER */}
      {showRecruiterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-xs p-4">
          <div className="max-w-xl w-full panel shadow-2xl animate-fade-up overflow-hidden flex flex-col max-h-[90vh]">
            {/* Fixed Header */}
            <div className="flex items-center justify-between p-5 border-b border-sage bg-paper">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-soft text-teal flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    Provision Recruiter Account
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Issue corporate recruiter credentials to access candidate pools and launch campus drives.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRecruiterModal(false)}
                className="text-ink-muted hover:text-ink cursor-pointer p-1 rounded-lg hover:bg-sage/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleProvisionRecruiterOfficer} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 overflow-y-auto modal-scroll space-y-4 max-h-[calc(85vh-130px)]">
                {/* Company Selection / Badge */}
                {!selectedCompany ? (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                      Corporate Partner Company *
                    </label>
                    <select
                      required
                      value={selectedCompany?._id || ""}
                      onChange={(e) => {
                        const found = companies.find((c) => String(c._id) === e.target.value);
                        setSelectedCompany(found || null);
                      }}
                      className="w-full input-field text-sm"
                    >
                      <option value="">-- Select Authorized Partner Company --</option>
                      {companies
                        .filter((c) => c.isAuthorizedForMyInstitute)
                        .map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name} {c.industry ? `(${c.industry})` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div className="p-3 bg-teal-soft border border-teal/20 rounded-xl text-xs text-teal-deep flex items-center justify-between">
                    <div>
                      Provisioning recruiter for <strong>{selectedCompany.name}</strong>.
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCompany(null)}
                      className="text-[11px] underline text-teal hover:text-teal-deep cursor-pointer font-semibold"
                    >
                      Change Company
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                    Recruiter Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={recruiterName}
                    onChange={(e) => setRecruiterName(e.target.value)}
                    className="w-full input-field text-sm"
                    placeholder="e.g. Priya Sharma"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                    Corporate Work Email (Login ID) *
                  </label>
                  <input
                    type="email"
                    required
                    value={recruiterEmail}
                    onChange={(e) => setRecruiterEmail(e.target.value)}
                    className="w-full input-field text-sm"
                    placeholder="e.g. priya@company.com"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                      Designation
                    </label>
                    <input
                      type="text"
                      value={recruiterDesignation}
                      onChange={(e) => setRecruiterDesignation(e.target.value)}
                      className="w-full input-field text-sm"
                      placeholder="e.g. University Talent Lead"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={recruiterPhone}
                      onChange={(e) => setRecruiterPhone(e.target.value)}
                      className="w-full input-field text-sm"
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                    Temporary Password (Optional)
                  </label>
                  <PasswordInput
                    value={recruiterPassword}
                    onChange={(e) => setRecruiterPassword(e.target.value)}
                    placeholder="Leave empty to auto-generate"
                  />
                  <span className="text-[11px] text-ink-muted mt-1 block">
                    A strong temporary password will be generated automatically and displayed once upon creation.
                  </span>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="p-4 border-t border-sage bg-paper flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRecruiterModal(false)}
                  className="btn-secondary py-2 px-4 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRecruiter || !selectedCompany}
                  className="btn-primary py-2 px-5 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submittingRecruiter ? "Provisioning..." : "Provision Recruiter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: TEMPORARY CREDENTIAL VIEWER */}
      {credentialModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-xs p-4">
          <div className="max-w-md w-full panel shadow-2xl animate-fade-up overflow-hidden flex flex-col">
            {/* Fixed Header */}
            <div className="flex items-center justify-between p-5 border-b border-sage bg-paper">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-soft text-teal flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    Credentials Generated
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Temporary recruiter account access
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCredentialModal({ isOpen: false, name: "", email: "", role: "", temporaryPassword: "" })}
                className="text-ink-muted hover:text-ink cursor-pointer p-1 rounded-lg hover:bg-sage/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <strong>Important:</strong> This temporary password is displayed only once. Please copy and share it securely with the recruiter. They must set a new password upon first login.
              </div>

              <div className="space-y-3 text-xs bg-paper p-4 rounded-xl border border-sage">
                <div>
                  <span className="text-ink-muted block uppercase font-bold text-[10px]">Recruiter Name</span>
                  <span className="text-ink font-semibold text-sm">{credentialModal.name}</span>
                </div>
                <div>
                  <span className="text-ink-muted block uppercase font-bold text-[10px]">Work Email (Login ID)</span>
                  <span className="text-ink font-semibold text-sm">{credentialModal.email}</span>
                </div>
                <div>
                  <span className="text-ink-muted block uppercase font-bold text-[10px]">Assigned Role</span>
                  <span className="text-teal font-bold">{credentialModal.role || "RECRUITER"}</span>
                </div>
                <div>
                  <span className="text-ink-muted block uppercase font-bold text-[10px]">Temporary Password</span>
                  <div className="mt-1 flex items-center justify-between p-2.5 rounded-lg bg-white border border-sage font-mono text-sm font-bold text-teal-deep select-all">
                    <span>{credentialModal.temporaryPassword}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(credentialModal.temporaryPassword)}
                      className="p-1 text-ink-muted hover:text-teal transition cursor-pointer"
                      title="Copy temporary password"
                    >
                      {copiedCredential ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="p-4 border-t border-sage bg-paper flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => copyToClipboard(`Email: ${credentialModal.email}\nTemporary Password: ${credentialModal.temporaryPassword}`)}
                className="btn-secondary py-2 px-3 text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiedCredential ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Login Info
              </button>
              <button
                type="button"
                onClick={() => setCredentialModal({ isOpen: false, name: "", email: "", role: "", temporaryPassword: "" })}
                className="btn-primary py-2 px-5 text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficerDashboard;
