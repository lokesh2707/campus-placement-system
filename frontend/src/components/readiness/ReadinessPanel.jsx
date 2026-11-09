import React, { useCallback, useEffect, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, CircleHelp, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const SOURCE_LABELS = {
  student_declared: "Your declaration",
  resume_extracted: "Resume keyword evidence",
  legacy_profile_skill: "Older profile entry · source unknown",
};

const ReadinessPanel = () => {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [skillName, setSkillName] = useState("");
  const [proficiency, setProficiency] = useState("");

  const loadReadiness = useCallback(async () => {
    try {
      const response = await fetch("/api/readiness/me", { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || "Readiness information is unavailable.");
      setData(body.readiness);
      setError("");
    } catch (err) {
      setError(err.message || "Readiness information is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadReadiness(); }, [loadReadiness]);

  const saveSkill = async (event) => {
    event.preventDefault();
    if (!skillName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/readiness/me/skills", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert", skillName: skillName.trim(), selfReportedProficiency: proficiency }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || "Skill could not be saved.");
      setSkillName("");
      setProficiency("");
      await loadReadiness();
    } catch (err) { setError(err.message || "Skill could not be saved."); }
    finally { setSaving(false); }
  };

  const updateSkill = async (item, values) => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/readiness/me/skills", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert", declarationId: item.id, skillName: values.skillName, selfReportedProficiency: values.proficiency }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || "Skill could not be updated.");
      await loadReadiness();
    } catch (err) { setError(err.message || "Skill could not be updated."); }
    finally { setSaving(false); }
  };

  const removeSkill = async (item) => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/readiness/me/skills", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", declarationId: item.id }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || "Skill could not be removed.");
      await loadReadiness();
    } catch (err) { setError(err.message || "Skill could not be removed."); }
    finally { setSaving(false); }
  };

  if (loading) return <section aria-label="Placement readiness" className="panel p-6 mb-6 animate-pulse"><div className="h-5 w-52 rounded skeleton-shimmer" /><div className="h-20 mt-4 rounded skeleton-shimmer" /></section>;
  if (error && !data) return <section aria-label="Placement readiness" className="panel p-5 mb-6"><h2 className="font-semibold text-ink">Placement readiness</h2><p role="alert" className="text-sm text-rose-700 mt-2">{error}</p><button className="btn-secondary mt-3 px-3 py-2 text-sm" type="button" onClick={() => { setLoading(true); loadReadiness(); }}>Try again</button></section>;
  if (!data) return null;

  const declared = data.skillInventory.filter((item) => item.source === "student_declared");
  const grouped = ["resume_extracted", "legacy_profile_skill"].map((source) => ({ source, items: data.skillInventory.filter((item) => item.source === source) }));
  const resumeState = data.checklist.resume.state.replaceAll("_", " ");

  return (
    <section aria-labelledby="readiness-title" className="panel p-5 sm:p-6 mb-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><BookOpen aria-hidden="true" className="w-5 h-5 text-teal" /><h2 id="readiness-title" className="text-lg font-semibold text-ink">Placement readiness checklist</h2></div>
          <p className="text-xs text-ink-muted mt-1">Evidence and information coverage for opportunities available to your institute. This is not a proficiency rating.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="text-teal hover:underline inline-flex items-center gap-1" to="/student/profile">Profile <ArrowRight aria-hidden="true" className="w-3.5 h-3.5" /></Link>
          <Link className="text-teal hover:underline inline-flex items-center gap-1" to="/student/profile">Resume review <ArrowRight aria-hidden="true" className="w-3.5 h-3.5" /></Link>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl bg-paper border border-sage p-3"><h3 className="font-semibold text-ink">Profile</h3><p className="text-xs text-ink-muted mt-1">{data.checklist.profile.complete ? "Required profile information is present" : "Information to add: " + (data.checklist.profile.missingInformation.join(", ") || "none")}</p></div>
        <div className="rounded-xl bg-paper border border-sage p-3"><h3 className="font-semibold text-ink">Latest resume</h3><p className="text-xs text-ink-muted mt-1 capitalize">{resumeState}</p><p className="text-xs text-ink-muted">{data.checklist.resume.latestAnalysisAt ? new Date(data.checklist.resume.latestAnalysisAt).toLocaleString() : "No analysis timestamp"}</p></div>
        <div className="rounded-xl bg-paper border border-sage p-3"><h3 className="font-semibold text-ink">Academic fields</h3><p className="text-xs text-ink-muted mt-1">CGPA {data.checklist.academics.present.cgpa ? data.checklist.academics.values.cgpa : "not provided"} · {data.checklist.academics.present.department ? data.checklist.academics.values.department : "department not provided"}</p><p className="text-xs text-ink-muted">Batch {data.checklist.academics.values.batch ?? "not provided"} · Backlogs {data.checklist.academics.values.backlogs ?? "not provided"}</p><p className="text-[11px] text-amber-800 mt-1">Recorded profile information; transcript verification is not available here.</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <h3 className="font-semibold text-ink text-sm mb-2">Skill inventory by source</h3>
          <p className="text-[11px] text-ink-muted mb-3">Resume matches are keyword evidence. Student declarations are self-reported; neither proves proficiency.</p>
          <div className="space-y-3">
            <div className="rounded-xl border border-sage p-3">
              <h4 className="text-xs font-semibold text-ink mb-2">Your declarations ({declared.length})</h4>
              {declared.length === 0 ? <p className="text-xs text-ink-muted">No skills declared yet.</p> : <ul className="space-y-2">{declared.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-2 text-sm"><label className="sr-only" htmlFor={`skill-${item.id}`}>Edit {item.displayName}</label><input id={`skill-${item.id}`} aria-label={`Edit skill ${item.displayName}`} className="min-w-0 flex-1 border border-sage rounded-lg px-2 py-1" defaultValue={item.displayName} onBlur={(event) => { if (event.target.value.trim() && event.target.value.trim() !== item.displayName) updateSkill(item, { skillName: event.target.value.trim(), proficiency: item.selfReportedProficiency }); }} /><select aria-label={`${item.displayName} self-assessed proficiency`} className="border border-sage rounded-lg px-2 py-1 text-xs" value={item.selfReportedProficiency || ""} onChange={(event) => updateSkill(item, { skillName: item.displayName, proficiency: event.target.value })}><option value="">Unspecified</option><option value="beginner">Beginner · self-assessed</option><option value="intermediate">Intermediate · self-assessed</option><option value="advanced">Advanced · self-assessed</option></select><button disabled={saving} type="button" aria-label={`Remove declaration ${item.displayName}`} onClick={() => removeSkill(item)} className="text-rose-700 hover:text-rose-900 disabled:opacity-50"><Trash2 aria-hidden="true" className="w-4 h-4" /></button></li>)}</ul>}
              <form onSubmit={saveSkill} className="flex flex-col sm:flex-row gap-2 mt-3">
                <label className="sr-only" htmlFor="new-readiness-skill">Skill name</label><input id="new-readiness-skill" className="min-w-0 flex-1 border border-sage rounded-lg px-3 py-2 text-sm" maxLength={80} value={skillName} onChange={(event) => setSkillName(event.target.value)} placeholder="Add a skill you want to declare" />
                <label className="sr-only" htmlFor="new-readiness-proficiency">Optional self-assessment</label><select id="new-readiness-proficiency" className="border border-sage rounded-lg px-2 py-2 text-xs" value={proficiency} onChange={(event) => setProficiency(event.target.value)}><option value="">Unspecified</option><option value="beginner">Beginner · self-assessed</option><option value="intermediate">Intermediate · self-assessed</option><option value="advanced">Advanced · self-assessed</option></select>
                <button disabled={saving || !skillName.trim()} type="submit" className="btn-primary px-3 py-2 text-sm inline-flex items-center justify-center gap-1 disabled:opacity-50"><Plus aria-hidden="true" className="w-4 h-4" />{saving ? "Saving" : "Add"}</button>
              </form>
            </div>
            {grouped.map(({ source, items }) => <div key={source} className="rounded-xl border border-sage p-3"><h4 className="text-xs font-semibold text-ink mb-2">{SOURCE_LABELS[source]} ({items.length})</h4>{items.length ? <ul className="flex flex-wrap gap-1.5">{items.map((item) => <li key={item.id} className="rounded-full bg-paper border border-sage px-2 py-1 text-xs text-ink">{item.displayName}<span className="text-ink-muted"> · {item.reviewStatus.replaceAll("_", " ")}</span></li>)}</ul> : <p className="text-xs text-ink-muted">No entries available.</p>}</div>)}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-ink text-sm mb-1">Institute opportunity skill demand</h3>
          <p className="text-[11px] text-ink-muted mb-3">{data.opportunityDemand.currentOpenJobCount} currently open opportunities{data.opportunityDemand.truncated ? ` · showing a recent sample of ${data.opportunityDemand.returnedJobCount}` : ""}. Missing keywords are not a conclusion about your ability.</p>
          {data.opportunityDemand.skills.length === 0 ? <div className="rounded-xl bg-paper p-4 text-xs text-ink-muted">No authorized open job skill requirements are available right now.</div> : <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">{data.opportunityDemand.skills.map((item) => <li key={item.canonicalKey} className="rounded-xl border border-sage p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-ink text-sm">{item.displayName}</span><span className="text-[11px] text-ink-muted">{item.requiredJobCount} required · {item.preferredJobCount} preferred</span></div><p className="text-xs text-ink-muted mt-1">{item.explanation}</p><p className="text-xs text-teal mt-1">{item.nextAction}</p></li>)}</ul>}
          <div className="flex items-start gap-2 text-[11px] text-ink-muted mt-3"><CircleHelp aria-hidden="true" className="w-4 h-4 shrink-0" /><span>Opportunity demand describes job requirements. It is not a student ranking, readiness score, or placement prediction.</span></div>
        </div>
      </div>
      {saving && <p role="status" className="sr-only"><LoaderCircle aria-hidden="true" className="inline w-3 h-3" /> Saving skill information</p>}
      <div className="sr-only" aria-live="polite">{data.skillInventory.length} inventory entries loaded.</div>
      <div className="flex items-center gap-2 text-[11px] text-ink-muted"><CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5" />You can update declared entries here; resume extraction records are read-only.</div>
    </section>
  );
};

export default ReadinessPanel;
