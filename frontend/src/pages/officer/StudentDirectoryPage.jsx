import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Users,
  Download,
  AlertCircle,
  Search,
  CheckCircle2,
  FileText,
  Eye,
  Edit2,
  X,
  ExternalLink,
  Briefcase,
  Award,
  Code,
  FolderGit2,
  Mail,
  Phone,
  Github,
  Linkedin,
  Globe,
} from "lucide-react";
import { ButtonSpinner } from "../../components/Loader";

const StudentDirectoryPage = () => {
  const { token } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportErr, setExportErr] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [minCgpa, setMinCgpa] = useState("");
  const [maxBacklogs, setMaxBacklogs] = useState("");
  const [department, setDepartment] = useState("");
  const [batch, setBatch] = useState("");
  const [placementStatus, setPlacementStatus] = useState("");
  const [incompleteOnly, setIncompleteOnly] = useState(false);

  const [viewStudent, setViewStudent] = useState(null);
  const [showPdfEmbed, setShowPdfEmbed] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [editFormData, setEditFormData] = useState({
    cgpa: "",
    backlogs: 0,
    activeBacklogs: 0,
    placementStatus: "seeking",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");

  const fetchStudents = async () => {
    setLoading(true);
    setExportErr("");
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append("search", searchTerm.trim());
      if (minCgpa) params.append("minCgpa", minCgpa);
      if (maxBacklogs !== "") params.append("maxBacklogs", maxBacklogs);
      if (department.trim()) params.append("department", department.trim());
      if (batch) params.append("batch", batch);
      if (placementStatus) params.append("placementStatus", placementStatus);
      if (incompleteOnly) params.append("incomplete", "true");

      const res = await fetch(`/api/officer/students?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setStudents(data.students || []);
      } else {
        const fallbackRes = await fetch(`/api/students?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const fallbackData = await fallbackRes.json();
        if (fallbackData.success) {
          setStudents(fallbackData.profiles || []);
        }
      }
    } catch (err) {
      console.error("Failed to load students:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchStudents();
  }, [token]);

  // Lock page scroll while modal is open
  useEffect(() => {
    const open = Boolean(viewStudent || editStudent);
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [viewStudent, editStudent]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchStudents();
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setMinCgpa("");
    setMaxBacklogs("");
    setDepartment("");
    setBatch("");
    setPlacementStatus("");
    setIncompleteOnly(false);
  };

  const downloadCsv = async () => {
    setExportErr("");
    setExportBusy(true);
    try {
      const params = new URLSearchParams();
      if (department.trim()) params.set("department", department.trim());
      if (batch) params.set("batch", batch);
      if (placementStatus) params.set("placementStatus", placementStatus);

      const qs = params.toString();
      const url = `/api/officer/students/export${qs ? `?${qs}` : ""}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Export failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] || "campus-students-report.csv";
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
      setExportBusy(false);
    }
  };

  const openEditModal = (student) => {
    setEditStudent(student);
    setEditFormData({
      cgpa: student.cgpa !== undefined ? student.cgpa : "",
      backlogs: student.backlogs || 0,
      activeBacklogs: student.activeBacklogs || 0,
      placementStatus: student.placementStatus || "seeking",
      reason: "",
    });
  };

  const closeViewModal = () => {
    setViewStudent(null);
    setShowPdfEmbed(false);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editStudent) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/officer/students/${editStudent._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editFormData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update student");

      setActionSuccessMsg(`Academic records updated for ${editStudent.user?.name || "student"}.`);
      setEditStudent(null);
      await fetchStudents();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const backdropStyle = {
    position: "fixed",
    inset: 0,
    width: "100vw",
    height: "100dvh",
    zIndex: 100,
  };

  const viewModal =
    viewStudent &&
    createPortal(
      <div
        className="flex items-center justify-center p-3 sm:p-6 bg-ink/60 backdrop-blur-[3px]"
        style={backdropStyle}
        role="presentation"
        onClick={closeViewModal}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Student profile"
          onClick={(e) => e.stopPropagation()}
          className="panel w-full max-w-2xl rounded-2xl shadow-2xl max-h-[min(90dvh,860px)] flex flex-col bg-surface border border-sage overflow-hidden"
        >
          <div className="px-5 pt-4 pb-3 border-b border-sage shrink-0 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-teal/10 text-teal border border-teal/20 flex items-center justify-center font-display font-bold text-base shrink-0">
                {(viewStudent.user?.name || "SP")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-semibold text-lg text-ink leading-tight truncate">
                    {viewStudent.user?.name || "Student Profile"}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border ${
                      viewStudent.placementStatus === "placed"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : viewStudent.placementStatus === "opted_out"
                          ? "bg-slate-100 text-slate-600 border-slate-200"
                          : "bg-teal-soft text-teal border-teal/20"
                    }`}
                  >
                    {(viewStudent.placementStatus || "seeking").replace("_", " ")}
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted mt-0.5 truncate">
                  <span className="font-mono">{viewStudent.rollNumber}</span>
                  {viewStudent.department ? ` · ${viewStudent.department}` : ""}
                  {viewStudent.batch ? ` · Batch ${viewStudent.batch}` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeViewModal}
              className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper rounded-lg transition shrink-0"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4 flex-1 min-h-0 overflow-y-auto no-scrollbar overscroll-contain">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-ink">
              {viewStudent.user?.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-teal shrink-0" />
                  {viewStudent.user.email}
                </span>
              )}
              {(viewStudent.phone || viewStudent.user?.phone) && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-teal shrink-0" />
                  {viewStudent.phone || viewStudent.user?.phone}
                </span>
              )}
              <span className="flex flex-wrap items-center gap-3 sm:ml-auto">
                {viewStudent.githubUrl && (
                  <a
                    href={viewStudent.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-teal font-semibold hover:underline"
                  >
                    <Github className="w-3.5 h-3.5" /> GitHub
                  </a>
                )}
                {viewStudent.linkedinUrl && (
                  <a
                    href={viewStudent.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-teal font-semibold hover:underline"
                  >
                    <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                  </a>
                )}
                {viewStudent.portfolioUrl && (
                  <a
                    href={viewStudent.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-teal font-semibold hover:underline"
                  >
                    <Globe className="w-3.5 h-3.5" /> Portfolio
                  </a>
                )}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Degree", value: viewStudent.degree || "B.Tech" },
                { label: "Batch", value: viewStudent.batch || "—" },
                { label: "CGPA", value: `${viewStudent.cgpa ?? "—"} / 10`, accent: true },
                {
                  label: "Backlogs",
                  value: `${viewStudent.backlogs || 0} · Active ${viewStudent.activeBacklogs || 0}`,
                },
              ].map((m) => (
                <div key={m.label} className="px-3 py-2.5 rounded-xl bg-paper border border-sage/70">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                    {m.label}
                  </p>
                  <p
                    className={`text-sm font-semibold mt-0.5 truncate ${
                      m.accent ? "text-teal" : "text-ink"
                    }`}
                  >
                    {m.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-teal/20 bg-teal-soft/30 px-3.5 py-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-teal text-white flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">
                      {viewStudent.resumeFileName || "Student_Resume.pdf"}
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      {viewStudent.resumeUrl ? "Resume on file" : "No resume uploaded"}
                    </p>
                  </div>
                </div>
                {viewStudent.resumeUrl && (
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <a
                      href={`/api/officer/students/${viewStudent._id}/resume`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-teal hover:bg-teal-deep text-white rounded-lg text-[11px] font-semibold inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open
                    </a>
                    <a
                      href={`/api/officer/students/${viewStudent._id}/resume`}
                      download={viewStudent.resumeFileName || "Student_Resume.pdf"}
                      className="px-2.5 py-1.5 bg-white hover:bg-paper text-ink border border-sage rounded-lg text-[11px] font-semibold inline-flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowPdfEmbed((prev) => !prev)}
                      className="px-2.5 py-1.5 bg-white hover:bg-paper text-ink border border-sage rounded-lg text-[11px] font-semibold inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-teal" />
                      {showPdfEmbed ? "Hide" : "Preview"}
                    </button>
                  </div>
                )}
              </div>
              {showPdfEmbed && viewStudent.resumeUrl && (
                <div className="mt-3 pt-3 border-t border-teal/15">
                  <iframe
                    src={`/api/officer/students/${viewStudent._id}/resume`}
                    title="Student Resume Preview"
                    className="w-full h-72 rounded-lg border border-sage bg-white"
                  />
                </div>
              )}
            </div>

            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <Code className="w-3.5 h-3.5 text-teal" />
                <h4 className="text-[11px] font-bold text-ink uppercase tracking-wider">
                  Skills ({(viewStudent.skills || []).length})
                </h4>
              </div>
              {(viewStudent.skills || []).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {viewStudent.skills.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 bg-paper text-ink rounded-md text-[11px] font-medium border border-sage"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-ink-muted">No skills listed.</p>
              )}
            </section>

            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <FolderGit2 className="w-3.5 h-3.5 text-teal" />
                <h4 className="text-[11px] font-bold text-ink uppercase tracking-wider">
                  Projects ({(viewStudent.projects || []).length})
                </h4>
              </div>
              {(viewStudent.projects || []).length > 0 ? (
                <div className="space-y-2">
                  {viewStudent.projects.map((p, i) => (
                    <div
                      key={i}
                      className="px-3 py-2.5 bg-paper rounded-xl border border-sage space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-ink">{p.title}</p>
                        {(p.link || p.githubUrl || p.liveUrl) && (
                          <a
                            href={p.link || p.liveUrl || p.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal hover:underline inline-flex items-center gap-1 font-semibold text-[11px] shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" /> View
                          </a>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-[11px] text-ink-muted leading-relaxed line-clamp-3">
                          {p.description}
                        </p>
                      )}
                      {(p.technologies || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {p.technologies.map((t, ti) => (
                            <span
                              key={ti}
                              className="px-1.5 py-0.5 bg-white text-ink-muted rounded text-[10px] border border-sage/80"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-ink-muted">No projects listed.</p>
              )}
            </section>

            {(viewStudent.experience || []).length > 0 && (
              <section>
                <div className="flex items-center gap-1.5 mb-2">
                  <Briefcase className="w-3.5 h-3.5 text-teal" />
                  <h4 className="text-[11px] font-bold text-ink uppercase tracking-wider">
                    Experience ({viewStudent.experience.length})
                  </h4>
                </div>
                <div className="space-y-2">
                  {viewStudent.experience.map((exp, i) => (
                    <div
                      key={i}
                      className="px-3 py-2.5 bg-paper rounded-xl border border-sage space-y-0.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-ink">{exp.role}</p>
                        {exp.duration && (
                          <span className="text-[10px] text-ink-muted shrink-0">{exp.duration}</span>
                        )}
                      </div>
                      <p className="text-[11px] font-medium text-teal">{exp.company}</p>
                      {exp.description && (
                        <p className="text-[11px] text-ink-muted leading-relaxed line-clamp-4 whitespace-pre-wrap">
                          {exp.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(viewStudent.certifications || []).length > 0 && (
              <section>
                <div className="flex items-center gap-1.5 mb-2">
                  <Award className="w-3.5 h-3.5 text-teal" />
                  <h4 className="text-[11px] font-bold text-ink uppercase tracking-wider">
                    Certifications ({viewStudent.certifications.length})
                  </h4>
                </div>
                <div className="space-y-1.5">
                  {viewStudent.certifications.map((cert, i) => (
                    <div
                      key={i}
                      className="px-3 py-2 bg-paper rounded-xl border border-sage flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-ink truncate">{cert.title}</p>
                        {cert.issuingOrganization && (
                          <p className="text-[10px] text-ink-muted truncate">
                            {cert.issuingOrganization}
                          </p>
                        )}
                      </div>
                      {cert.credentialUrl && (
                        <a
                          href={cert.credentialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal hover:underline text-[11px] inline-flex items-center gap-1 font-semibold shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" /> Verify
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="px-5 py-3 border-t border-sage bg-paper/50 flex items-center justify-between gap-3 shrink-0">
            <p className="text-[11px] text-ink-muted">
              {viewStudent.completion ? (
                <>
                  Profile:{" "}
                  <strong
                    className={
                      viewStudent.completion.isComplete ? "text-emerald-700" : "text-amber-700"
                    }
                  >
                    {viewStudent.completion.isComplete
                      ? "100% complete"
                      : `${viewStudent.completion.percentage}% complete`}
                  </strong>
                </>
              ) : (
                "Student directory record"
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const studentToEdit = viewStudent;
                  closeViewModal();
                  openEditModal(studentToEdit);
                }}
                className="px-3 py-1.5 bg-white hover:bg-teal-soft text-ink hover:text-teal border border-sage rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 transition"
              >
                <Edit2 className="w-3.5 h-3.5 text-teal" />
                Edit Records
              </button>
              <button
                type="button"
                onClick={closeViewModal}
                className="px-3.5 py-1.5 bg-ink text-white hover:bg-ink/85 rounded-lg text-[11px] font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );

  const editModal =
    editStudent &&
    createPortal(
      <div
        className="flex items-center justify-center p-4 bg-ink/60 backdrop-blur-[3px]"
        style={backdropStyle}
        role="presentation"
        onClick={() => setEditStudent(null)}
      >
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="panel max-w-md w-full p-6 shadow-xl space-y-4 bg-surface border-sage max-h-[min(90dvh,720px)] overflow-y-auto no-scrollbar"
        >
          <div className="flex items-center justify-between border-b border-sage pb-3">
            <div>
              <h3 className="font-display font-semibold text-base text-ink">
                Update Academic Records
              </h3>
              <p className="text-xs text-ink-muted">
                {editStudent.user?.name} ({editStudent.rollNumber})
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditStudent(null)}
              className="p-1 text-ink-muted hover:text-ink rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-ink mb-1">Verified CGPA (0.0 - 10.0)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                required
                value={editFormData.cgpa}
                onChange={(e) => setEditFormData({ ...editFormData, cgpa: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-sage bg-white text-xs focus:ring-2 focus:ring-teal"
              />
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">Total Backlogs</label>
              <input
                type="number"
                min="0"
                max="30"
                value={editFormData.backlogs}
                onChange={(e) => setEditFormData({ ...editFormData, backlogs: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-sage bg-white text-xs focus:ring-2 focus:ring-teal"
              />
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">Active Backlogs</label>
              <input
                type="number"
                min="0"
                max="30"
                value={editFormData.activeBacklogs}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, activeBacklogs: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-sage bg-white text-xs focus:ring-2 focus:ring-teal"
              />
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">Placement Status</label>
              <select
                value={editFormData.placementStatus}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, placementStatus: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-sage bg-white text-xs focus:ring-2 focus:ring-teal"
              >
                <option value="seeking">Seeking Placement</option>
                <option value="placed">Placed</option>
                <option value="opted_out">Opted Out</option>
              </select>
            </div>

            {editFormData.placementStatus !== (editStudent.placementStatus || "seeking") && (
              <div>
                <label className="block font-semibold text-ink mb-1">
                  Reason for Status Change <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={5}
                  placeholder="e.g. Placed off-campus, higher studies, or opted out"
                  value={editFormData.reason || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-sage bg-white text-xs focus:ring-2 focus:ring-teal"
                />
                <p className="text-[10px] text-ink-muted mt-1">
                  Administrative overrides require a documented reason (min 5 characters) for audit
                  trail.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-sage">
              <button
                type="button"
                onClick={() => setEditStudent(null)}
                className="px-4 py-2 text-ink-muted hover:text-ink font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="px-5 py-2 bg-teal hover:bg-teal-deep text-white font-semibold rounded-xl transition shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {editSaving ? (
                  <>
                    <ButtonSpinner className="w-3.5 h-3.5" /> Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-up">
      {viewModal}
      {editModal}

      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-teal uppercase tracking-widest">
              Campus Placement Cell
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="text-xs text-ink-muted">Student Management</span>
          </div>
          <h1 className="text-3xl font-display font-semibold text-ink tracking-tight">
            Campus Student Directory
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Browse campus students, verify academic credentials, inspect resumes, and export
            placement rosters.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={exportBusy}
            onClick={downloadCsv}
            className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exportBusy ? "Exporting..." : "Export Campus Students (CSV)"}
          </button>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg("")} className="p-1 hover:bg-emerald-100 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {exportErr && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2 shadow-xs">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{exportErr}</span>
        </div>
      )}

      <form onSubmit={handleSearch} className="panel p-5 shadow-xs mb-8 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by name, email, roll no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-sage text-xs focus:ring-2 focus:ring-teal bg-white"
            />
          </div>

          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-sage text-xs focus:ring-2 focus:ring-teal bg-white"
          >
            <option value="">All Departments</option>
            <option value="Computer Science">Computer Science & Engineering</option>
            <option value="Information Technology">Information Technology</option>
            <option value="Electronics">Electronics & Communication</option>
            <option value="Electrical">Electrical Engineering</option>
            <option value="Mechanical">Mechanical Engineering</option>
            <option value="Data Science">Data Science & AI</option>
          </select>

          <input
            type="number"
            min="2020"
            max="2035"
            placeholder="Batch Year (e.g. 2026)"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-sage text-xs focus:ring-2 focus:ring-teal bg-white"
          />

          <select
            value={placementStatus}
            onChange={(e) => setPlacementStatus(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-sage text-xs focus:ring-2 focus:ring-teal bg-white"
          >
            <option value="">All Placement Statuses</option>
            <option value="seeking">Seeking Placement</option>
            <option value="placed">Placed</option>
            <option value="opted_out">Opted Out</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            placeholder="Min CGPA (e.g. 7.5)"
            value={minCgpa}
            onChange={(e) => setMinCgpa(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-sage text-xs focus:ring-2 focus:ring-teal bg-white"
          />

          <input
            type="number"
            min="0"
            placeholder="Max Backlogs allowed"
            value={maxBacklogs}
            onChange={(e) => setMaxBacklogs(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-sage text-xs focus:ring-2 focus:ring-teal bg-white"
          />

          <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={incompleteOnly}
              onChange={(e) => setIncompleteOnly(e.target.checked)}
              className="rounded text-teal focus:ring-teal h-4 w-4"
            />
            <span>Incomplete Profiles Only</span>
          </label>

          <div className="flex gap-2 justify-stretch sm:justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex-1 sm:flex-none px-3 py-2 text-xs text-ink-muted hover:text-ink font-semibold text-center rounded-xl border border-sage sm:border-transparent"
            >
              Reset
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-none px-5 py-2 bg-teal hover:bg-teal-deep text-white rounded-xl text-xs font-semibold transition shadow-xs text-center"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </form>

      {loading ? (
        <div className="panel p-12 animate-pulse text-center text-ink-muted text-xs">
          Loading campus students...
        </div>
      ) : students.length === 0 ? (
        <div className="panel p-12 text-center shadow-xs">
          <Users className="w-12 h-12 text-ink-muted mx-auto mb-3" />
          <h3 className="font-semibold text-ink text-base">No Matching Students Found</h3>
          <p className="text-xs text-ink-muted mt-1">Try broadening your search or filter criteria.</p>
        </div>
      ) : (
        <div className="panel shadow-xs overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper text-ink-muted uppercase font-semibold border-b border-sage">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Program & Dept</th>
                  <th className="py-3 px-4">Batch</th>
                  <th className="py-3 px-4">CGPA / Backlogs</th>
                  <th className="py-3 px-4">Profile Status</th>
                  <th className="py-3 px-4">Resume</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage/60">
                {students.map((student) => {
                  const comp = student.completion;
                  const isComp = comp?.isComplete;
                  return (
                    <tr key={student._id} className="hover:bg-paper/60 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-ink">{student.user?.name || "Student"}</div>
                        <div className="text-[11px] text-ink-muted">{student.user?.email}</div>
                        {student.phone && (
                          <div className="text-[10px] text-ink-muted">{student.phone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-ink">{student.rollNumber}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-ink">{student.degree || "B.Tech"}</div>
                        <div className="text-ink-muted text-[11px] truncate max-w-[150px]">
                          {student.department}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-ink">{student.batch}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-ink">CGPA {student.cgpa}</div>
                        <div className="text-[11px] text-ink-muted">
                          Backlogs: {student.backlogs || 0}
                          {student.activeBacklogs > 0 && ` (${student.activeBacklogs} active)`}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize inline-block w-fit ${
                              student.placementStatus === "placed"
                                ? "bg-emerald-100 text-emerald-800"
                                : student.placementStatus === "opted_out"
                                  ? "bg-gray-100 text-gray-700"
                                  : "bg-teal-soft text-teal"
                            }`}
                          >
                            {student.placementStatus || "seeking"}
                          </span>
                          <span
                            className={`text-[10px] font-medium ${
                              isComp ? "text-emerald-700" : "text-amber-700"
                            }`}
                          >
                            {isComp ? "100% Complete" : `${comp?.percentage ?? 0}% (Incomplete)`}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {student.resumeUrl ? (
                          <a
                            href={`/api/officer/students/${student._id}/resume`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-teal-soft text-teal hover:bg-teal hover:text-white rounded text-[11px] font-semibold inline-flex items-center gap-1 transition"
                          >
                            <FileText className="w-3 h-3" /> PDF
                          </a>
                        ) : (
                          <span className="text-[11px] text-ink-muted italic">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => setViewStudent(student)}
                          className="px-2.5 py-1 text-teal hover:bg-teal-soft rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(student)}
                          className="px-2.5 py-1 text-ink-muted hover:text-ink hover:bg-paper rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDirectoryPage;
