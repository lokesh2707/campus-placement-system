/** Pick effective project description for resume preview / snapshot */
export const getEffectiveProjectDescription = (project) => {
  if (!project) return "";
  if (
    project.aiEnhancedApproved &&
    project.aiEnhancedDescription &&
    String(project.aiEnhancedDescription).trim()
  ) {
    // Frontend cannot recompute hash easily without crypto; trust approved flag
    // Backend re-validates hash on save/generate.
    return String(project.aiEnhancedDescription).trim();
  }
  return String(project.description || "").trim();
};

export const buildPreviewData = ({ user, form }) => ({
  name: form.name || user?.name || "",
  email: user?.email || "",
  phone: form.phone || "",
  rollNumber: form.rollNumber || "",
  degree: form.degree || "",
  department: form.department || "",
  batch: form.batch,
  cgpa: form.cgpa,
  instituteName: form.instituteName || "",
  professionalSummary: form.professionalSummary || "",
  githubUrl: form.githubUrl || "",
  linkedinUrl: form.linkedinUrl || "",
  portfolioUrl: form.portfolioUrl || "",
  skills: form.skills || [],
  projects: (form.projects || [])
    .filter((p) => p.title)
    .map((p) => ({
      title: p.title,
      description: getEffectiveProjectDescription(p),
      technologies: p.technologies || [],
      githubUrl: p.githubUrl || "",
      liveUrl: p.liveUrl || "",
      link: p.link || "",
    })),
  experience: (form.experience || []).filter((e) => e.role && e.company),
  certifications: (form.certifications || []).filter((c) => c.title),
});
