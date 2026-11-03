import React from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Cpu,
  BarChart3,
  Users,
  Lock,
  FileCheck2,
  CheckCircle,
  Building2,
  ArrowRight,
  GraduationCap,
  Sparkles,
} from "lucide-react";

const AboutPage = () => {
  return (
    <div className="bg-paper min-h-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 sm:py-24 border-b border-sage bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-soft text-teal border border-sage mb-4">
              <Sparkles className="w-3.5 h-3.5" /> Institutional Placement Intelligence
            </span>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-ink tracking-tight leading-tight">
              Empowering campus careers through local, verifiable intelligence.
            </h1>
            <p className="mt-5 text-lg text-ink-muted leading-relaxed font-body">
              CampusPlacement is a secure, privacy-first career management platform engineered specifically for colleges and universities. We bridge the gap between academic cohorts and corporate recruiters using transparent, explainable matching algorithms that run 100% locally.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/student/register" className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2">
                Student Get Started <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/student/login" className="btn-secondary px-6 py-3 text-sm">
                Student Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Key Pillars */}
      <section className="py-20 border-b border-sage">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display text-3xl font-semibold text-ink tracking-tight">
              Engineered for Institutional Integrity
            </h2>
            <p className="mt-3 text-ink-muted text-sm sm:text-base">
              Designed from the ground up to solve the privacy, governance, and workflow bottlenecks in higher education placements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pillar 1 */}
            <div className="panel p-6 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-teal-soft text-teal flex items-center justify-center mb-5">
                  <Cpu className="w-6 h-6" />
                </div>
                <h3 className="font-display text-lg font-semibold text-ink mb-2">
                  Zero Cloud Data Leakage
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                  Student resumes and transcripts are processed exclusively through in-memory, local Python NLP services. Student personal identifiable data (PII) is never sent to third-party cloud AI vendors.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-sage/60 text-xs font-semibold text-teal flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> 100% Data Sovereignty
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="panel p-6 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-teal-soft text-teal flex items-center justify-center mb-5">
                  <FileCheck2 className="w-6 h-6" />
                </div>
                <h3 className="font-display text-lg font-semibold text-ink mb-2">
                  Multi-Format Resume AI
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                  Seamlessly ingests PDF, DOCX, and legacy DOC file formats. Students can preview parsed technical skills, categorize proficiencies, and review before committing to their official placement record.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-sage/60 text-xs font-semibold text-teal flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> PDF, DOC & DOCX Support
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="panel p-6 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-teal-soft text-teal flex items-center justify-center mb-5">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="font-display text-lg font-semibold text-ink mb-2">
                  Explainable Job Scoring
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                  No black-box rejections. Academic cutoffs (CGPA, active backlogs, graduation year) are strictly enforced, while technical match scores provide full breakdown of matching vs. missing competencies.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-sage/60 text-xs font-semibold text-teal flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Transparent Match Factors
              </div>
            </div>

            {/* Pillar 4 */}
            <div className="panel p-6 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-teal-soft text-teal flex items-center justify-center mb-5">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="font-display text-lg font-semibold text-ink mb-2">
                  Hardened Security & Audit
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                  Enterprise security architecture including dedicated administrative gateways, brute-force IP lockout defense, cryptographically hashed passwords, and immutable audit logging.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-sage/60 text-xs font-semibold text-teal flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Active Intrusion Defense
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Institutional Architecture */}
      <section className="py-20 bg-surface border-b border-sage">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold text-teal uppercase tracking-wider">
                Multi-Tier Governance
              </span>
              <h2 className="font-display text-3xl font-semibold text-ink mt-2 tracking-tight">
                Role-Based Separation for Fair & Transparent Operations
              </h2>
              <p className="mt-4 text-ink-muted leading-relaxed text-sm sm:text-base">
                Campus placement operations involve confidential academic data, recruiter job specifications, and institutional hiring metrics. CampusPlacement strictly isolates privileges across distinct operational tiers:
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-paper border border-sage">
                  <div className="p-2 rounded-lg bg-teal-soft text-teal shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-ink">Super Administrators & Campuses</h4>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Oversee campus institutions, verify visiting corporate recruiters, provision Placement Officers, and review institution-wide audit logs.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-paper border border-sage">
                  <div className="p-2 rounded-lg bg-teal-soft text-teal shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-ink">Placement Officers & Coordinators</h4>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Monitor departmental placement ratios, track student application statuses, verify roll numbers, and generate accreditation reports.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-paper border border-sage">
                  <div className="p-2 rounded-lg bg-teal-soft text-teal shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-ink">Students & Graduating Batches</h4>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Build verified placement profiles, parse resumes, explore tailored job recommendations with transparent fit criteria, and track recruitment progress.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats / Metrics Card */}
            <div className="panel p-8 bg-paper border-2 border-sage/80 shadow-sm">
              <h3 className="font-display text-xl font-bold text-ink mb-6">
                Platform Performance & Trust Benchmarks
              </h3>

              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 rounded-xl bg-surface border border-sage">
                  <p className="font-display text-3xl font-bold text-teal">100%</p>
                  <p className="text-xs font-medium text-ink mt-1">Local Processing</p>
                  <p className="text-[11px] text-ink-muted mt-0.5">Zero reliance on commercial cloud APIs</p>
                </div>

                <div className="p-4 rounded-xl bg-surface border border-sage">
                  <p className="font-display text-3xl font-bold text-teal">&lt; 300ms</p>
                  <p className="text-xs font-medium text-ink mt-1">Parse Response</p>
                  <p className="text-[11px] text-ink-muted mt-0.5">Fast local Python NLP extraction</p>
                </div>

                <div className="p-4 rounded-xl bg-surface border border-sage">
                  <p className="font-display text-3xl font-bold text-teal">4 Tiers</p>
                  <p className="text-xs font-medium text-ink mt-1">Role Separation</p>
                  <p className="text-[11px] text-ink-muted mt-0.5">Admin, Officer, Recruiter, Student</p>
                </div>

                <div className="p-4 rounded-xl bg-surface border border-sage">
                  <p className="font-display text-3xl font-bold text-teal">0</p>
                  <p className="text-xs font-medium text-ink mt-1">External Data Tracking</p>
                  <p className="text-[11px] text-ink-muted mt-0.5">Complete student record privacy</p>
                </div>
              </div>

              <div className="mt-8 p-4 rounded-xl bg-teal-soft/60 border border-teal/20 text-xs text-ink leading-relaxed">
                <p className="font-semibold text-teal-deep flex items-center gap-1.5 mb-1">
                  <Lock className="w-3.5 h-3.5" /> Institutional Security Commitment
                </p>
                Administrative console routes are isolated and protected against automated brute-force attempts with active IP rate-limiting and session lockouts.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Institutional CTA */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <GraduationCap className="w-12 h-12 text-teal mx-auto mb-4" />
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink tracking-tight">
            Ready to streamline campus placements?
          </h2>
          <p className="mt-3 text-ink-muted text-sm sm:text-base max-w-xl mx-auto">
            Get started by creating your verified student profile or connecting with your institutional placement cell.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/student/register" className="btn-primary px-7 py-3 text-sm">
              Register as Student
            </Link>
            <Link to="/placement-officer/login" className="btn-secondary px-7 py-3 text-sm">
              Placement Officer Access
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
