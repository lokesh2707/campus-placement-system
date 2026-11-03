import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Save,
  LayoutDashboard,
  User,
  GraduationCap,
  Code,
  FolderGit2,
  Briefcase,
  Award,
  FileText,
  Upload,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Wand2,
} from "lucide-react";
import { ProfileSkeleton, ButtonSpinner } from "../../components/Loader";

const PROFILE_TABS = [
  "personal",
  "academic",
  "skills",
  "projects",
  "experience",
  "certifications",
  "resume",
];

const ProfilePage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const redirectTimerRef = useRef(null);

  const [activeTab, setActiveTab] = useState("personal");
  const tabIndex = PROFILE_TABS.indexOf(activeTab);
  const isFirstTab = tabIndex <= 0;
  const isLastTab = tabIndex === PROFILE_TABS.length - 1;

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "India",
    },
    rollNumber: "",
    department: "Computer Science & Engineering",
    degree: "B.Tech",
    instituteName: "",
    batch: 2026,
    cgpa: 8.0,
    backlogs: 0,
    activeBacklogs: 0,
    academicHistory: {
      tenthPercentage: "",
      twelfthPercentage: "",
      diplomaPercentage: "",
    },
    skills: [],
    technicalSkills: [],
    languages: [],
    frameworks: [],
    databases: [],
    tools: [],
    projects: [],
    experience: [],
    certifications: [],
    placementStatus: "seeking",
    resumeUrl: "",
    resumeFileName: "",
    githubUrl: "",
    linkedinUrl: "",
    portfolioUrl: "",
    professionalSummary: "",
  });

  // Inputs for adding items
  const [skillInput, setSkillInput] = useState("");
  const [langInput, setLangInput] = useState("");
  const [frameInput, setFrameInput] = useState("");
  const [dbInput, setDbInput] = useState("");
  const [toolInput, setToolInput] = useState("");

  // Resume upload state
  const [resumeFile, setResumeFile] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeMsg, setResumeMsg] = useState("");

  // AI draft state (not persisted until Save Profile)
  const [summaryGenerating, setSummaryGenerating] = useState(false);
  const [projectImprovingIndex, setProjectImprovingIndex] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const resolveInstituteName = (profileInstitute) => {
      if (profileInstitute && typeof profileInstitute === "object" && profileInstitute.name) {
        return profileInstitute.name;
      }
      if (user?.institute && typeof user.institute === "object" && user.institute.name) {
        return user.institute.name;
      }
      return "";
    };

    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/students/profile/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!isMounted) return;

        // Always start from registration identity (name / email / institute / roll)
        const registrationDefaults = {
          name: user?.name || "",
          phone: user?.phone || "",
          dateOfBirth: "",
          gender: "",
          address: {
            street: "",
            city: "",
            state: "",
            zipCode: "",
            country: "India",
          },
          rollNumber: "",
          department: "Computer Science & Engineering",
          degree: "B.Tech",
          instituteName: resolveInstituteName(null),
          batch: 2026,
          cgpa: 8.0,
          backlogs: 0,
          activeBacklogs: 0,
          academicHistory: {
            tenthPercentage: "",
            twelfthPercentage: "",
            diplomaPercentage: "",
          },
          skills: [],
          technicalSkills: [],
          languages: [],
          frameworks: [],
          databases: [],
          tools: [],
          projects: [],
          experience: [],
          certifications: [],
          placementStatus: "seeking",
          resumeUrl: "",
          resumeFileName: "",
          githubUrl: "",
          linkedinUrl: "",
          portfolioUrl: "",
          professionalSummary: "",
        };

        if (data.success && data.profile) {
          const p = data.profile;
          setFormData({
            ...registrationDefaults,
            name: p.user?.name || user?.name || "",
            phone: p.phone || p.user?.phone || "",
            dateOfBirth: p.dateOfBirth ? p.dateOfBirth.substring(0, 10) : "",
            gender: p.gender || "",
            address: {
              street: p.address?.street || "",
              city: p.address?.city || "",
              state: p.address?.state || "",
              zipCode: p.address?.zipCode || "",
              country: p.address?.country || "India",
            },
            rollNumber: p.rollNumber || "",
            department: p.department || "Computer Science & Engineering",
            degree: p.degree || "B.Tech",
            instituteName: resolveInstituteName(p.institute),
            batch: p.batch || 2026,
            cgpa: p.cgpa !== undefined && p.cgpa !== null ? p.cgpa : 8.0,
            backlogs: p.backlogs || 0,
            activeBacklogs: p.activeBacklogs || 0,
            academicHistory: {
              tenthPercentage: p.academicHistory?.tenthPercentage ?? "",
              twelfthPercentage: p.academicHistory?.twelfthPercentage ?? "",
              diplomaPercentage: p.academicHistory?.diplomaPercentage ?? "",
            },
            skills: p.skills || [],
            technicalSkills: p.technicalSkills || [],
            languages: p.languages || [],
            frameworks: p.frameworks || [],
            databases: p.databases || [],
            tools: p.tools || [],
            projects: (p.projects || []).map((proj) => ({
              ...proj,
              aiEnhancedDescription: proj.aiEnhancedDescription || "",
              aiEnhancedApproved: Boolean(proj.aiEnhancedApproved),
              aiEnhancedSourceHash: proj.aiEnhancedSourceHash || "",
            })),
            experience: p.experience || [],
            certifications: p.certifications || [],
            placementStatus: p.placementStatus || "seeking",
            resumeUrl: p.resumeUrl || "",
            resumeFileName: p.resumeFileName || "",
            githubUrl: p.githubUrl || "",
            linkedinUrl: p.linkedinUrl || "",
            portfolioUrl: p.portfolioUrl || "",
            professionalSummary: p.professionalSummary || "",
          });
        } else {
          setFormData(registrationDefaults);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        if (isMounted) {
          setFormData((prev) => ({
            ...prev,
            name: user?.name || prev.name,
            instituteName:
              (user?.institute && typeof user.institute === "object" && user.institute.name) ||
              prev.instituteName,
          }));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (token) fetchProfile();
    else setLoading(false);

    return () => {
      isMounted = false;
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [token, user]);

  // Skill management helpers
  const handleAddCategorySkill = (category, value, setter) => {
    if (!value.trim()) return;
    const trimmed = value.trim();
    if (!formData[category].includes(trimmed)) {
      const updated = [...formData[category], trimmed];
      const allSkills = Array.from(new Set([...formData.skills, trimmed]));
      setFormData({ ...formData, [category]: updated, skills: allSkills });
    }
    setter("");
  };

  const handleRemoveCategorySkill = (category, item) => {
    const updated = formData[category].filter((x) => x !== item);
    setFormData({ ...formData, [category]: updated });
  };

  // Projects helpers
  const handleAddProject = () => {
    setFormData({
      ...formData,
      projects: [
        ...formData.projects,
        {
          title: "",
          description: "",
          technologies: [],
          link: "",
          githubUrl: "",
          liveUrl: "",
          aiEnhancedDescription: "",
          aiEnhancedApproved: false,
          aiEnhancedSourceHash: "",
        },
      ],
    });
  };

  const handleUpdateProject = (index, field, value) => {
    const updated = [...formData.projects];
    updated[index] = { ...updated[index], [field]: value };
    // Editing original description invalidates prior AI approval until re-accepted
    if (field === "description" || field === "title" || field === "technologies") {
      updated[index].aiEnhancedApproved = false;
    }
    setFormData({ ...formData, projects: updated });
  };

  const handleGenerateSummary = async () => {
    setSummaryGenerating(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/resume-builder/ai/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "AI summary generation failed");
      setFormData((prev) => ({ ...prev, professionalSummary: data.summary || prev.professionalSummary }));
    } catch (err) {
      setErrorMsg(err.message || "AI generation failed. Please try again later.");
    } finally {
      setSummaryGenerating(false);
    }
  };

  const handleImproveProject = async (index) => {
    const proj = formData.projects[index];
    if (!proj?.title?.trim() || !proj?.description?.trim()) {
      setErrorMsg("Add a project title and original description before improving with AI.");
      return;
    }
    setProjectImprovingIndex(index);
    setErrorMsg("");
    try {
      const res = await fetch("/api/resume-builder/ai/project-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: proj.title,
          description: proj.description,
          technologies: proj.technologies || [],
          projectIndex: index,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "AI project improvement failed");
      const updated = [...formData.projects];
      updated[index] = {
        ...updated[index],
        aiEnhancedDescription: data.improvedDescription || "",
        aiEnhancedApproved: false,
        aiEnhancedSourceHash: data.sourceHash || "",
      };
      setFormData({ ...formData, projects: updated });
    } catch (err) {
      setErrorMsg(err.message || "AI generation failed. Please try again later.");
    } finally {
      setProjectImprovingIndex(null);
    }
  };

  const handleApproveProjectEnhancement = (index) => {
    const updated = [...formData.projects];
    if (!updated[index]?.aiEnhancedDescription?.trim()) return;
    updated[index] = {
      ...updated[index],
      aiEnhancedApproved: true,
    };
    setFormData({ ...formData, projects: updated });
  };

  const handleRemoveProject = (index) => {
    setFormData({
      ...formData,
      projects: formData.projects.filter((_, i) => i !== index),
    });
  };

  // Experience helpers
  const handleAddExperience = () => {
    setFormData({
      ...formData,
      experience: [
        ...formData.experience,
        { role: "", company: "", duration: "", description: "" },
      ],
    });
  };

  const handleUpdateExperience = (index, field, value) => {
    const updated = [...formData.experience];
    updated[index][field] = value;
    setFormData({ ...formData, experience: updated });
  };

  const handleRemoveExperience = (index) => {
    setFormData({
      ...formData,
      experience: formData.experience.filter((_, i) => i !== index),
    });
  };

  // Certifications helpers
  const handleAddCertification = () => {
    setFormData({
      ...formData,
      certifications: [
        ...formData.certifications,
        { title: "", issuingOrganization: "", credentialUrl: "", credentialId: "" },
      ],
    });
  };

  const handleUpdateCertification = (index, field, value) => {
    const updated = [...formData.certifications];
    updated[index][field] = value;
    setFormData({ ...formData, certifications: updated });
  };

  const handleRemoveCertification = (index) => {
    setFormData({
      ...formData,
      certifications: formData.certifications.filter((_, i) => i !== index),
    });
  };

  // Resume upload handler
  const handleUploadResumeFile = async (e) => {
    e.preventDefault();
    if (!resumeFile) return;

    if (!resumeFile.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg("Only PDF resumes (.pdf) are permitted");
      return;
    }

    if (resumeFile.size > 5 * 1024 * 1024) {
      setErrorMsg("Resume file size cannot exceed 5MB");
      return;
    }

    setUploadingResume(true);
    setErrorMsg("");
    setResumeMsg("");

    const data = new FormData();
    data.append("resume", resumeFile);

    try {
      const res = await fetch("/api/students/profile/resume", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: data,
      });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.message || "Failed to upload resume");

      setResumeMsg("Resume uploaded successfully!");
      setFormData((prev) => ({
        ...prev,
        resumeUrl: resJson.resume?.resumeUrl || resJson.profile?.resumeUrl,
        resumeFileName: resJson.resume?.fileName || resumeFile.name,
      }));
      setResumeFile(null);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setUploadingResume(false);
    }
  };

  // Resume delete handler
  const handleDeleteResume = async () => {
    if (!window.confirm("Are you sure you want to remove your resume?")) return;
    try {
      const res = await fetch("/api/students/profile/resume", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.message || "Failed to delete resume");

      setResumeMsg("Resume deleted successfully");
      setFormData((prev) => ({ ...prev, resumeUrl: "", resumeFileName: "" }));
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const validateTab = (tab) => {
    if (tab === "personal") {
      if (!String(formData.name || user?.name || "").trim()) {
        return "Registered name is missing. Please contact your placement officer.";
      }
    }
    if (tab === "academic") {
      if (!String(formData.rollNumber || "").trim()) {
        return "Registered roll number is missing. Please contact your placement officer.";
      }
      if (!String(formData.department || "").trim()) {
        return "Department is required before continuing.";
      }
      const batch = Number(formData.batch);
      if (!Number.isFinite(batch) || batch < 2000 || batch > 2050) {
        return "Enter a valid graduation batch year (2000–2050).";
      }
      const cgpa = Number(formData.cgpa);
      if (!Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10) {
        return "CGPA must be a number between 0.0 and 10.0.";
      }
    }
    return "";
  };

  const goToTab = (tab) => {
    setErrorMsg("");
    setActiveTab(tab);
  };

  const goBack = () => {
    if (isFirstTab) return;
    goToTab(PROFILE_TABS[tabIndex - 1]);
  };

  const goNext = () => {
    const validationError = validateTab(activeTab);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }
    if (isLastTab) return;
    // Defer tab change so the Next click cannot land on a newly rendered Save button
    const nextTab = PROFILE_TABS[tabIndex + 1];
    window.setTimeout(() => goToTab(nextTab), 0);
  };

  const normalizeOptionalHttpsUrl = (raw) => {
    const value = String(raw || "").trim();
    if (!value) return "";
    if (/^https:\/\//i.test(value)) return value;
    if (/^http:\/\//i.test(value)) return `https://${value.slice(7)}`;
    return `https://${value}`;
  };

  // Explicit save only — never triggered by incidental form submit / Enter key
  // options.redirectTo: navigate after save (default dashboard). Use null to skip redirect.
  const saveProfile = async (options = {}) => {
    const { redirectTo = searchParams.get("redirect") || "/student/dashboard", silent = false } =
      options;

    for (const tab of ["personal", "academic"]) {
      const validationError = validateTab(tab);
      if (validationError) {
        setErrorMsg(validationError);
        setActiveTab(tab);
        return false;
      }
    }

    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");
    if (!silent) setIsRedirecting(false);

    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);

    try {
      const toOptionalNumber = (value) => {
        if (value === "" || value === null || value === undefined) return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const {
        instituteName: _instituteName,
        educationInstitution: _educationInstitution,
        graduationYear: _graduationYear,
        ...restForm
      } = formData;

      const payload = {
        ...restForm,
        // Identity fields stay locked to registration values
        name: formData.name || user?.name || "",
        rollNumber: formData.rollNumber,
        batch: toOptionalNumber(formData.batch) ?? 2026,
        cgpa: toOptionalNumber(formData.cgpa) ?? 0,
        backlogs: toOptionalNumber(formData.backlogs) ?? 0,
        activeBacklogs: toOptionalNumber(formData.activeBacklogs) ?? 0,
        githubUrl: normalizeOptionalHttpsUrl(formData.githubUrl),
        linkedinUrl: normalizeOptionalHttpsUrl(formData.linkedinUrl),
        portfolioUrl: normalizeOptionalHttpsUrl(formData.portfolioUrl),
        professionalSummary: formData.professionalSummary || "",
        academicHistory: {
          tenthPercentage: toOptionalNumber(formData.academicHistory?.tenthPercentage),
          twelfthPercentage: toOptionalNumber(formData.academicHistory?.twelfthPercentage),
          diplomaPercentage: toOptionalNumber(formData.academicHistory?.diplomaPercentage),
          semesters: Array.isArray(formData.academicHistory?.semesters)
            ? formData.academicHistory.semesters
            : [],
        },
      };

      // Empty optional URLs: omit so backend does not reject; keep prior DB values if clearing not intended
      if (!payload.githubUrl) delete payload.githubUrl;
      if (!payload.linkedinUrl) delete payload.linkedinUrl;
      if (!payload.portfolioUrl) delete payload.portfolioUrl;

      const res = await fetch("/api/students/profile/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to update profile");
      }

      if (redirectTo) {
        setSuccessMsg("Your academic profile has been successfully saved! Redirecting...");
        setIsRedirecting(true);
        redirectTimerRef.current = setTimeout(() => {
          navigate(redirectTo, { replace: true });
        }, silent ? 400 : 1200);
      } else {
        setSuccessMsg("Profile saved.");
      }
      return true;
    } catch (err) {
      setErrorMsg(err.message || "Failed to save profile. Please verify your details.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleCreateResume = async () => {
    const ok = await saveProfile({ redirectTo: null, silent: true });
    if (!ok) return;
    navigate("/student/resume-builder", {
      state: {
        profileDraft: {
          githubUrl: formData.githubUrl,
          linkedinUrl: formData.linkedinUrl,
          portfolioUrl: formData.portfolioUrl,
          professionalSummary: formData.professionalSummary,
          name: formData.name,
          phone: formData.phone,
          skills: formData.skills,
          projects: formData.projects,
          experience: formData.experience,
          certifications: formData.certifications,
          degree: formData.degree,
          department: formData.department,
          batch: formData.batch,
          cgpa: formData.cgpa,
          rollNumber: formData.rollNumber,
          instituteName: formData.instituteName,
        },
      },
    });
  };

  // Block native form submit (Enter key / accidental submit). Save only via Save Profile button.
  const handleFormSubmit = (e) => {
    e.preventDefault();
  };

  if (loading) return <ProfileSkeleton />;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-up">
      {/* Page Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-teal uppercase tracking-widest">
              Student Profile
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="text-xs text-ink-muted">Academic & Skill Portfolio</span>
          </div>
          <h1 className="text-3xl font-display font-semibold text-ink tracking-tight">
            Academic & Placement Profile
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Manage your personal data, verified coursework, categorized skills, and resume.
          </p>
        </div>
        <Link
          to="/student/dashboard"
          className="btn-secondary px-4 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 self-start md:self-auto"
        >
          <LayoutDashboard className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm shadow-xs animate-fade-up">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
              <p className="font-semibold text-emerald-950">{successMsg}</p>
            </div>
            <Link
              to="/student/dashboard"
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
            </Link>
          </div>
          <div className="mt-3 w-full bg-emerald-200/60 rounded-full h-1 overflow-hidden">
            <div className="bg-emerald-600 h-1 rounded-full animate-pulse" style={{ width: "100%" }} />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between gap-2 animate-fade-up">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg("")} className="text-red-700 hover:text-red-900 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section progress */}
      <div className="mb-3 flex items-center justify-between text-xs text-ink-muted">
        <span>
          Step {Math.max(tabIndex, 0) + 1} of {PROFILE_TABS.length}
        </span>
        <span className="font-medium text-ink capitalize">
          {activeTab === "certifications"
            ? "Certifications"
            : activeTab === "personal"
              ? "Personal Info"
              : activeTab === "academic"
                ? "Academic Info"
                : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
        </span>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-sage mb-6 gap-2">
        <button
          type="button"
          onClick={() => goToTab("personal")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 border-b-2 ${
            activeTab === "personal"
              ? "border-teal text-teal bg-surface"
              : "border-transparent text-ink-muted hover:text-ink hover:bg-paper"
          }`}
        >
          <User className="w-3.5 h-3.5" /> Personal Info
        </button>
        <button
          type="button"
          onClick={() => goToTab("academic")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 border-b-2 ${
            activeTab === "academic"
              ? "border-teal text-teal bg-surface"
              : "border-transparent text-ink-muted hover:text-ink hover:bg-paper"
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" /> Academic Info
        </button>
        <button
          type="button"
          onClick={() => goToTab("skills")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 border-b-2 ${
            activeTab === "skills"
              ? "border-teal text-teal bg-surface"
              : "border-transparent text-ink-muted hover:text-ink hover:bg-paper"
          }`}
        >
          <Code className="w-3.5 h-3.5" /> Skills
        </button>
        <button
          type="button"
          onClick={() => goToTab("projects")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 border-b-2 ${
            activeTab === "projects"
              ? "border-teal text-teal bg-surface"
              : "border-transparent text-ink-muted hover:text-ink hover:bg-paper"
          }`}
        >
          <FolderGit2 className="w-3.5 h-3.5" /> Projects ({formData.projects.length})
        </button>
        <button
          type="button"
          onClick={() => goToTab("experience")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 border-b-2 ${
            activeTab === "experience"
              ? "border-teal text-teal bg-surface"
              : "border-transparent text-ink-muted hover:text-ink hover:bg-paper"
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" /> Experience ({formData.experience.length})
        </button>
        <button
          type="button"
          onClick={() => goToTab("certifications")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 border-b-2 ${
            activeTab === "certifications"
              ? "border-teal text-teal bg-surface"
              : "border-transparent text-ink-muted hover:text-ink hover:bg-paper"
          }`}
        >
          <Award className="w-3.5 h-3.5" /> Certifications ({formData.certifications.length})
        </button>
        <button
          type="button"
          onClick={() => goToTab("resume")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 border-b-2 ${
            activeTab === "resume"
              ? "border-teal text-teal bg-surface"
              : "border-transparent text-ink-muted hover:text-ink hover:bg-paper"
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Resume {formData.resumeUrl ? "✓" : "!"}
        </button>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* TAB 1: PERSONAL INFORMATION */}
        {activeTab === "personal" && (
          <div className="panel p-6 shadow-xs space-y-5 bg-surface border-sage">
            <h2 className="text-lg font-semibold text-ink border-b border-sage pb-3">
              Personal Information
            </h2>
            <p className="text-xs text-ink-muted -mt-2">
              Name, email, institute, and roll number come from student registration and cannot be changed here.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  disabled
                  value={formData.name || user?.name || ""}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm bg-paper text-ink-muted cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Student Email
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ""}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm bg-paper text-ink-muted cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Affiliated Institute
                </label>
                <input
                  type="text"
                  disabled
                  value={formData.instituteName || "—"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm bg-paper text-ink-muted cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  College Roll Number
                </label>
                <input
                  type="text"
                  disabled
                  value={formData.rollNumber || ""}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm bg-paper text-ink-muted cursor-not-allowed font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Contact Phone Number
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  GitHub URL
                </label>
                <input
                  type="url"
                  value={formData.githubUrl}
                  onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
                  placeholder="https://github.com/username"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={formData.linkedinUrl}
                  onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Portfolio URL
                </label>
                <input
                  type="url"
                  value={formData.portfolioUrl}
                  onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                  placeholder="https://your-portfolio.example"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider">
                    Professional Summary
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateSummary}
                    disabled={summaryGenerating}
                    className="text-xs font-semibold text-teal hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {summaryGenerating ? "Generating..." : "Generate with AI"}
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={formData.professionalSummary}
                  onChange={(e) =>
                    setFormData({ ...formData, professionalSummary: e.target.value })
                  }
                  placeholder="Optional summary for your resume. Generate with AI, then edit and save with your profile."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                />
                <p className="text-[11px] text-ink-muted mt-1">
                  AI drafts are not saved until you click Save Profile on the final step.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Gender
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Placement Status
                </label>
                <select
                  value={formData.placementStatus}
                  onChange={(e) => setFormData({ ...formData, placementStatus: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                >
                  <option value="seeking">Seeking Placement</option>
                  <option value="placed">Placed</option>
                  <option value="opted_out">Opted Out</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">
                Residential Address
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-3">
                  <input
                    type="text"
                    placeholder="Street / Flat / Area"
                    value={formData.address.street}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, street: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-sage text-xs focus:ring-2 focus:ring-teal bg-white"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="City"
                    value={formData.address.city}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, city: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-sage text-xs focus:ring-2 focus:ring-teal bg-white"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="State"
                    value={formData.address.state}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, state: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-sage text-xs focus:ring-2 focus:ring-teal bg-white"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Postal / PIN Code"
                    value={formData.address.zipCode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, zipCode: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-sage text-xs focus:ring-2 focus:ring-teal bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ACADEMIC INFORMATION */}
        {activeTab === "academic" && (
          <div className="panel p-6 shadow-xs space-y-5 bg-surface border-sage">
            <h2 className="text-lg font-semibold text-ink border-b border-sage pb-3">
              Academic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Degree / Program
                </label>
                <input
                  type="text"
                  value={formData.degree}
                  onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                  placeholder="e.g. B.Tech, M.Tech, MCA, B.Sc"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Department / Branch
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                >
                  <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Electronics & Communication">Electronics & Communication</option>
                  <option value="Electrical Engineering">Electrical Engineering</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Data Science & AI">Data Science & AI</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Graduation Batch Year
                </label>
                <input
                  type="number"
                  min="2000"
                  max="2050"
                  required
                  value={formData.batch}
                  onChange={(e) =>
                    setFormData({ ...formData, batch: parseInt(e.target.value, 10) || 2026 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Cumulative CGPA (0.0 - 10.0)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  required
                  value={formData.cgpa}
                  onChange={(e) =>
                    setFormData({ ...formData, cgpa: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Total Backlogs
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={formData.backlogs}
                  onChange={(e) =>
                    setFormData({ ...formData, backlogs: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Active Backlogs
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={formData.activeBacklogs}
                  onChange={(e) =>
                    setFormData({ ...formData, activeBacklogs: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Secondary (10th) Percentage
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.academicHistory.tenthPercentage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      academicHistory: {
                        ...formData.academicHistory,
                        tenthPercentage: e.target.value,
                      },
                    })
                  }
                  placeholder="e.g. 91.5"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Higher Secondary (12th) Percentage
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.academicHistory.twelfthPercentage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      academicHistory: {
                        ...formData.academicHistory,
                        twelfthPercentage: e.target.value,
                      },
                    })
                  }
                  placeholder="e.g. 88.0"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CATEGORIZED SKILLS */}
        {activeTab === "skills" && (
          <div className="panel p-6 shadow-xs space-y-6 bg-surface border-sage">
            <div className="border-b border-sage pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Skills & Competency Taxonomy</h2>
                <p className="text-xs text-ink-muted">
                  Categorized skills power precision matching against recruiter job requirements.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-teal-soft text-teal rounded-full border border-teal/20">
                {formData.skills.length} Total Skills Indexed
              </span>
            </div>

            {/* Programming Languages */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-ink uppercase tracking-wider">
                Programming Languages
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Python, TypeScript, Java, C++"
                  value={langInput}
                  onChange={(e) => setLangInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-sage text-xs focus:ring-2 focus:ring-teal bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleAddCategorySkill("languages", langInput, setLangInput)}
                  className="px-3 py-2 bg-teal hover:bg-teal-deep text-white text-xs font-semibold rounded-xl"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-8 p-2 bg-paper rounded-lg border border-sage/60">
                {formData.languages.map((item) => (
                  <span key={item} className="px-2 py-0.5 bg-surface border border-sage text-xs rounded-md flex items-center gap-1 font-medium">
                    {item}
                    <button type="button" onClick={() => handleRemoveCategorySkill("languages", item)} className="text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Frameworks & Libraries */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-ink uppercase tracking-wider">
                Frameworks & Libraries
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. React, Express, Node.js, Spring Boot, PyTorch"
                  value={frameInput}
                  onChange={(e) => setFrameInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-sage text-xs focus:ring-2 focus:ring-teal bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleAddCategorySkill("frameworks", frameInput, setFrameInput)}
                  className="px-3 py-2 bg-teal hover:bg-teal-deep text-white text-xs font-semibold rounded-xl"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-8 p-2 bg-paper rounded-lg border border-sage/60">
                {formData.frameworks.map((item) => (
                  <span key={item} className="px-2 py-0.5 bg-surface border border-sage text-xs rounded-md flex items-center gap-1 font-medium">
                    {item}
                    <button type="button" onClick={() => handleRemoveCategorySkill("frameworks", item)} className="text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Databases */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-ink uppercase tracking-wider">
                Databases & Storage
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. MongoDB, PostgreSQL, Redis, MySQL"
                  value={dbInput}
                  onChange={(e) => setDbInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-sage text-xs focus:ring-2 focus:ring-teal bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleAddCategorySkill("databases", dbInput, setDbInput)}
                  className="px-3 py-2 bg-teal hover:bg-teal-deep text-white text-xs font-semibold rounded-xl"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-8 p-2 bg-paper rounded-lg border border-sage/60">
                {formData.databases.map((item) => (
                  <span key={item} className="px-2 py-0.5 bg-surface border border-sage text-xs rounded-md flex items-center gap-1 font-medium">
                    {item}
                    <button type="button" onClick={() => handleRemoveCategorySkill("databases", item)} className="text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Developer Tools */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-ink uppercase tracking-wider">
                Tools & Platforms
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Git, Docker, Kubernetes, Linux, Postman"
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-sage text-xs focus:ring-2 focus:ring-teal bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleAddCategorySkill("tools", toolInput, setToolInput)}
                  className="px-3 py-2 bg-teal hover:bg-teal-deep text-white text-xs font-semibold rounded-xl"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-8 p-2 bg-paper rounded-lg border border-sage/60">
                {formData.tools.map((item) => (
                  <span key={item} className="px-2 py-0.5 bg-surface border border-sage text-xs rounded-md flex items-center gap-1 font-medium">
                    {item}
                    <button type="button" onClick={() => handleRemoveCategorySkill("tools", item)} className="text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* General skills tag cloud */}
            <div className="pt-2">
              <label className="text-xs font-bold text-ink uppercase tracking-wider block mb-1">
                All Verified Technical Skills
              </label>
              <div className="flex flex-wrap gap-1.5 p-3 bg-paper rounded-xl border border-sage/60">
                {formData.skills.map((s) => (
                  <span key={s} className="px-2.5 py-1 bg-surface border border-sage text-teal rounded-lg text-xs font-semibold">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PROJECTS */}
        {activeTab === "projects" && (
          <div className="panel p-6 shadow-xs space-y-5 bg-surface border-sage">
            <div className="border-b border-sage pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Technical Projects</h2>
                <p className="text-xs text-ink-muted">
                  Showcase software repositories, live systems, and academic capstone deliverables.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddProject}
                className="px-3 py-1.5 bg-teal text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 hover:bg-teal-deep transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Project
              </button>
            </div>

            {formData.projects.length === 0 ? (
              <div className="text-center py-10 text-ink-muted text-xs">
                No projects added yet. Click &quot;Add Project&quot; to showcase your portfolio.
              </div>
            ) : (
              <div className="space-y-4">
                {formData.projects.map((proj, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-sage bg-paper space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink uppercase tracking-wider">
                        Project #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveProject(idx)}
                        className="text-red-600 hover:text-red-800 text-xs inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <input
                          type="text"
                          required
                          placeholder="Project Title *"
                          value={proj.title}
                          onChange={(e) => handleUpdateProject(idx, "title", e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-sage text-xs bg-white focus:ring-2 focus:ring-teal"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="GitHub Repository URL"
                          value={proj.githubUrl || ""}
                          onChange={(e) => handleUpdateProject(idx, "githubUrl", e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-sage text-xs bg-white focus:ring-2 focus:ring-teal"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                          Original description
                        </label>
                        <textarea
                          placeholder="Description & Key Contributions..."
                          rows={2}
                          value={proj.description}
                          onChange={(e) => handleUpdateProject(idx, "description", e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-sage text-xs bg-white focus:ring-2 focus:ring-teal"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleImproveProject(idx)}
                            disabled={projectImprovingIndex === idx}
                            className="px-3 py-1.5 border border-sage text-ink rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-surface disabled:opacity-50"
                          >
                            <Wand2 className="w-3 h-3" />
                            {projectImprovingIndex === idx ? "Improving..." : "Improve with AI"}
                          </button>
                          {proj.aiEnhancedDescription && !proj.aiEnhancedApproved && (
                            <button
                              type="button"
                              onClick={() => handleApproveProjectEnhancement(idx)}
                              className="px-3 py-1.5 bg-teal text-white rounded-lg text-[11px] font-semibold hover:bg-teal-deep"
                            >
                              Accept AI version
                            </button>
                          )}
                          {proj.aiEnhancedApproved && (
                            <span className="text-[11px] text-emerald-700 font-semibold">
                              AI version approved for resume
                            </span>
                          )}
                        </div>
                        {proj.aiEnhancedDescription && (
                          <div className="mt-2">
                            <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                              AI-enhanced description (editable)
                            </label>
                            <textarea
                              rows={3}
                              value={proj.aiEnhancedDescription}
                              onChange={(e) =>
                                handleUpdateProject(idx, "aiEnhancedDescription", e.target.value)
                              }
                              className="w-full px-3 py-2 rounded-xl border border-teal/30 text-xs bg-white focus:ring-2 focus:ring-teal"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: EXPERIENCE */}
        {activeTab === "experience" && (
          <div className="panel p-6 shadow-xs space-y-5 bg-surface border-sage">
            <div className="border-b border-sage pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Internships & Work Experience</h2>
                <p className="text-xs text-ink-muted">
                  Add commercial internships, apprenticeships, and technical industry experience.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddExperience}
                className="px-3 py-1.5 bg-teal text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 hover:bg-teal-deep transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Experience
              </button>
            </div>

            {formData.experience.length === 0 ? (
              <div className="text-center py-10 text-ink-muted text-xs">
                No work experience or internships recorded.
              </div>
            ) : (
              <div className="space-y-4">
                {formData.experience.map((exp, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-sage bg-paper space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink uppercase tracking-wider">
                        Role #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExperience(idx)}
                        className="text-red-600 hover:text-red-800 text-xs inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <input
                          type="text"
                          required
                          placeholder="Job Role / Title *"
                          value={exp.role}
                          onChange={(e) => handleUpdateExperience(idx, "role", e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-sage text-xs bg-white focus:ring-2 focus:ring-teal"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          required
                          placeholder="Company / Organization *"
                          value={exp.company}
                          onChange={(e) => handleUpdateExperience(idx, "company", e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-sage text-xs bg-white focus:ring-2 focus:ring-teal"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Duration (e.g. Jun 2025 - Aug 2025)"
                          value={exp.duration}
                          onChange={(e) => handleUpdateExperience(idx, "duration", e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-sage text-xs bg-white focus:ring-2 focus:ring-teal"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <textarea
                          placeholder="Key achievements and technologies utilized..."
                          rows={2}
                          value={exp.description}
                          onChange={(e) => handleUpdateExperience(idx, "description", e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-sage text-xs bg-white focus:ring-2 focus:ring-teal"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: CERTIFICATIONS */}
        {activeTab === "certifications" && (
          <div className="panel p-6 shadow-xs space-y-5 bg-surface border-sage">
            <div className="border-b border-sage pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Certifications & Credentials</h2>
                <p className="text-xs text-ink-muted">
                  Professional certifications from AWS, Microsoft, Google, or academic academies.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddCertification}
                className="px-3 py-1.5 bg-teal text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 hover:bg-teal-deep transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Certification
              </button>
            </div>

            {formData.certifications.length === 0 ? (
              <div className="text-center py-10 text-ink-muted text-xs">
                No certifications recorded yet.
              </div>
            ) : (
              <div className="space-y-4">
                {formData.certifications.map((cert, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-sage bg-paper space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink uppercase tracking-wider">
                        Certification #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCertification(idx)}
                        className="text-red-600 hover:text-red-800 text-xs inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <input
                          type="text"
                          required
                          placeholder="Certification Title *"
                          value={cert.title}
                          onChange={(e) => handleUpdateCertification(idx, "title", e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-sage text-xs bg-white focus:ring-2 focus:ring-teal"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Issuing Organization"
                          value={cert.issuingOrganization}
                          onChange={(e) => handleUpdateCertification(idx, "issuingOrganization", e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-sage text-xs bg-white focus:ring-2 focus:ring-teal"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          placeholder="Verification Credential URL"
                          value={cert.credentialUrl}
                          onChange={(e) => handleUpdateCertification(idx, "credentialUrl", e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-sage text-xs bg-white focus:ring-2 focus:ring-teal"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 7: RESUME MANAGEMENT */}
        {activeTab === "resume" && (
          <div className="panel p-6 shadow-xs space-y-5 bg-surface border-sage">
            <h2 className="text-lg font-semibold text-ink border-b border-sage pb-3">
              Resume Document Management
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl border border-sage bg-paper">
                <h3 className="text-sm font-semibold text-ink">Upload Resume</h3>
                <p className="text-xs text-ink-muted mt-1">
                  Use an existing PDF resume from your computer.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreateResume}
                disabled={saving}
                className="p-4 rounded-xl border border-teal/40 bg-teal-soft/40 hover:bg-teal-soft transition text-left disabled:opacity-60"
              >
                <h3 className="text-sm font-semibold text-teal inline-flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  {saving ? "Saving profile..." : "Create Resume"}
                </h3>
                <p className="text-xs text-ink-muted mt-1">
                  Saves your latest profile (links & summary included), then opens templates.
                </p>
              </button>
            </div>

            {resumeMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{resumeMsg}</span>
              </div>
            )}

            {formData.resumeUrl ? (
              <div className="p-4 bg-paper rounded-xl border border-sage flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-teal" />
                  <div>
                    <h3 className="font-semibold text-ink text-sm">
                      {formData.resumeFileName || "candidate_resume.pdf"}
                    </h3>
                    <p className="text-[11px] text-ink-muted">PDF Document uploaded and verified</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/api/students/profile/resume"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-teal text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-teal-deep"
                  >
                    <Download className="w-3.5 h-3.5" /> View
                  </a>
                  <button
                    type="button"
                    onClick={handleDeleteResume}
                    className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 border-2 border-dashed border-sage rounded-2xl bg-paper">
                <FileText className="w-10 h-10 text-ink-muted mx-auto mb-2" />
                <p className="text-sm font-semibold text-ink">No resume uploaded</p>
                <p className="text-xs text-ink-muted mt-1">Upload a PDF document up to 5MB.</p>
              </div>
            )}

            {/* Upload or replace section */}
            <div className="pt-4 border-t border-sage">
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-2">
                {formData.resumeUrl ? "Replace Resume (PDF Only)" : "Upload New Resume (PDF Only)"}
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setResumeFile(e.target.files[0] || null)}
                  className="w-full text-xs text-ink-muted file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-soft file:text-teal hover:file:bg-teal/20"
                />
                <button
                  type="button"
                  disabled={!resumeFile || uploadingResume}
                  onClick={handleUploadResumeFile}
                  className="w-full sm:w-auto px-5 py-2 bg-teal hover:bg-teal-deep text-white text-xs font-semibold rounded-xl transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  {uploadingResume ? (
                    <>
                      <ButtonSpinner className="w-3.5 h-3.5" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>{formData.resumeUrl ? "Replace Resume" : "Upload Resume"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step navigation: Next through sections, Save only on Resume */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-sage">
          <p className="text-xs text-ink-muted">
            {isLastTab
              ? "Review your resume, then save to complete your academic profile."
              : "Complete each section, then continue. Profile is saved on the final Resume step."}
          </p>
          <div className="flex w-full sm:w-auto items-center gap-3">
            {!isFirstTab && (
              <button
                type="button"
                onClick={goBack}
                disabled={saving || isRedirecting}
                className="flex-1 sm:flex-none px-5 py-3 border border-sage text-ink font-semibold rounded-xl text-sm hover:bg-paper transition inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            {!isLastTab && (
              <button
                type="button"
                onClick={goNext}
                className="flex-1 sm:flex-none px-8 py-3 bg-teal hover:bg-teal-deep text-white font-semibold rounded-xl text-sm transition shadow-sm inline-flex items-center justify-center gap-1.5"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {isLastTab && (
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving || isRedirecting}
                className="flex-1 sm:flex-none px-8 py-3 bg-teal hover:bg-teal-deep text-white font-semibold rounded-xl text-sm transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {saving ? (
                  <>
                    <ButtonSpinner className="w-4 h-4 text-white" />
                    <span>Saving Profile...</span>
                  </>
                ) : isRedirecting ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Saved! Redirecting...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Profile</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default ProfilePage;
