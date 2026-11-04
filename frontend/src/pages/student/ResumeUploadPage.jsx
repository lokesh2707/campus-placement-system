import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  UploadCloud,
  AlertCircle,
  CheckCircle2,
  Plus,
  X,
  Sparkles,
  Info,
  FileText
} from "lucide-react";
import { ButtonSpinner } from "../../components/Loader";

const ResumeUploadPage = () => {
  const { token } = useAuth();
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [editedSkills, setEditedSkills] = useState([]);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [savingSkills, setSavingSkills] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const fetchLatestResume = async () => {
      try {
        const res = await fetch("/api/resumes/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.analysis) {
          setAnalysis(data.analysis);
          setEditedSkills(data.analysis.extractedSkills || []);
        }
      } catch (err) {
        // No resume uploaded yet
      }
    };

    fetchLatestResume();
  }, [token]);

  const handleFileChange = (e) => {
    setErrorMsg("");
    const selected = e.target.files[0];
    if (selected) {
      const allowedExts = [".pdf", ".doc", ".docx"];
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      const nameLower = selected.name.toLowerCase();
      const hasValidExt = allowedExts.some((ext) => nameLower.endsWith(ext));
      const hasValidType = allowedTypes.includes(selected.type);

      if (!hasValidExt && !hasValidType) {
        setErrorMsg("Only PDF and Word documents (.pdf, .doc, .docx) are permitted.");
        setFile(null);
        return;
      }
      if (selected.size > 5 * 1024 * 1024) {
        setErrorMsg("File exceeds the maximum size limit of 5 MB.");
        setFile(null);
        return;
      }
      setFile(selected);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setErrorMsg("");
    setSuccessMsg("");

    const formData = new FormData();
    formData.append("resume", file);

    try {
      const res = await fetch("/api/resumes/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Upload failed");
      }

      setAnalysis(data.analysis);
      setEditedSkills(data.analysis.extractedSkills || []);
      setSuccessMsg("Resume parsed successfully! You can review and adjust your skills below.");
      setFile(null);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAddSkill = (e) => {
    e.preventDefault();
    if (!newSkillInput.trim()) return;
    const s = newSkillInput.trim();
    if (!editedSkills.includes(s)) {
      setEditedSkills([...editedSkills, s]);
    }
    setNewSkillInput("");
  };

  const handleRemoveSkill = (skill) => {
    setEditedSkills(editedSkills.filter((item) => item !== skill));
  };

  const handleSaveReviewedSkills = async () => {
    if (!analysis) return;
    setSavingSkills(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/resumes/${analysis._id}/confirm-fields`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          decisions: [{ category: "skills", action: "edit", values: editedSkills }],
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to update reviewed skills");
      }

      if (data.analysis) setAnalysis(data.analysis);
      setSuccessMsg("Confirmed skills merged into your student placement profile.");
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSavingSkills(false);
    }
  };

  const submitFieldDecision = async (decision) => {
    if (!analysis) return;
    setConfirmBusy(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/resumes/${analysis._id}/confirm-fields`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decisions: [decision] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Confirmation failed");
      if (data.analysis) setAnalysis(data.analysis);
      setSuccessMsg(
        decision.action === "reject"
          ? "Field rejected — not written to your verified profile."
          : "Field confirmed into your profile where applicable. Confidence is not authenticity proof."
      );
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setConfirmBusy(false);
    }
  };

  const FieldActions = ({ decisionBase, confirmed, rejected }) => (
    <div className="flex gap-2 mt-2">
      {!confirmed && !rejected && (
        <>
          <button
            type="button"
            disabled={confirmBusy}
            onClick={() => submitFieldDecision({ ...decisionBase, action: "confirm" })}
            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-teal text-white disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            type="button"
            disabled={confirmBusy}
            onClick={() => submitFieldDecision({ ...decisionBase, action: "reject" })}
            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-sage text-ink-muted disabled:opacity-50"
          >
            Reject
          </button>
        </>
      )}
      {confirmed && (
        <span className="text-[11px] font-semibold text-emerald-700">Confirmed</span>
      )}
      {rejected && (
        <span className="text-[11px] font-semibold text-ink-muted">Rejected</span>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-semibold text-ink tracking-tight">
          AI Resume Parser & Skill Extraction
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Upload your resume in PDF, DOC, or DOCX format. Our local AI service extracts technical competencies and categorizes them automatically.
        </p>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Upload Zone */}
      <div className="panel p-4 sm:p-8 shadow-xs mb-8">
        <form onSubmit={handleUpload}>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
              const dropped = e.dataTransfer?.files?.[0];
              if (dropped) {
                handleFileChange({ target: { files: [dropped] } });
              }
            }}
            className={`border-2 border-dashed rounded-xl p-4 sm:p-8 text-center transition cursor-pointer ${
              dragActive
                ? "border-teal bg-teal-soft/40"
                : "border-sage hover:border-teal"
            }`}
          >
            <UploadCloud className="w-12 h-12 text-ink-muted mx-auto mb-3" />
            <div className="text-sm font-semibold text-ink">
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-teal-soft text-teal border border-teal/20">
                    {file.name.split(".").pop().toUpperCase()}
                  </span>
                  <span className="text-teal font-bold">{file.name}</span>
                </div>
              ) : (
                "Click to choose or drag & drop your resume (PDF, DOC, DOCX)"
              )}
            </div>
            <p className="text-xs text-ink-muted mt-1">PDF, DOC, or DOCX documents, max 5 MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              onClick={(e) => {
                e.stopPropagation();
                e.target.value = null;
              }}
              className="sr-only"
              aria-label="Choose resume file"
            />
            <span className="mt-4 inline-block px-4 py-2 rounded-lg text-xs font-semibold bg-teal-soft text-teal">
              Browse files
            </span>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={!file || uploading}
              className="px-6 py-2.5 bg-teal hover:bg-teal-deep text-white font-semibold rounded-xl text-sm transition shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <ButtonSpinner className="w-4 h-4 text-white" />
                  <span>Extracting Skills via AI Parser...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Parse Resume</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Scanned Notice Alert */}
      {analysis?.isScanned && (
        <div className="mb-8 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
          <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <div className="font-bold">Scanned Document Detected</div>
            <div className="mt-0.5">{analysis.scanNotice}</div>
            <div className="mt-1 text-amber-700">
              Local OCR is not enabled. Upload a text-based PDF or Word file for automated extraction.
            </div>
          </div>
        </div>
      )}

      {/* Structured extraction — confirm / reject per field */}
      {analysis?.structuredFields && (
        <div className="panel p-6 shadow-xs mb-8 space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal" />
            <h2 className="text-base font-semibold text-ink">
              Review extracted profile fields
            </h2>
          </div>
          <p className="text-xs text-ink-muted">
            {analysis.structuredFields.notice ||
              "Heuristic extractions with confidence labels. Confirming does not prove authenticity. CGPA, batch, department and backlogs are never overwritten from extraction."}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Institute & batch come from registration / Academic Info — only degree is useful here */}
            {["degree"].map((key) => {
              const field = analysis.structuredFields.education?.[key];
              if (!field?.value && !field?.confirmed && !field?.rejected) return null;
              if (!field?.value && !field?.rejected) return null;
              return (
                <div key={key} className="p-3 rounded-xl border border-sage bg-paper">
                  <div className="font-semibold text-ink capitalize">
                    {key.replace("_", " ")}
                  </div>
                  <div className="text-ink mt-0.5">{String(field.value || "—")}</div>
                  <div className="text-ink-muted mt-1">
                    Confidence: {field.confidence || "unavailable"} · Provisional
                  </div>
                  <FieldActions
                    decisionBase={{ category: "education", fieldKey: key }}
                    confirmed={!!field.confirmed}
                    rejected={!!field.rejected}
                  />
                </div>
              );
            })}
          </div>

          {[
            ["experience", "Experience"],
            ["internships", "Internships"],
            ["projects", "Projects"],
            ["certifications", "Certifications"],
          ].map(([key, label]) => {
            const items = analysis.structuredFields[key] || [];
            if (!items.length) return null;
            return (
              <div key={key} className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                  {label}
                </h3>
                {items.map((item, idx) => {
                  const title = item.title?.value ?? item.title ?? "";
                  const desc = item.description?.value ?? item.description ?? "";
                  return (
                    <div
                      key={`${key}-${idx}`}
                      className="p-3 rounded-xl border border-sage bg-paper text-xs"
                    >
                      <div className="font-semibold text-ink">{String(title)}</div>
                      {desc && (
                        <div className="text-ink-muted mt-1 line-clamp-3">{String(desc)}</div>
                      )}
                      <div className="text-ink-muted mt-1">
                        Confidence: {item.confidence || item.title?.confidence || "unavailable"} ·
                        Provisional
                      </div>
                      <FieldActions
                        decisionBase={{ category: key, index: idx }}
                        confirmed={!!item.confirmed}
                        rejected={!!item.rejected}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Extracted Skills Review Card */}
      {analysis && (
        <div className="panel p-6 shadow-xs space-y-6">
          <div className="border-b border-sage pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-teal" />
                <h2 className="text-lg font-semibold text-ink">
                  Extracted Technical Competencies
                </h2>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                From <span className="font-medium text-ink">{analysis.originalFileName}</span>. Review and confirm accuracy.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-teal-soft text-ink rounded-lg">
              Status: <span className="capitalize text-teal">{analysis.status}</span>
            </span>
          </div>

          {/* Categorized Skills Breakdown */}
          {analysis.categorizedSkills && Object.keys(analysis.categorizedSkills).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(analysis.categorizedSkills).map(([category, catSkills]) => (
                <div key={category} className="p-3.5 bg-paper rounded-xl border border-sage">
                  <div className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
                    {category}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {catSkills.map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-surface border border-sage text-xs font-medium rounded-md text-ink">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Interactive Skill Editor */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-2">
              Verified Skills (Click 'x' to remove or add missing ones)
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newSkillInput}
                onChange={(e) => setNewSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSkill(e);
                  }
                }}
                placeholder="Add missing skill..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="px-4 py-2 bg-teal-deep text-white text-xs font-semibold rounded-xl hover:bg-teal transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2 p-3 bg-paper rounded-xl border border-sage">
              {editedSkills.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface border border-sage rounded-lg text-xs font-semibold text-teal shadow-xs"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(s)}
                    aria-label={`Remove skill ${s}`}
                    className="text-ink-muted hover:text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveReviewedSkills}
              disabled={savingSkills}
              className="w-full sm:w-auto px-6 py-2.5 bg-teal hover:bg-teal-deep text-white text-sm font-semibold rounded-xl transition shadow-sm disabled:opacity-50 text-center"
            >
              {savingSkills ? "Saving to Profile..." : "Confirm & Save Reviewed Skills"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeUploadPage;
