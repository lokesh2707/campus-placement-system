/**
 * Server-side student profile completion calculation.
 * Distinguishes essential academic/identity fields from enrichment fields
 * (resume, projects, experience, certifications).
 */

const ESSENTIAL_FIELDS = [
  { key: "rollNumber", label: "Roll number", check: (p) => !!p?.rollNumber && String(p.rollNumber).trim().length > 0 },
  { key: "department", label: "Department", check: (p) => !!p?.department && String(p.department).trim().length > 0 },
  { key: "degree", label: "Degree program", check: (p) => !!p?.degree && String(p.degree).trim().length > 0 },
  { key: "batch", label: "Graduation batch", check: (p) => typeof p?.batch === "number" && p.batch >= 2000 },
  {
    key: "cgpa",
    label: "CGPA",
    check: (p) => typeof p?.cgpa === "number" && p.cgpa >= 0 && p.cgpa <= 10.0,
  },
  {
    key: "skills",
    label: "Technical skills",
    check: (p) =>
      (Array.isArray(p?.skills) && p.skills.length > 0) ||
      (Array.isArray(p?.technicalSkills) && p.technicalSkills.length > 0) ||
      (Array.isArray(p?.languages) && p.languages.length > 0),
  },
];

const ENRICHMENT_FIELDS = [
  {
    key: "phone",
    label: "Contact phone number",
    weight: 5,
    check: (p) => !!(p?.phone && String(p.phone).trim()),
  },
  {
    key: "resume",
    label: "PDF Resume upload",
    weight: 15,
    check: (p) => !!(p?.resumeUrl && String(p.resumeUrl).trim()),
  },
  {
    key: "projects",
    label: "Technical projects",
    weight: 10,
    check: (p) => Array.isArray(p?.projects) && p.projects.length > 0,
  },
  {
    key: "certifications",
    label: "Certifications",
    weight: 5,
    check: (p) => Array.isArray(p?.certifications) && p.certifications.length > 0,
  },
  {
    key: "experience",
    label: "Internship / Work experience",
    weight: 5,
    check: (p) => Array.isArray(p?.experience) && p.experience.length > 0,
  },
  {
    key: "academicHistory",
    label: "Secondary / Higher secondary marks",
    weight: 5,
    check: (p) =>
      p?.academicHistory &&
      (typeof p.academicHistory.tenthPercentage === "number" ||
        typeof p.academicHistory.twelfthPercentage === "number"),
  },
];

function computeProfileCompletion(profile) {
  if (!profile) {
    return {
      percentage: 0,
      isComplete: false,
      missingFields: ESSENTIAL_FIELDS.map((f) => f.label),
      completedFields: [],
      essentialTotal: ESSENTIAL_FIELDS.length,
      essentialDone: 0,
      sections: {
        personal: { isComplete: false, missing: ["Contact phone number"] },
        academic: { isComplete: false, missing: ["Roll number", "Department", "Degree", "Batch", "CGPA"] },
        skills: { isComplete: false, missing: ["Technical skills"] },
        resume: { isComplete: false, missing: ["PDF Resume upload"] },
        projects: { count: 0 },
        certifications: { count: 0 },
        experience: { count: 0 },
      },
    };
  }

  const missingFields = [];
  const completedFields = [];

  for (const field of ESSENTIAL_FIELDS) {
    if (field.check(profile)) {
      completedFields.push(field.label);
    } else {
      missingFields.push(field.label);
    }
  }

  // 60% of total score comes from essential fields, 40% from enrichment
  const essentialDone = ESSENTIAL_FIELDS.length - missingFields.length;
  const essentialScore = Math.round((essentialDone / ESSENTIAL_FIELDS.length) * 60);

  let enrichmentScore = 0;
  for (const field of ENRICHMENT_FIELDS) {
    if (field.check(profile)) {
      enrichmentScore += field.weight;
      completedFields.push(field.label);
    }
  }

  const percentage = Math.min(100, essentialScore + enrichmentScore);
  const isComplete = missingFields.length === 0;

  return {
    percentage,
    isComplete,
    missingFields,
    completedFields,
    essentialTotal: ESSENTIAL_FIELDS.length,
    essentialDone,
    sections: {
      personal: {
        isComplete: !!(profile.phone && String(profile.phone).trim()),
        hasPhone: !!(profile.phone && String(profile.phone).trim()),
        hasAddress: !!(profile.address?.city || profile.address?.state),
      },
      academic: {
        isComplete:
          !!profile.rollNumber &&
          !!profile.department &&
          !!profile.degree &&
          typeof profile.batch === "number" &&
          typeof profile.cgpa === "number",
        rollNumber: profile.rollNumber || null,
        department: profile.department || null,
        degree: profile.degree || "B.Tech",
        batch: profile.batch || null,
        cgpa: profile.cgpa ?? null,
        backlogs: profile.backlogs || 0,
        activeBacklogs: profile.activeBacklogs || 0,
      },
      skills: {
        isComplete:
          (Array.isArray(profile.skills) && profile.skills.length > 0) ||
          (Array.isArray(profile.technicalSkills) && profile.technicalSkills.length > 0),
        totalCount: Array.isArray(profile.skills) ? profile.skills.length : 0,
      },
      resume: {
        isComplete: !!(profile.resumeUrl && String(profile.resumeUrl).trim()),
        fileName: profile.resumeFileName || null,
        uploadedAt: profile.resumeUpdatedAt || null,
        fileSize: profile.resumeFileSize || null,
      },
      projects: {
        count: Array.isArray(profile.projects) ? profile.projects.length : 0,
      },
      certifications: {
        count: Array.isArray(profile.certifications) ? profile.certifications.length : 0,
      },
      experience: {
        count: Array.isArray(profile.experience) ? profile.experience.length : 0,
      },
    },
  };
}

module.exports = { computeProfileCompletion, ESSENTIAL_FIELDS, ENRICHMENT_FIELDS };
