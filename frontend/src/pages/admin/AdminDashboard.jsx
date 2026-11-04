import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Shield,
  Users,
  UserCheck,
  UserX,
  Briefcase,
  Building2,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  School,
  Lock,
  Globe,
  Mail,
  Phone,
  Trash2,
  Power,
  X,
  KeyRound,
  ShieldCheck,
  Edit,
  Copy,
  Check,
  RefreshCw,
  BadgeCheck,
  Building,
  UserPlus,
} from "lucide-react";
import PasswordInput from "../../components/PasswordInput";

const ROLE_OPTIONS = ["STUDENT", "RECRUITER", "PLACEMENT_OFFICER", "SUPER_ADMIN"];

const roleLabel = (role) => {
  if (!role) return "";
  const map = {
    SUPER_ADMIN: "Super Admin",
    admin: "Super Admin",
    PLACEMENT_OFFICER: "Placement Officer",
    placement_officer: "Placement Officer",
    RECRUITER: "Recruiter",
    recruiter: "Recruiter",
    STUDENT: "Student",
    student: "Student",
  };
  return map[role] || role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const AdminDashboard = () => {
  const { token, user: currentUser } = useAuth();

  // Navigation tab: 'users' | 'institutes' | 'companies'
  const [activeTab, setActiveTab] = useState("users");

  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [institutes, setInstitutes] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingInstitutes, setLoadingInstitutes] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionBusy, setActionBusy] = useState(null);

  // Modal states: Create Privileged User (Admin / Officer)
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("PLACEMENT_OFFICER");
  const [newUserInstitute, setNewUserInstitute] = useState("");
  const [newUserDesignation, setNewUserDesignation] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [submittingUser, setSubmittingUser] = useState(false);

  // Modal state: Display Created / Reissued Credentials
  const [credentialModal, setCredentialModal] = useState({
    isOpen: false,
    name: "",
    email: "",
    role: "",
    temporaryPassword: "",
  });
  const [copiedCredential, setCopiedCredential] = useState(false);

  // Modal states: Create Institute
  const [showInstituteModal, setShowInstituteModal] = useState(false);
  const [instName, setInstName] = useState("");
  const [instCode, setInstCode] = useState("");
  const [instDomain, setInstDomain] = useState("");
  const [instCity, setInstCity] = useState("");
  const [instState, setInstState] = useState("");
  const [instEmail, setInstEmail] = useState("");
  const [instPhone, setInstPhone] = useState("");
  const [instWebsite, setInstWebsite] = useState("");
  const [submittingInstitute, setSubmittingInstitute] = useState(false);

  // Modal states: Edit Institute
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingInstId, setEditingInstId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Modal states: Create Company
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [compName, setCompName] = useState("");
  const [compWebsite, setCompWebsite] = useState("");
  const [compIndustry, setCompIndustry] = useState("Technology");
  const [compLocation, setCompLocation] = useState("");
  const [compDescription, setCompDescription] = useState("");
  const [compVerifyOnCreate, setCompVerifyOnCreate] = useState(true);
  const [submittingCompany, setSubmittingCompany] = useState(false);

  // Company Filtering and Campus Authorization Modal States
  const [compVerifiedFilter, setCompVerifiedFilter] = useState("all");
  const [compStatusFilter, setCompStatusFilter] = useState("all");
  const [compSearchQuery, setCompSearchQuery] = useState("");
  const [showCampusAuthModal, setShowCampusAuthModal] = useState(false);
  const [selectedCompanyForAuth, setSelectedCompanyForAuth] = useState(null);
  const [authTargetInstitute, setAuthTargetInstitute] = useState("");
  const [submittingCampusAuth, setSubmittingCampusAuth] = useState(false);

  // Modal states: Provision Recruiter
  const [showRecruiterModal, setShowRecruiterModal] = useState(false);
  const [recruiterTargetCompany, setRecruiterTargetCompany] = useState(null);
  const [recruiterName, setRecruiterName] = useState("");
  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [recruiterPassword, setRecruiterPassword] = useState("");
  const [recruiterDesignation, setRecruiterDesignation] = useState("Talent Acquisition Lead");
  const [recruiterPhone, setRecruiterPhone] = useState("");
  const [submittingRecruiter, setSubmittingRecruiter] = useState(false);

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await fetch("/api/admin/overview", { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to load overview");
      }
      setOverview(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingOverview(false);
    }
  }, [token]);

  const fetchUsers = useCallback(
    async (page = 1) => {
      setLoadingUsers(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", "10");
        if (roleFilter) params.set("role", roleFilter);
        if (activeFilter) params.set("isActive", activeFilter);

        const res = await fetch(`/api/admin/users?${params.toString()}`, {
          headers: authHeaders,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Failed to load users");
        }
        setUsers(data.data.users || []);
        setPagination(data.data.pagination || { page, limit: 10, total: 0, totalPages: 0 });
      } catch (err) {
        setError(err.message);
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    },
    [token, roleFilter, activeFilter]
  );

  const fetchInstitutes = useCallback(async () => {
    setLoadingInstitutes(true);
    try {
      const res = await fetch("/api/admin/institutes", { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to load institutes");
      }
      setInstitutes(data.data || []);
    } catch (err) {
      setError(err.message);
      setInstitutes([]);
    } finally {
      setLoadingInstitutes(false);
    }
  }, [token]);

  const fetchCompanies = useCallback(async () => {
    setLoadingCompanies(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (compVerifiedFilter === "verified") params.set("isVerified", "true");
      if (compVerifiedFilter === "unverified") params.set("isVerified", "false");
      if (compStatusFilter === "active") params.set("isActive", "true");
      if (compStatusFilter === "inactive") params.set("isActive", "false");
      if (compSearchQuery.trim()) params.set("search", compSearchQuery.trim());

      const res = await fetch(`/api/admin/companies?${params.toString()}`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to load companies");
      }
      setCompanies(data.data?.companies || []);
    } catch (err) {
      setError(err.message);
      setCompanies([]);
    } finally {
      setLoadingCompanies(false);
    }
  }, [token, compVerifiedFilter, compStatusFilter, compSearchQuery]);

  useEffect(() => {
    fetchOverview();
    fetchInstitutes();
    fetchCompanies();
  }, [fetchOverview, fetchInstitutes, fetchCompanies]);

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers(1);
    } else if (activeTab === "institutes") {
      fetchInstitutes();
    } else if (activeTab === "companies") {
      fetchCompanies();
    }
  }, [activeTab, fetchUsers, fetchInstitutes, fetchCompanies]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  // Status toggle for user
  const handleToggleStatus = async (user) => {
    clearMessages();
    setActionBusy(`status-${user._id}`);
    const nextStatus = !user.isActive;

    try {
      const res = await fetch(`/api/admin/users/${user._id}/status`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ isActive: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update user status");
      }

      setUsers((prev) =>
        prev.map((u) => (u._id === user._id ? { ...u, isActive: nextStatus } : u))
      );
      setSuccess(`User status updated to ${nextStatus ? "Active" : "Inactive"}`);
      fetchOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(null);
    }
  };

  // Role change for user
  const handleRoleChange = async (user, newRole) => {
    if (newRole === user.role) return;
    clearMessages();
    setActionBusy(`role-${user._id}`);

    try {
      const res = await fetch(`/api/admin/users/${user._id}/role`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update user role");
      }

      setUsers((prev) =>
        prev.map((u) => (u._id === user._id ? { ...u, role: newRole } : u))
      );
      setSuccess(`User role changed to ${roleLabel(newRole)}`);
      fetchOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(null);
    }
  };

  // Provision Admin / Placement Officer
  const handleCreateUser = async (e) => {
    e.preventDefault();
    clearMessages();
    setSubmittingUser(true);

    try {
      const payload = {
        name: newUserName,
        email: newUserEmail,
        role: newUserRole,
        institute: newUserRole === "PLACEMENT_OFFICER" ? newUserInstitute : null,
        designation: newUserDesignation,
        phone: newUserPhone,
      };

      if (newUserPassword && newUserPassword.trim().length > 0) {
        payload.password = newUserPassword;
      }

      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create user");
      }

      setShowUserModal(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("PLACEMENT_OFFICER");
      setNewUserInstitute("");
      setNewUserDesignation("");
      setNewUserPhone("");

      if (data.data?.temporaryPassword) {
        setCredentialModal({
          isOpen: true,
          name: data.data.user.name,
          email: data.data.user.email,
          role: data.data.user.role,
          temporaryPassword: data.data.temporaryPassword,
        });
      }

      setSuccess(data.message || "Account provisioned successfully!");
      fetchUsers(1);
      fetchOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingUser(false);
    }
  };

  // Reissue credentials for privileged user
  const handleReissueCredentials = async (user) => {
    if (!window.confirm(`Are you sure you want to reissue credentials for '${user.email}'? A new temporary password will be generated.`)) {
      return;
    }
    clearMessages();
    setActionBusy(`reissue-${user._id}`);

    try {
      const res = await fetch(`/api/admin/users/${user._id}/reissue-credentials`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to reissue credentials");
      }

      setCredentialModal({
        isOpen: true,
        name: user.name,
        email: user.email,
        role: user.role,
        temporaryPassword: data.data.temporaryPassword,
      });

      setSuccess(data.message || "New credentials generated successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(null);
    }
  };

  // Create Institute
  const handleCreateInstitute = async (e) => {
    e.preventDefault();
    clearMessages();
    setSubmittingInstitute(true);

    try {
      const res = await fetch("/api/admin/institutes", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: instName,
          code: instCode,
          domain: instDomain,
          city: instCity,
          state: instState,
          contactEmail: instEmail,
          contactPhone: instPhone,
          website: instWebsite,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to register institute");
      }

      setSuccess(data.message || "Institute registered successfully!");
      setShowInstituteModal(false);
      setInstName("");
      setInstCode("");
      setInstDomain("");
      setInstCity("");
      setInstState("");
      setInstEmail("");
      setInstPhone("");
      setInstWebsite("");
      fetchInstitutes();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingInstitute(false);
    }
  };

  // Open Edit Institute Modal
  const openEditInstitute = (inst) => {
    setEditingInstId(inst._id);
    setEditName(inst.name || "");
    setEditCode(inst.code || "");
    setEditDomain(inst.domain || "");
    setEditCity(inst.city || "");
    setEditState(inst.state || "");
    setEditEmail(inst.contactEmail || "");
    setEditPhone(inst.contactPhone || "");
    setEditWebsite(inst.website || "");
    setShowEditModal(true);
  };

  // Submit Edit Institute
  const handleUpdateInstitute = async (e) => {
    e.preventDefault();
    clearMessages();
    setSubmittingEdit(true);

    try {
      const res = await fetch(`/api/admin/institutes/${editingInstId}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          name: editName,
          code: editCode,
          domain: editDomain,
          city: editCity,
          state: editState,
          contactEmail: editEmail,
          contactPhone: editPhone,
          website: editWebsite,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update institute details");
      }

      setSuccess(data.message || "Institute updated successfully!");
      setShowEditModal(false);
      fetchInstitutes();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Toggle institute status
  const handleToggleInstituteStatus = async (inst) => {
    clearMessages();
    const nextStatus = inst.status === "active" ? "inactive" : "active";

    try {
      const res = await fetch(`/api/admin/institutes/${inst._id}/status`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update institute status");
      }

      setInstitutes((prev) =>
        prev.map((i) => (i._id === inst._id ? { ...i, status: nextStatus } : i))
      );
      setSuccess(`Institute '${inst.name}' is now ${nextStatus}`);
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete institute
  const handleDeleteInstitute = async (inst) => {
    if (!window.confirm(`Are you sure you want to delete '${inst.name}'?`)) return;
    clearMessages();

    try {
      const res = await fetch(`/api/admin/institutes/${inst._id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete institute");
      }

      setInstitutes((prev) => prev.filter((i) => i._id !== inst._id));
      setSuccess(data.message || "Institute removed successfully");
    } catch (err) {
      setError(err.message);
    }
  };

  // Create Company
  const handleCreateCompany = async (e) => {
    e.preventDefault();
    clearMessages();
    setSubmittingCompany(true);

    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: compName,
          website: compWebsite,
          industry: compIndustry,
          location: compLocation,
          description: compDescription,
          isVerified: compVerifyOnCreate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create company");
      }

      setSuccess(data.message || "Company registered successfully!");
      setShowCompanyModal(false);
      setCompName("");
      setCompWebsite("");
      setCompIndustry("Technology");
      setCompLocation("");
      setCompDescription("");
      setCompVerifyOnCreate(true);
      fetchCompanies();
      fetchOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingCompany(false);
    }
  };

  // Toggle Company Verification
  const handleToggleCompanyVerification = async (company) => {
    clearMessages();
    const nextVerified = !company.isVerified;
    const actionDesc = nextVerified ? "verify" : "revoke verification for";
    if (!window.confirm(`Are you sure you want to ${actionDesc} '${company.name}'?`)) return;

    try {
      const res = await fetch(`/api/admin/companies/${company._id}/verify`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ isVerified: nextVerified }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update verification");
      }

      setCompanies((prev) =>
        prev.map((c) => (c._id === company._id ? { ...c, isVerified: nextVerified } : c))
      );
      setSuccess(data.message || "Company verification updated");
    } catch (err) {
      setError(err.message);
    }
  };

  // Toggle Company Status
  const handleToggleCompanyStatus = async (company) => {
    clearMessages();
    const nextActive = !company.isActive;
    try {
      const res = await fetch(`/api/admin/companies/${company._id}/status`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update status");
      }

      setCompanies((prev) =>
        prev.map((c) => (c._id === company._id ? { ...c, isActive: nextActive } : c))
      );
      setSuccess(data.message || "Company status updated");
    } catch (err) {
      setError(err.message);
    }
  };

  // Open Provision Recruiter Modal
  const openProvisionRecruiter = (company) => {
    setRecruiterTargetCompany(company);
    setRecruiterName("");
    setRecruiterEmail("");
    setRecruiterPassword("");
    setRecruiterDesignation("Talent Acquisition Lead");
    setRecruiterPhone("");
    setShowRecruiterModal(true);
  };

  // Submit Provision Recruiter
  const handleProvisionRecruiter = async (e) => {
    e.preventDefault();
    clearMessages();
    setSubmittingRecruiter(true);

    try {
      const res = await fetch("/api/admin/recruiters", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: recruiterName,
          email: recruiterEmail,
          companyId: recruiterTargetCompany._id,
          password: recruiterPassword || undefined,
          designation: recruiterDesignation,
          phone: recruiterPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to provision recruiter");
      }

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

      setSuccess(data.message || "Recruiter provisioned successfully!");
      fetchCompanies();
      fetchOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingRecruiter(false);
    }
  };

  // Open Campus Authorization Modal
  const openCampusAuthModal = (company) => {
    setSelectedCompanyForAuth(company);
    setAuthTargetInstitute(activeInstitutes[0]?._id || "");
    setShowCampusAuthModal(true);
  };

  // Submit Campus Authorization
  const handleAuthorizeCampus = async (e) => {
    e.preventDefault();
    if (!selectedCompanyForAuth || !authTargetInstitute) return;
    setSubmittingCampusAuth(true);
    clearMessages();

    try {
      const res = await fetch(`/api/admin/companies/${selectedCompanyForAuth._id}/authorize`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ instituteId: authTargetInstitute }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to authorize company for campus");

      setSuccess(data.message || "Company authorized for campus successfully");
      setShowCampusAuthModal(false);
      setAuthTargetInstitute("");
      await fetchCompanies();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingCampusAuth(false);
    }
  };

  // Revoke Campus Authorization
  const handleRevokeCampus = async (company, instituteId, instituteName) => {
    if (!window.confirm(`Revoke campus placement authorization for '${company.name}' at ${instituteName}? Existing drive history is preserved.`)) {
      return;
    }
    clearMessages();
    try {
      const res = await fetch(`/api/admin/companies/${company._id}/authorize`, {
        method: "DELETE",
        headers: authHeaders,
        body: JSON.stringify({ instituteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to revoke campus authorization");

      setSuccess(data.message || "Campus authorization revoked");
      await fetchCompanies();
    } catch (err) {
      setError(err.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCredential(true);
    setTimeout(() => setCopiedCredential(false), 2500);
  };

  const stats = overview?.users;
  const activeInstitutes = institutes.filter((i) => i.status === "active");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-up">
      {/* Header with Security Status */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-teal-soft text-teal inline-flex">
              <Shield className="w-6 h-6" />
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
              Platform Governance Console
            </h1>
          </div>
          <p className="text-sm text-ink-muted mt-1">
            Super Administrator controls: Manage institutions, verify enterprises, provision officers & recruiters, and audit system security.
          </p>
        </div>

        {/* Security Indicator Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-soft/80 border border-teal/20 text-xs text-ink shrink-0">
          <ShieldCheck className="w-4 h-4 text-teal" />
          <span>Gateway Intrusion Defense: <strong>Active</strong></span>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start justify-between gap-3 animate-fade-up">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start justify-between gap-3 animate-fade-up">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess("")} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* System Metrics Overview */}
      {loadingOverview ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="panel p-5 animate-pulse h-24 bg-paper/60" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="panel p-5 shadow-xs">
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Total Users</div>
            <div className="mt-2 text-2xl font-bold text-ink">{stats?.total ?? 0}</div>
          </div>
          <div className="panel p-5 shadow-xs">
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Students</div>
            <div className="mt-2 text-2xl font-bold text-teal">{stats?.students ?? 0}</div>
          </div>
          <div className="panel p-5 shadow-xs">
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Officers</div>
            <div className="mt-2 text-2xl font-bold text-ink">{stats?.placementOfficers ?? 0}</div>
          </div>
          <div className="panel p-5 shadow-xs">
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Recruiters</div>
            <div className="mt-2 text-2xl font-bold text-teal">{stats?.recruiters ?? 0}</div>
          </div>
          <div className="panel p-5 shadow-xs">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted uppercase tracking-wider">
              <School className="w-3.5 h-3.5 text-teal" /> Institutes
            </div>
            <div className="mt-2 text-2xl font-bold text-ink">
              {overview?.institutes ?? institutes.length}
            </div>
          </div>
          <div className="panel p-5 shadow-xs">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted uppercase tracking-wider">
              <Building className="w-3.5 h-3.5 text-teal" /> Verified Companies
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">
              {overview?.verifiedCompanies ?? 0}
            </div>
          </div>
          <div className="panel p-5 shadow-xs">
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Active Drives
            </div>
            <div className="mt-2 text-2xl font-bold text-teal">
              {overview?.activeJobs ?? 0}
            </div>
          </div>
          <div className="panel p-5 shadow-xs">
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Applications
            </div>
            <div className="mt-2 text-2xl font-bold text-ink">
              {overview?.applications ?? 0}
            </div>
          </div>
          <div className="panel p-5 shadow-xs">
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Selected (pipeline)
            </div>
            <div className="mt-2 text-2xl font-bold text-teal">
              {overview?.selectedApplications ?? 0}
            </div>
          </div>
          <div className="panel p-5 shadow-xs">
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Placed Students
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">
              {overview?.placedStudents ?? 0}
            </div>
          </div>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-sage mb-6 gap-3 pb-2 sm:pb-0">
        <div className="flex gap-2 overflow-x-auto no-scrollbar whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition border-b-2 shrink-0 ${
              activeTab === "users"
                ? "border-teal text-teal"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Users className="w-4 h-4" />
              <span>User Governance ({pagination.total || users.length})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("institutes")}
            className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition border-b-2 shrink-0 ${
              activeTab === "institutes"
                ? "border-teal text-teal"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <School className="w-4 h-4" />
              <span>Institutes & Campuses ({institutes.length})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("companies")}
            className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition border-b-2 shrink-0 ${
              activeTab === "companies"
                ? "border-teal text-teal"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Building className="w-4 h-4" />
              <span>Companies & Employers ({companies.length})</span>
            </div>
          </button>
        </div>

        {/* Action Buttons according to Active Tab */}
        <div className="w-full sm:w-auto shrink-0">
          {activeTab === "users" && (
            <button
              onClick={() => setShowUserModal(true)}
              className="btn-primary w-full sm:w-auto py-2 px-3.5 text-xs inline-flex items-center justify-center gap-1.5 shadow-xs"
            >
              <PlusCircle className="w-4 h-4" /> Provision Officer / Admin
            </button>
          )}
          {activeTab === "institutes" && (
            <button
              onClick={() => setShowInstituteModal(true)}
              className="btn-primary w-full sm:w-auto py-2 px-3.5 text-xs inline-flex items-center justify-center gap-1.5 shadow-xs"
            >
              <PlusCircle className="w-4 h-4" /> Register Institute / Campus
            </button>
          )}
          {activeTab === "companies" && (
            <button
              onClick={() => setShowCompanyModal(true)}
              className="btn-primary w-full sm:w-auto py-2 px-3.5 text-xs inline-flex items-center justify-center gap-1.5 shadow-xs"
            >
              <PlusCircle className="w-4 h-4" /> Register Company
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: USER GOVERNANCE */}
      {activeTab === "users" && (
        <>
          {/* User Filters */}
          <div className="panel p-4 shadow-xs mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
              >
                <option value="">All Roles</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
              >
                <option value="">All Statuses</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  fetchUsers(1);
                }}
                className="px-5 py-2 bg-teal hover:bg-teal-deep text-white rounded-xl text-sm font-semibold transition shadow-xs"
              >
                Filter Accounts
              </button>
            </div>
          </div>

          {/* User Table */}
          {loadingUsers ? (
            <div className="panel p-12 text-center text-ink-muted text-sm">
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div className="panel p-12 text-center shadow-xs">
              <Users className="w-12 h-12 text-ink-muted mx-auto mb-3" />
              <h3 className="font-semibold text-ink text-base">No Users Found</h3>
              <p className="text-xs text-ink-muted mt-1">
                Try adjusting role or status filters, or provision an administrative account.
              </p>
            </div>
          ) : (
            <div className="panel shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-paper text-ink-muted uppercase font-semibold border-b border-sage">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Designation / Phone</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Created</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {users.map((u) => {
                      const isSelf = currentUser && String(currentUser._id || currentUser.id) === String(u._id);
                      const isPrivileged = ["PLACEMENT_OFFICER", "placement_officer", "SUPER_ADMIN", "admin", "RECRUITER", "recruiter"].includes(u.role);
                      return (
                        <tr key={u._id} className="hover:bg-paper">
                          <td className="py-3 px-4 font-semibold text-ink">
                            <div>{u.name}</div>
                            <div className="text-[11px] text-ink-muted font-normal">{u.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            {isSelf ? (
                              <span className="font-bold text-teal">{roleLabel(u.role)} (You)</span>
                            ) : (
                              <select
                                value={u.role}
                                disabled={actionBusy === `role-${u._id}`}
                                onChange={(e) => handleRoleChange(u, e.target.value)}
                                className="px-2 py-1.5 rounded-lg border border-sage text-xs bg-white focus:ring-2 focus:ring-teal focus:outline-none disabled:opacity-50"
                              >
                                {ROLE_OPTIONS.map((r) => (
                                  <option key={r} value={r}>
                                    {roleLabel(r)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="py-3 px-4 text-ink-muted">
                            <div>{u.designation || "—"}</div>
                            <div className="text-[11px]">{u.phone || "—"}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                u.isActive
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {u.isActive ? "Active" : "Inactive"}
                            </span>
                            {u.mustChangePassword && (
                              <span className="block mt-0.5 text-[10px] text-amber-700 font-semibold">
                                Pending Password Reset
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-ink-muted">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Reissue Credentials */}
                              {isPrivileged && !isSelf && (
                                <button
                                  type="button"
                                  disabled={actionBusy === `reissue-${u._id}`}
                                  onClick={() => handleReissueCredentials(u)}
                                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-sage bg-white text-ink hover:bg-paper transition inline-flex items-center gap-1 disabled:opacity-50"
                                  title="Reissue Temporary Password"
                                >
                                  <RefreshCw className={`w-3 h-3 ${actionBusy === `reissue-${u._id}` ? "animate-spin" : ""}`} />
                                  <span>Reissue</span>
                                </button>
                              )}

                              {isSelf ? (
                                <span className="text-[11px] text-ink-muted">Current Session</span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={actionBusy === `status-${u._id}`}
                                  onClick={() => handleToggleStatus(u)}
                                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition disabled:opacity-50 ${
                                    u.isActive
                                      ? "bg-teal-soft text-teal-deep hover:bg-teal hover:text-white"
                                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  }`}
                                >
                                  {u.isActive ? "Deactivate" : "Activate"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-sage bg-paper">
                <span className="text-xs text-ink-muted">
                  Page {pagination.page} of {pagination.totalPages || 1} · {pagination.total} users
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchUsers(pagination.page - 1)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-sage bg-white text-xs font-medium text-ink hover:bg-paper disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchUsers(pagination.page + 1)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-sage bg-white text-xs font-medium text-ink hover:bg-paper disabled:opacity-40"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: INSTITUTES & CAMPUSES */}
      {activeTab === "institutes" && (
        <>
          {loadingInstitutes ? (
            <div className="panel p-12 text-center text-ink-muted text-sm">
              Loading institutes...
            </div>
          ) : institutes.length === 0 ? (
            <div className="panel p-12 text-center shadow-xs">
              <School className="w-12 h-12 text-ink-muted mx-auto mb-3" />
              <h3 className="font-semibold text-ink text-base">No Institutes Registered</h3>
              <p className="text-xs text-ink-muted mt-1 max-w-sm mx-auto">
                Register your institution or partner campuses to organize placement cells, student cohorts, and administrative officers.
              </p>
              <button
                onClick={() => setShowInstituteModal(true)}
                className="btn-primary mt-4 py-2 px-4 text-xs inline-flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" /> Register First Institute
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {institutes.map((inst) => (
                <div key={inst._id} className="panel p-6 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <span className="inline-block text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-teal-soft text-teal border border-sage mb-1">
                          {inst.code}
                        </span>
                        <h3 className="font-display text-lg font-bold text-ink leading-snug">
                          {inst.name}
                        </h3>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          inst.status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {inst.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-ink-muted mt-4">
                      {inst.domain && (
                        <div className="flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-teal shrink-0" />
                          <span>Domain: <strong>{inst.domain}</strong></span>
                        </div>
                      )}
                      {(inst.city || inst.state) && (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-teal shrink-0" />
                          <span>Location: {[inst.city, inst.state].filter(Boolean).join(", ")}</span>
                        </div>
                      )}
                      {inst.contactEmail && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-teal shrink-0" />
                          <span>{inst.contactEmail}</span>
                        </div>
                      )}
                      {inst.contactPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-teal shrink-0" />
                          <span>{inst.contactPhone}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-5 p-3 rounded-xl bg-paper border border-sage text-center">
                      <div>
                        <div className="text-base font-bold text-teal">{inst.stats?.students ?? 0}</div>
                        <div className="text-[10px] text-ink-muted uppercase">Students</div>
                      </div>
                      <div>
                        <div className="text-base font-bold text-ink">{inst.stats?.officers ?? 0}</div>
                        <div className="text-[10px] text-ink-muted uppercase">Officers</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-sage flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleInstituteStatus(inst)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition ${
                          inst.status === "active"
                            ? "bg-teal-soft text-teal-deep hover:bg-teal hover:text-white"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {inst.status === "active" ? "Set Inactive" : "Set Active"}
                      </button>

                      <button
                        onClick={() => openEditInstitute(inst)}
                        className="p-1.5 text-ink-muted hover:text-teal transition rounded-lg border border-sage bg-white hover:bg-paper"
                        title="Edit Institute Details"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleDeleteInstitute(inst)}
                      className="p-1.5 text-ink-muted hover:text-red-600 transition"
                      title="Delete Institute"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 3: COMPANIES & EMPLOYERS */}
      {activeTab === "companies" && (
        <>
          {/* Company Controls Bar */}
          <div className="panel p-4 shadow-xs mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={compSearchQuery}
                onChange={(e) => setCompSearchQuery(e.target.value)}
                placeholder="Search enterprise name, industry, location..."
                className="input-campus text-xs flex-1"
              />
              <select
                value={compVerifiedFilter}
                onChange={(e) => setCompVerifiedFilter(e.target.value)}
                className="input-campus text-xs sm:w-48"
              >
                <option value="all">All Verification</option>
                <option value="verified">Platform Verified</option>
                <option value="unverified">Pending Verification</option>
              </select>
              <select
                value={compStatusFilter}
                onChange={(e) => setCompStatusFilter(e.target.value)}
                className="input-campus text-xs sm:w-36"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
            <button
              onClick={() => setShowCompanyModal(true)}
              className="btn-primary py-2 px-4 text-xs inline-flex items-center gap-1.5 shrink-0"
            >
              <PlusCircle className="w-4 h-4" /> Register Enterprise
            </button>
          </div>

          {loadingCompanies ? (
            <div className="panel p-12 text-center text-ink-muted text-sm">
              Loading companies...
            </div>
          ) : companies.length === 0 ? (
            <div className="panel p-12 text-center shadow-xs">
              <Building className="w-12 h-12 text-ink-muted mx-auto mb-3" />
              <h3 className="font-semibold text-ink text-base">No Enterprises Found</h3>
              <p className="text-xs text-ink-muted mt-1 max-w-sm mx-auto">
                No matching enterprises registered or verified for the selected filter criteria.
              </p>
              <button
                onClick={() => setShowCompanyModal(true)}
                className="btn-primary mt-4 py-2 px-4 text-xs inline-flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" /> Register First Company
              </button>
            </div>
          ) : (
            <div className="panel shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-paper text-ink-muted uppercase font-semibold border-b border-sage">
                    <tr>
                      <th className="py-3 px-4">Enterprise</th>
                      <th className="py-3 px-4">Industry / Location</th>
                      <th className="py-3 px-4">Verification</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Authorized Campuses</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {companies.map((c) => (
                      <tr key={c._id} className="hover:bg-paper">
                        <td className="py-3 px-4 font-semibold text-ink">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-teal" />
                            <span>{c.name}</span>
                          </div>
                          {c.website && (
                            <a
                              href={c.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-teal hover:underline font-normal block mt-0.5"
                            >
                              {c.website.replace(/^https?:\/\//, "")}
                            </a>
                          )}
                        </td>
                        <td className="py-3 px-4 text-ink-muted">
                          <div>{c.industry || "General Industry"}</div>
                          <div className="text-[11px]">{c.location || "Location Flexible"}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                              c.isVerified
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            <BadgeCheck className="w-3 h-3" />
                            {c.isVerified ? "Platform Verified" : "Pending Verification"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              c.isActive
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {c.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-ink-muted">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="font-bold text-teal">
                              {c.authorizedInstitutes?.length || 0}
                            </span>{" "}
                            <span>campus(es)</span>
                            {c.isVerified && c.isActive && (
                              <button
                                type="button"
                                onClick={() => openCampusAuthModal(c)}
                                className="ml-1 text-[10px] font-semibold text-teal hover:underline inline-flex items-center gap-0.5"
                                title="Authorize for another campus"
                              >
                                <PlusCircle className="w-3 h-3" /> Authorize
                              </button>
                            )}
                          </div>
                          {c.authorizedInstitutes && c.authorizedInstitutes.length > 0 && (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {c.authorizedInstitutes.map((inst) => (
                                <span
                                  key={inst._id || inst}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-soft text-[10px] font-medium text-teal-deep border border-sage"
                                >
                                  <span>{inst.name || inst.code || "Campus"}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRevokeCampus(c, inst._id || inst, inst.name || "Campus")}
                                    className="text-red-500 hover:text-red-700 font-bold text-[10px] ml-0.5"
                                    title="Revoke campus authorization"
                                  >
                                    ✕
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Provision Recruiter for this company */}
                            <button
                              type="button"
                              onClick={() => openProvisionRecruiter(c)}
                              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-sage bg-white text-ink hover:bg-paper transition inline-flex items-center gap-1 shadow-xs"
                              title="Provision Recruiter Account"
                            >
                              <UserPlus className="w-3.5 h-3.5 text-teal" />
                              <span>Add Recruiter</span>
                            </button>

                            {/* Verify / Revoke Verification */}
                            <button
                              type="button"
                              onClick={() => handleToggleCompanyVerification(c)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                                c.isVerified
                                  ? "bg-amber-50 text-amber-800 hover:bg-amber-100"
                                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                              }`}
                            >
                              {c.isVerified ? "Revoke Verification" : "Verify Platform"}
                            </button>

                            {/* Activate / Deactivate */}
                            <button
                              type="button"
                              onClick={() => handleToggleCompanyStatus(c)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                                c.isActive
                                  ? "bg-teal-soft text-teal-deep hover:bg-teal hover:text-white"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {c.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL 1: PROVISION PRIVILEGED USER */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-lg w-full panel border border-sage shadow-2xl animate-fade-up overflow-hidden rounded-2xl bg-surface my-auto">
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-sage flex items-center justify-between bg-paper/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-teal-soft text-teal">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    Provision Administrative Account
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Create verified Placement Officer or Super Admin credentials
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper rounded-lg transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="p-6 space-y-4 max-h-[calc(85vh-130px)] overflow-y-auto modal-scroll">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full input-field text-sm"
                    placeholder="e.g. Dr. Ramesh Kumar"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Official Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full input-field text-sm"
                    placeholder="e.g. ramesh@college.edu"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Privileged Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="w-full input-field text-sm bg-white"
                  >
                    <option value="PLACEMENT_OFFICER">Placement Officer (Institution Placements)</option>
                    <option value="SUPER_ADMIN">Super Administrator (Full System Control)</option>
                  </select>
                </div>

                {newUserRole === "PLACEMENT_OFFICER" && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Assign Institute <span className="text-red-500">*</span>
                    </label>
                    {activeInstitutes.length === 0 ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                        No active institutes found. Please register or activate an institute before creating a Placement Officer.
                      </div>
                    ) : (
                      <select
                        required
                        value={newUserInstitute}
                        onChange={(e) => setNewUserInstitute(e.target.value)}
                        className="w-full input-field text-sm bg-white"
                      >
                        <option value="">-- Select Active Institute --</option>
                        {activeInstitutes.map((inst) => (
                          <option key={inst._id} value={inst._id}>
                            {inst.name} ({inst.code})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Designation
                    </label>
                    <input
                      type="text"
                      value={newUserDesignation}
                      onChange={(e) => setNewUserDesignation(e.target.value)}
                      className="w-full input-field text-sm"
                      placeholder="e.g. Dean of Placements"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={newUserPhone}
                      onChange={(e) => setNewUserPhone(e.target.value)}
                      className="w-full input-field text-sm"
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Temporary Password (Optional)
                  </label>
                  <PasswordInput
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Leave blank to auto-generate"
                  />
                  <span className="text-[11px] text-ink-muted mt-1 block">
                    If left empty, a secure temporary password will be generated automatically.
                  </span>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="px-6 py-4 border-t border-sage bg-paper/30 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="btn-secondary py-2 px-5 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUser || (newUserRole === "PLACEMENT_OFFICER" && !newUserInstitute)}
                  className="btn-primary py-2 px-6 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submittingUser ? "Provisioning..." : "Provision Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTER NEW INSTITUTE */}
      {showInstituteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-2xl w-full panel border border-sage shadow-2xl animate-fade-up overflow-hidden rounded-2xl bg-surface my-auto">
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-sage flex items-center justify-between bg-paper/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-teal-soft text-teal">
                  <School className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    Register Campus / Institute
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Onboard an authorized educational institution to the placement ecosystem
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstituteModal(false)}
                className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper rounded-lg transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInstitute}>
              <div className="p-6 space-y-4 max-h-[calc(85vh-130px)] overflow-y-auto modal-scroll">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Institute Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={instName}
                    onChange={(e) => setInstName(e.target.value)}
                    className="w-full input-field text-sm"
                    placeholder="e.g. National Institute of Technology Warangal"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Institute Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={instCode}
                      onChange={(e) => setInstCode(e.target.value.toUpperCase())}
                      className="w-full input-field text-sm uppercase font-mono"
                      placeholder="e.g. NITW"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Official Email Domain
                    </label>
                    <input
                      type="text"
                      value={instDomain}
                      onChange={(e) => setInstDomain(e.target.value)}
                      className="w-full input-field text-sm font-mono"
                      placeholder="e.g. nitw.ac.in"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      City
                    </label>
                    <input
                      type="text"
                      value={instCity}
                      onChange={(e) => setInstCity(e.target.value)}
                      className="w-full input-field text-sm"
                      placeholder="e.g. Warangal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      State
                    </label>
                    <input
                      type="text"
                      value={instState}
                      onChange={(e) => setInstState(e.target.value)}
                      className="w-full input-field text-sm"
                      placeholder="e.g. Telangana"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Placement Contact Email
                    </label>
                    <input
                      type="email"
                      value={instEmail}
                      onChange={(e) => setInstEmail(e.target.value)}
                      className="w-full input-field text-sm"
                      placeholder="placements@college.edu"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={instPhone}
                      onChange={(e) => setInstPhone(e.target.value)}
                      className="w-full input-field text-sm"
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={instWebsite}
                    onChange={(e) => setInstWebsite(e.target.value)}
                    className="w-full input-field text-sm"
                    placeholder="https://www.college.edu"
                  />
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="px-6 py-4 border-t border-sage bg-paper/30 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowInstituteModal(false)}
                  className="btn-secondary py-2 px-5 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInstitute}
                  className="btn-primary py-2 px-6 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submittingInstitute ? "Registering..." : "Register Institute"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT INSTITUTE */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-2xl w-full panel border border-sage shadow-2xl animate-fade-up overflow-hidden rounded-2xl bg-surface my-auto">
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-sage flex items-center justify-between bg-paper/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-teal-soft text-teal">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    Edit Institute Details
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Update institution contact, location, and platform details
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper rounded-lg transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateInstitute}>
              <div className="p-6 space-y-4 max-h-[calc(85vh-130px)] overflow-y-auto modal-scroll">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Institute Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full input-field text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Institute Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                      className="w-full input-field text-sm uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Email Domain
                    </label>
                    <input
                      type="text"
                      value={editDomain}
                      onChange={(e) => setEditDomain(e.target.value)}
                      className="w-full input-field text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      City
                    </label>
                    <input
                      type="text"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      className="w-full input-field text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      State
                    </label>
                    <input
                      type="text"
                      value={editState}
                      onChange={(e) => setEditState(e.target.value)}
                      className="w-full input-field text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Placement Contact Email
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full input-field text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full input-field text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={editWebsite}
                    onChange={(e) => setEditWebsite(e.target.value)}
                    className="w-full input-field text-sm"
                  />
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="px-6 py-4 border-t border-sage bg-paper/30 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn-secondary py-2 px-5 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="btn-primary py-2 px-6 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submittingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: REGISTER NEW COMPANY */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-2xl w-full panel border border-sage shadow-2xl animate-fade-up overflow-hidden rounded-2xl bg-surface my-auto">
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-sage flex items-center justify-between bg-paper/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-teal-soft text-teal">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    Register Hiring Enterprise
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Create an enterprise corporate profile for campus recruitment drives
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCompanyModal(false)}
                className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper rounded-lg transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCompany}>
              <div className="p-6 space-y-4 max-h-[calc(85vh-130px)] overflow-y-auto modal-scroll">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Enterprise Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={compName}
                    onChange={(e) => setCompName(e.target.value)}
                    className="w-full input-field text-sm"
                    placeholder="e.g. Google India Pvt Ltd"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Industry
                    </label>
                    <input
                      type="text"
                      value={compIndustry}
                      onChange={(e) => setCompIndustry(e.target.value)}
                      className="w-full input-field text-sm"
                      placeholder="e.g. Technology / Fintech"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Headquarters / Location
                    </label>
                    <input
                      type="text"
                      value={compLocation}
                      onChange={(e) => setCompLocation(e.target.value)}
                      className="w-full input-field text-sm"
                      placeholder="e.g. Bangalore, India"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Official Website
                  </label>
                  <input
                    type="url"
                    value={compWebsite}
                    onChange={(e) => setCompWebsite(e.target.value)}
                    className="w-full input-field text-sm"
                    placeholder="https://www.google.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows="3"
                    value={compDescription}
                    onChange={(e) => setCompDescription(e.target.value)}
                    className="w-full input-field text-sm"
                    placeholder="Brief overview of business operations, hiring profile, and technology domain..."
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-1 p-3 bg-paper/60 rounded-xl border border-sage/60">
                  <input
                    type="checkbox"
                    id="compVerify"
                    checked={compVerifyOnCreate}
                    onChange={(e) => setCompVerifyOnCreate(e.target.checked)}
                    className="rounded text-teal focus:ring-teal h-4 w-4"
                  />
                  <label htmlFor="compVerify" className="text-xs text-ink font-semibold select-none cursor-pointer">
                    Approve Platform Verification Immediately (allows placement officers to authorize for campus)
                  </label>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="px-6 py-4 border-t border-sage bg-paper/30 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCompanyModal(false)}
                  className="btn-secondary py-2 px-5 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCompany}
                  className="btn-primary py-2 px-6 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submittingCompany ? "Registering..." : "Register Enterprise"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: PROVISION RECRUITER */}
      {showRecruiterModal && recruiterTargetCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-lg w-full panel border border-sage shadow-2xl animate-fade-up overflow-hidden rounded-2xl bg-surface my-auto">
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-sage flex items-center justify-between bg-paper/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-teal-soft text-teal">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    Provision Recruiter
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Create recruiter account for <strong>{recruiterTargetCompany.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRecruiterModal(false)}
                className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper rounded-lg transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProvisionRecruiter}>
              <div className="p-6 space-y-4 max-h-[calc(85vh-130px)] overflow-y-auto modal-scroll">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Recruiter Full Name <span className="text-red-500">*</span>
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Recruiter Official Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={recruiterEmail}
                    onChange={(e) => setRecruiterEmail(e.target.value)}
                    className="w-full input-field text-sm"
                    placeholder="e.g. priya.sharma@company.com"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Designation
                    </label>
                    <input
                      type="text"
                      value={recruiterDesignation}
                      onChange={(e) => setRecruiterDesignation(e.target.value)}
                      className="w-full input-field text-sm"
                      placeholder="e.g. Talent Acquisition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                      Phone
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Temporary Password (Optional)
                  </label>
                  <PasswordInput
                    value={recruiterPassword}
                    onChange={(e) => setRecruiterPassword(e.target.value)}
                    placeholder="Leave empty to auto-generate"
                  />
                  <span className="text-[11px] text-ink-muted mt-1 block">
                    A secure temporary password will be auto-generated and displayed once.
                  </span>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="px-6 py-4 border-t border-sage bg-paper/30 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRecruiterModal(false)}
                  className="btn-secondary py-2 px-5 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRecruiter}
                  className="btn-primary py-2 px-6 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submittingRecruiter ? "Provisioning..." : "Provision Recruiter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: AUTHORIZE COMPANY FOR CAMPUS */}
      {showCampusAuthModal && selectedCompanyForAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-md w-full panel border border-sage shadow-2xl animate-fade-up overflow-hidden rounded-2xl bg-surface my-auto">
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-sage flex items-center justify-between bg-paper/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-teal-soft text-teal">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-ink">
                    Authorize Campus Placement
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Authorize <strong>{selectedCompanyForAuth.name}</strong> for recruiting
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCampusAuthModal(false)}
                className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper rounded-lg transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAuthorizeCampus}>
              <div className="p-6 space-y-4">
                <p className="text-xs text-ink-muted">
                  Authorize this enterprise to recruit from the selected college campus and provision recruiter accounts.
                </p>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                    Target Campus / Institute <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={authTargetInstitute}
                    onChange={(e) => setAuthTargetInstitute(e.target.value)}
                    className="w-full input-field text-sm bg-white"
                  >
                    <option value="">Select an active institute...</option>
                    {activeInstitutes.map((inst) => (
                      <option key={inst._id} value={inst._id}>
                        {inst.name} ({inst.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="px-6 py-4 border-t border-sage bg-paper/30 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCampusAuthModal(false)}
                  className="btn-secondary py-2 px-5 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCampusAuth || !authTargetInstitute}
                  className="btn-primary py-2 px-6 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submittingCampusAuth ? "Authorizing..." : "Authorize Campus"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: TEMPORARY CREDENTIAL VIEWER */}
      {credentialModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-md w-full panel border-2 border-teal shadow-2xl animate-fade-up overflow-hidden rounded-2xl bg-surface my-auto">
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-sage flex items-center justify-between bg-teal-soft/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-teal text-white">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    Generated Credentials
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Secure one-time provisioning details
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCredentialModal({ isOpen: false, name: "", email: "", role: "", temporaryPassword: "" })}
                className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper rounded-lg transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                <strong>Important:</strong> This temporary password is displayed only once. Please copy and provide it securely to the user. They will be required to set a permanent password upon first login.
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-2.5 bg-paper rounded-xl">
                  <span className="text-ink-muted block uppercase font-bold text-[10px]">User Name</span>
                  <span className="text-ink font-semibold text-sm">{credentialModal.name}</span>
                </div>
                <div className="p-2.5 bg-paper rounded-xl">
                  <span className="text-ink-muted block uppercase font-bold text-[10px]">Email (Login ID)</span>
                  <span className="text-ink font-semibold text-sm">{credentialModal.email}</span>
                </div>
                <div className="p-2.5 bg-paper rounded-xl">
                  <span className="text-ink-muted block uppercase font-bold text-[10px]">Assigned Role</span>
                  <span className="text-ink font-semibold">{roleLabel(credentialModal.role)}</span>
                </div>
                <div>
                  <span className="text-ink-muted block uppercase font-bold text-[10px] mb-1">Temporary Password</span>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-teal-soft/60 border border-teal/30 font-mono text-sm font-bold text-teal-deep select-all">
                    <span>{credentialModal.temporaryPassword}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(credentialModal.temporaryPassword)}
                      className="p-1.5 text-teal hover:bg-teal hover:text-white rounded-lg transition cursor-pointer"
                      title="Copy to clipboard"
                    >
                      {copiedCredential ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-sage bg-paper/30 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => copyToClipboard(`Email: ${credentialModal.email}\nTemporary Password: ${credentialModal.temporaryPassword}`)}
                className="btn-secondary py-2 px-4 text-xs inline-flex items-center gap-1.5 cursor-pointer"
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

export default AdminDashboard;
