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
  Pencil,
  Eye,
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

/** Text inputs that only accept whole numbers */
const digitsOnly = (value, maxLen = 4) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, maxLen);

/** Text inputs that only accept decimals (one dot) */
const decimalOnly = (value, maxLen = 6) => {
  const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  const normalized =
    dot === -1
      ? cleaned
      : cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
  return normalized.slice(0, maxLen);
};

const SKILL_SUGGESTIONS = {
  languages: [
    "Python",
    "Java",
    "JavaScript",
    "TypeScript",
    "C",
    "C++",
    "C#",
    "Go",
    "Kotlin",
    "Swift",
    "PHP",
    "Ruby",
    "Rust",
    "SQL",
    "R",
    "Scala",
  ],
  frameworks: [
    "React",
    "Next.js",
    "Angular",
    "Vue.js",
    "Node.js",
    "Express",
    "NestJS",
    "Spring Boot",
    "Django",
    "Flask",
    "FastAPI",
    "Laravel",
    ".NET",
    "Flutter",
    "React Native",
    "Tailwind CSS",
    "Redux",
  ],
  databases: [
    "MySQL",
    "PostgreSQL",
    "MongoDB",
    "Redis",
    "SQLite",
    "Oracle",
    "SQL Server",
    "Firebase",
    "DynamoDB",
    "Elasticsearch",
  ],
  tools: [
    "Git",
    "GitHub",
    "Docker",
    "Kubernetes",
    "Linux",
    "Postman",
    "AWS",
    "Azure",
    "GCP",
    "Jenkins",
    "CI/CD",
    "VS Code",
    "Jira",
    "Figma",
    "Nginx",
    "Terraform",
  ],
};

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
  const [isEditing, setIsEditing] = useState(
    () => Boolean(searchParams.get("redirect") || searchParams.get("edit") === "1")
  );
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
    batch: "2026",
    cgpa: "8.0",
    backlogs: "0",
    activeBacklogs: "0",
    academicHistory: {
      collegeStartYear: "",
      intermediateName: "",
      intermediateDuration: "",
      schoolName: "",
      schoolDuration: "",
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
  const [generatedResumes, setGeneratedResumes] = useState([]);
  const [downloadingResumeId, setDownloadingResumeId] = useState(null);
  const [downloadTarget, setDownloadTarget] = useState(null); // generated resume object
  const [downloadFileName, setDownloadFileName] = useState("");
  const [viewingResumeId, setViewingResumeId] = useState(null);
  const [experienceImprovingIndex, setExperienceImprovingIndex] = useState(null);
  const [projectImprovingIndex, setProjectImprovingIndex] = useState(null);
  const [showResumeUpdatePrompt, setShowResumeUpdatePrompt] = useState(false);

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
        const headers = { Authorization: `Bearer ${token}` };
        const [res, genRes] = await Promise.all([
          fetch("/api/students/profile/me", { headers }),
          fetch("/api/resume-builder/my-resumes", { headers }),
        ]);
        const data = await res.json();
        const genData = await genRes.json();

        if (!isMounted) return;

        if (genData.success) {
          setGeneratedResumes(genData.resumes || []);
        }

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
          batch: "2026",
          cgpa: "8.0",
          backlogs: "0",
          activeBacklogs: "0",
          academicHistory: {
            collegeStartYear: "",
            intermediateName: "",
            intermediateDuration: "",
            schoolName: "",
            schoolDuration: "",
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
        };

        if (data.success && data.profile) {
          const p = data.profile;
          const instituteName = resolveInstituteName(p.institute);
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
            instituteName,
            batch: p.batch != null ? String(p.batch) : "2026",
            cgpa: p.cgpa !== undefined && p.cgpa !== null ? String(p.cgpa) : "8.0",
            backlogs: p.backlogs != null ? String(p.backlogs) : "0",
            activeBacklogs: p.activeBacklogs != null ? String(p.activeBacklogs) : "0",
            academicHistory: {
              collegeStartYear:
                p.academicHistory?.collegeStartYear != null
                  ? String(p.academicHistory.collegeStartYear)
                  : "",
              intermediateName: p.academicHistory?.intermediateName || "",
              intermediateDuration: p.academicHistory?.intermediateDuration || "",
              schoolName: p.academicHistory?.schoolName || "",
              schoolDuration: p.academicHistory?.schoolDuration || "",
              tenthPercentage:
                p.academicHistory?.tenthPercentage != null &&
                p.academicHistory?.tenthPercentage !== ""
                  ? String(p.academicHistory.tenthPercentage)
                  : "",
              twelfthPercentage:
                p.academicHistory?.twelfthPercentage != null &&
                p.academicHistory?.twelfthPercentage !== ""
                  ? String(p.academicHistory.twelfthPercentage)
                  : "",
              diplomaPercentage:
                p.academicHistory?.diplomaPercentage != null &&
                p.academicHistory?.diplomaPercentage !== ""
                  ? String(p.academicHistory.diplomaPercentage)
                  : "",
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
            experience: (p.experience || []).map((exp) => ({
              ...exp,
              aiEnhancedDescription: exp.aiEnhancedDescription || "",
              aiEnhancedApproved: Boolean(exp.aiEnhancedApproved),
              aiEnhancedSourceHash: exp.aiEnhancedSourceHash || "",
            })),
            certifications: p.certifications || [],
            placementStatus: p.placementStatus || "seeking",
            resumeUrl: p.resumeUrl || "",
            resumeFileName: p.resumeFileName || "",
            githubUrl: p.githubUrl || "",
            linkedinUrl: p.linkedinUrl || "",
            portfolioUrl: p.portfolioUrl || "",
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

  useEffect(() => {
    if (!location.state?.resumeUpdated) return;
    setSuccessMsg("Resume updated with your latest profile details.");
    setActiveTab("resume");
    setIsEditing(false);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

  // Skill management helpers
  const rebuildFlatSkills = (nextCategories) => {
    const merged = [
      ...(nextCategories.languages || formData.languages),
      ...(nextCategories.frameworks || formData.frameworks),
      ...(nextCategories.databases || formData.databases),
      ...(nextCategories.tools || formData.tools),
    ];
    return Array.from(new Set(merged));
  };

  const handleAddCategorySkill = (category, value, setter) => {
    if (!value.trim()) return;
    const trimmed = value.trim();
    if (!formData[category].includes(trimmed)) {
      const updated = [...formData[category], trimmed];
      const next = { ...formData, [category]: updated };
      setFormData({ ...next, skills: rebuildFlatSkills({ [category]: updated }) });
    }
    if (setter) setter("");
  };

  const handleRemoveCategorySkill = (category, item) => {
    const updated = formData[category].filter((x) => x !== item);
    const next = { ...formData, [category]: updated };
    setFormData({ ...next, skills: rebuildFlatSkills({ [category]: updated }) });
  };

  const toggleSuggestedSkill = (category, skill) => {
    if (formData[category].includes(skill)) {
      handleRemoveCategorySkill(category, skill);
    } else {
      handleAddCategorySkill(category, skill, null);
    }
  };

  const updateAcademicField = (key, value) => {
    setFormData({
      ...formData,
      academicHistory: {
        ...formData.academicHistory,
        [key]: value,
      },
    });
  };

  const formatTemplateLabel = (templateId) =>
    String(templateId || "resume")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const suggestDownloadFileName = (resume) => {
    const stored = String(resume?.fileName || "")
      .replace(/\.pdf$/i, "")
      .trim();
    const looksSystemName =
      !stored ||
      /^resume[-_]?v?\d+/i.test(stored) ||
      /\d{10,}/.test(stored);
    if (!looksSystemName) return stored.slice(0, 80);

    const person = String(formData.name || user?.name || "My_Resume")
      .trim()
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 40);
    return `${person || "My"}_Resume`;
  };

  const openDownloadModal = (resume) => {
    setDownloadFileName(suggestDownloadFileName(resume));
    setDownloadTarget(resume);
    setErrorMsg("");
  };

  const handleViewGeneratedResume = async (resume) => {
    if (!resume?._id) return;
    setViewingResumeId(resume._id);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/resume-builder/${resume._id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to open resume preview.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setErrorMsg(err.message || "Failed to open resume preview.");
    } finally {
      setViewingResumeId(null);
    }
  };

  const confirmDownloadGeneratedResume = async () => {
    if (!downloadTarget?._id) return;
    const rawName = String(downloadFileName || "").trim();
    if (!rawName) {
      setErrorMsg("Enter a file name to save the resume.");
      return;
    }
    const safeName = `${rawName.replace(/\.pdf$/i, "").replace(/[<>:"/\\|?*]/g, "").trim() || "resume"}.pdf`;

    setDownloadingResumeId(downloadTarget._id);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/resume-builder/${downloadTarget._id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to download generated resume.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = safeName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDownloadTarget(null);
    } catch (err) {
      setErrorMsg(err.message || "Failed to download generated resume.");
    } finally {
      setDownloadingResumeId(null);
    }
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
    if (field === "description" || field === "title") {
      updated[index].aiEnhancedApproved = false;
    }
    setFormData({ ...formData, projects: updated });
  };

  const handleImproveProject = async (index) => {
    const proj = formData.projects[index];
    if (!proj?.title?.trim() || !proj?.description?.trim()) {
      setErrorMsg("Add a project title and description before improving with AI.");
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
    const aiText = String(updated[index]?.aiEnhancedDescription || "").trim();
    if (!aiText) return;
    // Put AI text into the main profile description (shown in view mode + resume)
    updated[index] = {
      ...updated[index],
      description: aiText,
      aiEnhancedDescription: "",
      aiEnhancedApproved: false,
      aiEnhancedSourceHash: "",
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
        {
          role: "",
          company: "",
          duration: "",
          description: "",
          aiEnhancedDescription: "",
          aiEnhancedApproved: false,
          aiEnhancedSourceHash: "",
        },
      ],
    });
  };

  const handleUpdateExperience = (index, field, value) => {
    const updated = [...formData.experience];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "description" || field === "role" || field === "company") {
      updated[index].aiEnhancedApproved = false;
    }
    setFormData({ ...formData, experience: updated });
  };

  const handleImproveExperience = async (index) => {
    const exp = formData.experience[index];
    if (!exp?.role?.trim() || !exp?.description?.trim()) {
      setErrorMsg("Add a role and description before improving with AI.");
      return;
    }
    setExperienceImprovingIndex(index);
    setErrorMsg("");
    try {
      const res = await fetch("/api/resume-builder/ai/experience-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: exp.role,
          company: exp.company,
          duration: exp.duration,
          description: exp.description,
          experienceIndex: index,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "AI experience improvement failed");
      const updated = [...formData.experience];
      updated[index] = {
        ...updated[index],
        aiEnhancedDescription: data.improvedDescription || "",
        aiEnhancedApproved: false,
        aiEnhancedSourceHash: data.sourceHash || "",
      };
      setFormData({ ...formData, experience: updated });
    } catch (err) {
      setErrorMsg(err.message || "AI generation failed. Please try again later.");
    } finally {
      setExperienceImprovingIndex(null);
    }
  };

  const handleApproveExperienceEnhancement = (index) => {
    const updated = [...formData.experience];
    const aiText = String(updated[index]?.aiEnhancedDescription || "").trim();
    if (!aiText) return;
    // Put AI text into the main profile description (shown in view mode + resume)
    updated[index] = {
      ...updated[index],
      description: aiText,
      aiEnhancedDescription: "",
      aiEnhancedApproved: false,
      aiEnhancedSourceHash: "",
    };
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
    // Ignore synthetic click events when Save button uses onClick={saveProfile}
    const opts =
      options && typeof options === "object" && !options.nativeEvent ? options : {};
    const {
      // Stay on profile by default so the "Update resume?" prompt can show
      redirectTo = searchParams.get("redirect") || null,
      silent = false,
    } = opts;

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
        academicHistory: {
          collegeStartYear: toOptionalNumber(formData.academicHistory?.collegeStartYear),
          intermediateName: formData.academicHistory?.intermediateName || "",
          intermediateDuration: formData.academicHistory?.intermediateDuration || "",
          schoolName: formData.academicHistory?.schoolName || "",
          schoolDuration: formData.academicHistory?.schoolDuration || "",
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
        setIsEditing(false);
        setActiveTab("personal");
        if (!silent) {
          let resumes = generatedResumes;
          if (resumes.length === 0) {
            try {
              const genRes = await fetch("/api/resume-builder/my-resumes", {
                headers: { Authorization: `Bearer ${token}` },
              });
              const genData = await genRes.json();
              if (genData.success) {
                resumes = genData.resumes || [];
                setGeneratedResumes(resumes);
              }
            } catch {
              /* ignore — prompt only if we know a generated resume exists */
            }
          }
          if (resumes.length > 0) {
            setShowResumeUpdatePrompt(true);
          }
        }
      }
      return true;
    } catch (err) {
      setErrorMsg(err.message || "Failed to save profile. Please verify your details.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const buildProfileDraft = () => ({
    githubUrl: formData.githubUrl,
    linkedinUrl: formData.linkedinUrl,
    portfolioUrl: formData.portfolioUrl,
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
    collegeStartYear: formData.academicHistory?.collegeStartYear ?? "",
    intermediateName: formData.academicHistory?.intermediateName || "",
    intermediateDuration: formData.academicHistory?.intermediateDuration || "",
    schoolName: formData.academicHistory?.schoolName || "",
    schoolDuration: formData.academicHistory?.schoolDuration || "",
    tenthPercentage: formData.academicHistory?.tenthPercentage ?? "",
    twelfthPercentage: formData.academicHistory?.twelfthPercentage ?? "",
  });

  const handleCreateResume = async () => {
    const ok = await saveProfile({ redirectTo: null, silent: true });
    if (!ok) return;
    navigate("/student/resume-builder", {
      state: { profileDraft: buildProfileDraft() },
    });
  };

  const handleUpdateExistingResume = () => {
    const latest = generatedResumes[0];
    setShowResumeUpdatePrompt(false);
    // Templates gallery first; generating replaces the existing PDF in DB
    navigate("/student/resume-builder", {
      state: {
        profileDraft: buildProfileDraft(),
        replaceResumeId: latest?._id || null,
        preferredTemplateId: latest?.templateId || null,
        updatingResume: Boolean(latest?._id),
      },
    });
  };

  // Block native form submit (Enter key / accidental submit). Save only via Save Profile button.
  const handleFormSubmit = (e) => {
    e.preventDefault();
  };

  if (loading) return <ProfileSkeleton />;

  return (
    <>
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
            {isEditing
              ? "Update your personal data, academics, skills, and resume."
              : "Review your profile details and resume. Use Update Profile to make changes."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <Link
            to="/student/dashboard"
            className="btn-secondary px-4 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          {isEditing ? (
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setActiveTab("personal");
                setErrorMsg("");
              }}
              className="btn-secondary px-4 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" /> View Profile
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
                setActiveTab("personal");
                setSuccessMsg("");
              }}
              className="px-4 py-2 bg-teal hover:bg-teal-deep text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" /> Update Profile
            </button>
          )}
        </div>
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

      {/* Modals rendered outside animated container to avoid backdrop clipping */}

      {!isEditing && (
        <div className="space-y-4 animate-fade-up font-body">
          <div className="panel p-5 sm:p-6 shadow-xs bg-surface border-sage space-y-4">
            <p className="text-base font-semibold text-ink border-b border-sage pb-3 font-body">
              Personal
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Full Name</p>
                <p className="text-ink mt-0.5">{formData.name || user?.name || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Email</p>
                <p className="text-ink mt-0.5">{user?.email || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Phone</p>
                <p className="text-ink mt-0.5">{formData.phone || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Roll Number</p>
                <p className="text-ink mt-0.5 font-mono">{formData.rollNumber || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Institute</p>
                <p className="text-ink mt-0.5">{formData.instituteName || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Placement Status</p>
                <p className="text-ink mt-0.5 capitalize">{formData.placementStatus || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">GitHub</p>
                <p className="text-ink mt-0.5 break-all">{formData.githubUrl || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">LinkedIn</p>
                <p className="text-ink mt-0.5 break-all">{formData.linkedinUrl || "—"}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Portfolio</p>
                <p className="text-ink mt-0.5 break-all">{formData.portfolioUrl || "—"}</p>
              </div>
            </div>
          </div>

          <div className="panel p-5 sm:p-6 shadow-xs bg-surface border-sage space-y-4">
            <p className="text-base font-semibold text-ink border-b border-sage pb-3 font-body">
              Academic
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Degree</p>
                <p className="text-ink mt-0.5">{formData.degree || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Department</p>
                <p className="text-ink mt-0.5">{formData.department || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Start Year</p>
                <p className="text-ink mt-0.5">{formData.academicHistory?.collegeStartYear || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Graduation Year</p>
                <p className="text-ink mt-0.5">{formData.batch || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">CGPA</p>
                <p className="text-ink mt-0.5">{formData.cgpa || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Backlogs</p>
                <p className="text-ink mt-0.5">
                  Total {formData.backlogs || 0} · Active {formData.activeBacklogs || 0}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">12th School</p>
                <p className="text-ink mt-0.5">
                  {formData.academicHistory?.intermediateName || "—"}
                  {formData.academicHistory?.twelfthPercentage
                    ? ` (${formData.academicHistory.twelfthPercentage}%)`
                    : ""}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">10th School</p>
                <p className="text-ink mt-0.5">
                  {formData.academicHistory?.schoolName || "—"}
                  {formData.academicHistory?.tenthPercentage
                    ? ` (${formData.academicHistory.tenthPercentage}%)`
                    : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="panel p-5 sm:p-6 shadow-xs bg-surface border-sage space-y-4">
            <p className="text-base font-semibold text-ink border-b border-sage pb-3 font-body">
              Skills ({formData.skills.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {formData.skills.length === 0 ? (
                <span className="text-xs text-ink-muted">No skills added yet.</span>
              ) : (
                formData.skills.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 bg-paper border border-sage text-teal rounded-lg text-xs font-semibold"
                  >
                    {s}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="panel p-5 sm:p-6 shadow-xs bg-surface border-sage space-y-3">
            <p className="text-base font-semibold text-ink border-b border-sage pb-3 font-body">
              Projects ({formData.projects.length})
            </p>
            {formData.projects.length === 0 ? (
              <p className="text-xs text-ink-muted">No projects added yet.</p>
            ) : (
              formData.projects.map((p, i) => (
                <div key={`${p.title}-${i}`} className="p-3 rounded-xl border border-sage bg-paper">
                  <p className="text-sm font-semibold text-ink">{p.title || `Project ${i + 1}`}</p>
                  {p.description ? (
                    <p className="text-xs text-ink-muted mt-1 whitespace-pre-wrap">{p.description}</p>
                  ) : null}
                  {(p.technologies || []).length > 0 && (
                    <p className="text-[11px] text-teal mt-1">{p.technologies.join(", ")}</p>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="panel p-5 sm:p-6 shadow-xs bg-surface border-sage space-y-3">
            <p className="text-base font-semibold text-ink border-b border-sage pb-3 font-body">
              Experience ({formData.experience.length})
            </p>
            {formData.experience.length === 0 ? (
              <p className="text-xs text-ink-muted">No experience added yet.</p>
            ) : (
              formData.experience.map((e, i) => {
                const displayDescription =
                  e.aiEnhancedApproved && String(e.aiEnhancedDescription || "").trim()
                    ? e.aiEnhancedDescription
                    : e.description;
                return (
                <div key={`${e.role}-${i}`} className="p-3 rounded-xl border border-sage bg-paper">
                  <p className="text-sm font-semibold text-ink">
                    {e.role || "Role"} – {e.company || "Company"}
                  </p>
                  {e.duration ? <p className="text-[11px] text-ink-muted mt-0.5">{e.duration}</p> : null}
                  {displayDescription ? (
                    <p className="text-xs text-ink-muted mt-1 whitespace-pre-wrap">{displayDescription}</p>
                  ) : null}
                </div>
                );
              })
            )}
          </div>

          <div className="panel p-5 sm:p-6 shadow-xs bg-surface border-sage space-y-4">
            <p className="text-base font-semibold text-ink border-b border-sage pb-3 font-body">
              Resume
            </p>

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Generated from templates
              </h3>
              {generatedResumes.length === 0 ? (
                <p className="text-xs text-ink-muted">
                  No generated resume yet. Create one from Update Profile → Resume.
                </p>
              ) : (
                <div className="space-y-2">
                  {generatedResumes.map((r) => (
                    <div
                      key={r._id}
                      className="p-4 bg-white rounded-xl border border-sage flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-teal-soft flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-teal" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-ink text-sm truncate font-body">
                            {formatTemplateLabel(r.templateId)}
                          </p>
                          <p className="text-[11px] text-ink-muted mt-0.5">
                            Version {r.version}
                            {r.createdAt
                              ? ` · ${new Date(r.createdAt).toLocaleDateString(undefined, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleViewGeneratedResume(r)}
                          disabled={viewingResumeId === r._id}
                          title="Preview resume"
                          className="flex-1 sm:flex-none px-3 py-2 border border-sage text-ink rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-paper disabled:opacity-60"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {viewingResumeId === r._id ? "Opening..." : "Preview"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openDownloadModal(r)}
                          disabled={downloadingResumeId === r._id}
                          className="flex-1 sm:flex-none px-3 py-2 bg-teal text-white rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-teal-deep disabled:opacity-60"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-sage">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Uploaded resume
              </h3>
              {formData.resumeUrl ? (
                <div className="p-4 bg-paper rounded-xl border border-sage flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-teal" />
                    <div>
                      <h3 className="font-semibold text-ink text-sm">
                        {formData.resumeFileName || "candidate_resume.pdf"}
                      </h3>
                      <p className="text-[11px] text-ink-muted">Uploaded resume on your profile</p>
                    </div>
                  </div>
                  <a
                    href="/api/students/profile/resume"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-teal text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-teal-deep"
                  >
                    <Download className="w-3.5 h-3.5" /> View Resume
                  </a>
                </div>
              ) : (
                <p className="text-xs text-ink-muted">No separate uploaded PDF on file.</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
                setActiveTab("resume");
              }}
              className="text-xs font-semibold text-teal hover:underline inline-flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" /> Manage resume / create with templates
            </button>
          </div>
        </div>
      )}

      {isEditing && (
        <>
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
      <div className="flex overflow-x-auto no-scrollbar border-b border-sage mb-6 gap-2 pb-1 sm:flex-wrap whitespace-nowrap">
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

              <div>
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
          <div className="panel p-6 shadow-xs space-y-6 bg-surface border-sage">
            <h2 className="text-lg font-semibold text-ink border-b border-sage pb-3">
              Academic Information
            </h2>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-teal">College / University</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                    College Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value={formData.instituteName || "—"}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm bg-paper text-ink-muted cursor-not-allowed"
                  />
                  <p className="text-[10px] text-ink-muted mt-1">
                    Taken from your registration institute — not editable here.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                    Start Year
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.academicHistory.collegeStartYear}
                    onChange={(e) =>
                      updateAcademicField("collegeStartYear", digitsOnly(e.target.value, 4))
                    }
                    placeholder="e.g. 2022"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                    Graduation Year
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.batch}
                    onChange={(e) =>
                      setFormData({ ...formData, batch: digitsOnly(e.target.value, 4) })
                    }
                    placeholder="e.g. 2026"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                  />
                </div>
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
                    Cumulative CGPA (0.0 - 10.0)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.cgpa}
                    onChange={(e) =>
                      setFormData({ ...formData, cgpa: decimalOnly(e.target.value, 5) })
                    }
                    placeholder="e.g. 8.5"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                  />
                </div>
                {/* <div>
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                    Total Backlogs
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.backlogs}
                    onChange={(e) =>
                      setFormData({ ...formData, backlogs: digitsOnly(e.target.value, 2) })
                    }
                    placeholder="e.g. 0"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                  />
                </div> */}
                <div>
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                    Active Backlogs
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.activeBacklogs}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        activeBacklogs: digitsOnly(e.target.value, 2),
                      })
                    }
                    placeholder="e.g. 0"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-sage pt-5">
              <h3 className="text-sm font-semibold text-teal">Higher Secondary (12th)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                    School / College Name
                  </label>
                  <input
                    type="text"
                    value={formData.academicHistory.intermediateName}
                    onChange={(e) => updateAcademicField("intermediateName", e.target.value)}
                    placeholder="e.g. XYZ Junior College"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={formData.academicHistory.intermediateDuration}
                    onChange={(e) => updateAcademicField("intermediateDuration", e.target.value)}
                    placeholder="e.g. 2020 – 2022"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                    Percentage
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.academicHistory.twelfthPercentage}
                    onChange={(e) =>
                      updateAcademicField("twelfthPercentage", decimalOnly(e.target.value, 6))
                    }
                    placeholder="e.g. 88.0"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-sage pt-5">
              <h3 className="text-sm font-semibold text-teal">Secondary (10th)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                    School Name
                  </label>
                  <input
                    type="text"
                    value={formData.academicHistory.schoolName}
                    onChange={(e) => updateAcademicField("schoolName", e.target.value)}
                    placeholder="e.g. ABC High School"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={formData.academicHistory.schoolDuration}
                    onChange={(e) => updateAcademicField("schoolDuration", e.target.value)}
                    placeholder="e.g. 2018 – 2020"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                    Percentage
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.academicHistory.tenthPercentage}
                    onChange={(e) =>
                      updateAcademicField("tenthPercentage", decimalOnly(e.target.value, 6))
                    }
                    placeholder="e.g. 91.5"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                  />
                </div>
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
                  Click a skill to add or remove it. Use Other only if it is not listed.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-teal-soft text-teal rounded-full border border-teal/20">
                {formData.skills.length} Total Skills Indexed
              </span>
            </div>

            {[
              {
                key: "languages",
                label: "Programming Languages",
                input: langInput,
                setInput: setLangInput,
                placeholder: "Other language…",
              },
              {
                key: "frameworks",
                label: "Frameworks & Libraries",
                input: frameInput,
                setInput: setFrameInput,
                placeholder: "Other framework…",
              },
              {
                key: "databases",
                label: "Databases & Storage",
                input: dbInput,
                setInput: setDbInput,
                placeholder: "Other database…",
              },
              {
                key: "tools",
                label: "Tools & Platforms",
                input: toolInput,
                setInput: setToolInput,
                placeholder: "Other tool…",
              },
            ].map((section) => (
              <div key={section.key} className="space-y-2">
                <label className="text-xs font-bold text-ink uppercase tracking-wider">
                  {section.label}
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-paper rounded-lg border border-sage/60">
                  {SKILL_SUGGESTIONS[section.key].map((skill) => {
                    const selected = formData[section.key].includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSuggestedSkill(section.key, skill)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md border transition ${
                          selected
                            ? "bg-teal text-white border-teal"
                            : "bg-surface text-ink border-sage hover:border-teal hover:text-teal"
                        }`}
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={section.placeholder}
                    value={section.input}
                    onChange={(e) => section.setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCategorySkill(section.key, section.input, section.setInput);
                      }
                    }}
                    className="flex-1 px-3 py-2 rounded-xl border border-sage text-xs focus:ring-2 focus:ring-teal bg-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleAddCategorySkill(section.key, section.input, section.setInput)
                    }
                    className="px-3 py-2 bg-teal hover:bg-teal-deep text-white text-xs font-semibold rounded-xl"
                  >
                    Add
                  </button>
                </div>
                {formData[section.key].some(
                  (item) => !SKILL_SUGGESTIONS[section.key].includes(item)
                ) && (
                  <div className="flex flex-wrap gap-1.5">
                    {formData[section.key]
                      .filter((item) => !SKILL_SUGGESTIONS[section.key].includes(item))
                      .map((item) => (
                        <span
                          key={item}
                          className="px-2 py-0.5 bg-surface border border-sage text-xs rounded-md flex items-center gap-1 font-medium"
                        >
                          {item}
                          <button
                            type="button"
                            onClick={() => handleRemoveCategorySkill(section.key, item)}
                            className="text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            ))}

            <div className="pt-2">
              <label className="text-xs font-bold text-ink uppercase tracking-wider block mb-1">
                Selected Skills
              </label>
              <div className="flex flex-wrap gap-1.5 p-3 bg-paper rounded-xl border border-sage/60 min-h-10">
                {formData.skills.length === 0 ? (
                  <span className="text-xs text-ink-muted">Click skills above to add them.</span>
                ) : (
                  formData.skills.map((s) => (
                    <span
                      key={s}
                      className="px-2.5 py-1 bg-surface border border-sage text-teal rounded-lg text-xs font-semibold"
                    >
                      {s}
                    </span>
                  ))
                )}
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
                          Description
                        </label>
                        <textarea
                          placeholder="Description & Key Contributions..."
                          rows={5}
                          value={proj.description}
                          onChange={(e) => handleUpdateProject(idx, "description", e.target.value)}
                          className="w-full min-h-[120px] px-3 py-2.5 rounded-xl border border-sage text-sm leading-relaxed bg-white focus:ring-2 focus:ring-teal focus:outline-none resize-y whitespace-pre-wrap break-words"
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
                        </div>
                        {proj.aiEnhancedDescription && !proj.aiEnhancedApproved && (
                          <div className="mt-2">
                            <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                              AI-enhanced description (editable)
                            </label>
                            <textarea
                              rows={4}
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
                        <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                          Description
                        </label>
                        <textarea
                          placeholder="Key achievements and technologies utilized..."
                          rows={5}
                          value={exp.description}
                          onChange={(e) => handleUpdateExperience(idx, "description", e.target.value)}
                          className="w-full min-h-[120px] px-3 py-2.5 rounded-xl border border-sage text-sm leading-relaxed bg-white focus:ring-2 focus:ring-teal focus:outline-none resize-y whitespace-pre-wrap break-words"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleImproveExperience(idx)}
                            disabled={experienceImprovingIndex === idx}
                            className="px-3 py-1.5 border border-sage text-ink rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-surface disabled:opacity-50"
                          >
                            <Wand2 className="w-3 h-3" />
                            {experienceImprovingIndex === idx ? "Improving..." : "Improve with AI"}
                          </button>
                          {exp.aiEnhancedDescription && !exp.aiEnhancedApproved && (
                            <button
                              type="button"
                              onClick={() => handleApproveExperienceEnhancement(idx)}
                              className="px-3 py-1.5 bg-teal text-white rounded-lg text-[11px] font-semibold hover:bg-teal-deep"
                            >
                              Accept AI version
                            </button>
                          )}
                        </div>
                        {exp.aiEnhancedDescription && !exp.aiEnhancedApproved && (
                          <div className="mt-2">
                            <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                              AI-enhanced description (editable)
                            </label>
                            <textarea
                              rows={4}
                              value={exp.aiEnhancedDescription}
                              onChange={(e) =>
                                handleUpdateExperience(idx, "aiEnhancedDescription", e.target.value)
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
                  <FileText className="w-4 h-4" />
                  {saving ? "Saving profile..." : "Create Resume"}
                </h3>
                <p className="text-xs text-ink-muted mt-1">
                  Saves your profile, then opens templates so you can build and download a PDF.
                </p>
              </button>
            </div>

            {resumeMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{resumeMsg}</span>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Generated resumes
              </h3>
              {generatedResumes.length === 0 ? (
                <p className="text-xs text-ink-muted">
                  None yet — use Create Resume above to build one from a template.
                </p>
              ) : (
                <div className="space-y-2">
                  {generatedResumes.map((r) => (
                    <div
                      key={r._id}
                      className="p-4 bg-white rounded-xl border border-sage flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-teal-soft flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-teal" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-ink text-sm truncate font-body">
                            {formatTemplateLabel(r.templateId)}
                          </p>
                          <p className="text-[11px] text-ink-muted mt-0.5">
                            Version {r.version}
                            {r.createdAt
                              ? ` · ${new Date(r.createdAt).toLocaleDateString(undefined, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleViewGeneratedResume(r)}
                          disabled={viewingResumeId === r._id}
                          title="Preview resume"
                          className="flex-1 sm:flex-none px-3 py-2 border border-sage text-ink rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-paper disabled:opacity-60"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {viewingResumeId === r._id ? "Opening..." : "Preview"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openDownloadModal(r)}
                          disabled={downloadingResumeId === r._id}
                          className="flex-1 sm:flex-none px-3 py-2 bg-teal text-white rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-teal-deep disabled:opacity-60"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                <p className="text-sm font-semibold text-ink">No uploaded resume</p>
                <p className="text-xs text-ink-muted mt-1">
                  Upload a PDF below, or create one with templates above.
                </p>
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
                onClick={() => saveProfile()}
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
        </>
      )}
    </div>

    {showResumeUpdatePrompt && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4 backdrop-blur-[2px]"
        onClick={() => setShowResumeUpdatePrompt(false)}
        role="presentation"
      >
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-md rounded-2xl bg-white border border-sage p-6 shadow-xl font-body"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[11px] font-bold uppercase tracking-widest text-teal">Resume</p>
          <p className="text-lg font-semibold text-ink mt-1 font-body">
            Update your resume?
          </p>
          <p className="text-sm text-ink-muted mt-1.5 leading-relaxed">
            Your profile details changed. Refresh your generated resume so recruiters see the
            latest information. The new PDF will replace your current one.
          </p>
          <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowResumeUpdatePrompt(false)}
              className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-sage text-ink hover:bg-paper"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={handleUpdateExistingResume}
              className="px-5 py-2.5 bg-teal hover:bg-teal-deep text-white text-sm font-semibold rounded-xl"
            >
              Update resume
            </button>
          </div>
        </div>
      </div>
    )}

    {downloadTarget && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4 backdrop-blur-[2px]"
        onClick={() => !downloadingResumeId && setDownloadTarget(null)}
        role="presentation"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="download-resume-title"
          className="w-full max-w-md rounded-2xl bg-white border border-sage p-6 shadow-xl font-body"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[11px] font-bold uppercase tracking-widest text-teal">Download</p>
          <p id="download-resume-title" className="text-lg font-semibold text-ink mt-1 font-body">
            Name your PDF file
          </p>
          <p className="text-sm text-ink-muted mt-1.5 leading-relaxed">
            {formatTemplateLabel(downloadTarget.templateId)}
            {downloadTarget.version ? ` · version ${downloadTarget.version}` : ""}. Edit the name
            below, then save.
          </p>
          <label
            htmlFor="resume-download-filename"
            className="block text-xs font-semibold text-ink mt-5 mb-1.5"
          >
            File name
          </label>
          <div className="flex items-stretch rounded-xl border border-sage overflow-hidden focus-within:ring-2 focus-within:ring-teal bg-white">
            <input
              id="resume-download-filename"
              type="text"
              autoFocus
              value={downloadFileName}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setDownloadFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmDownloadGeneratedResume();
                }
                if (e.key === "Escape") {
                  setDownloadTarget(null);
                }
              }}
              placeholder="e.g. Prasanth_Resume"
              className="flex-1 px-3.5 py-3 text-sm text-ink focus:outline-none bg-transparent font-body"
            />
            <span className="px-3 flex items-center text-sm font-semibold text-ink-muted bg-paper border-l border-sage">
              .pdf
            </span>
          </div>
          <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => setDownloadTarget(null)}
              disabled={Boolean(downloadingResumeId)}
              className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-sage text-ink hover:bg-paper disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDownloadGeneratedResume}
              disabled={Boolean(downloadingResumeId)}
              className="px-5 py-2.5 bg-teal hover:bg-teal-deep text-white text-sm font-semibold rounded-xl disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
            >
              {downloadingResumeId ? (
                <>
                  <ButtonSpinner className="w-4 h-4" /> Saving...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Download PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
};

export default ProfilePage;
