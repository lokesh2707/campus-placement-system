import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FileCheck,
  Sparkles,
  ClipboardList,
  ArrowRight,
  GraduationCap,
} from "lucide-react";

const LandingPage = () => {
  const { user } = useAuth();

  const getDashboardLink = () => {
    if (!user) return "/student/login";
    const role = user.role?.toUpperCase();
    if (role === "STUDENT") return "/student/dashboard";
    if (role === "RECRUITER") return "/recruiter/dashboard";
    if (role === "SUPER_ADMIN" || role === "ADMIN") return "/admin/dashboard";
    if (role === "PLACEMENT_OFFICER") return "/placement-officer/dashboard";
    return "/student/dashboard";
  };

  return (
    <div className="bg-paper min-h-full">
      <section
        id="home"
        className="relative overflow-hidden min-h-[calc(100vh-4rem)] flex items-center"
      >
        <img
          src="/brand/hero-collaboration.jpg"
          alt="Students collaborating on campus placement with AI career insights"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-paper/95 via-paper/80 to-paper/25"
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12 sm:py-16 lg:py-24 relative z-10">
          <div className="max-w-xl">
            <p className="animate-fade-up font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-teal tracking-tight">
              <span className="brand-underline">CampusPlacement</span>
            </p>
            <h1 className="animate-fade-up-delay mt-6 font-display text-4xl sm:text-5xl lg:text-[3.25rem] font-semibold text-ink tracking-tight leading-[1.15]">
              Placement intelligence for every campus career path.
            </h1>
            <p className="animate-fade-up-delay-2 mt-5 text-lg text-ink-muted leading-relaxed max-w-xl font-body">
              Build your student profile, parse your resume, and discover explainable
              job matches from verified campus recruiters.
            </p>
            <div className="animate-fade-up-delay-2 mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {user ? (
                <Link
                  to={getDashboardLink()}
                  className="btn-primary px-7 py-3.5 inline-flex items-center justify-center gap-2 text-base"
                >
                  Go to Your Dashboard <ArrowRight className="w-5 h-5" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/student/register"
                    className="btn-primary px-7 py-3.5 inline-flex items-center justify-center gap-2 text-base"
                  >
                    Get Started <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    to="/student/login"
                    className="btn-secondary px-7 py-3.5 inline-flex items-center justify-center gap-2 text-base"
                  >
                    Student Login
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="border-t border-sage bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-soft text-teal border border-sage mb-3">
                <Sparkles className="w-3.5 h-3.5" /> Institutional Placement Intelligence
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-ink tracking-tight">
                About CampusPlacement
              </h2>
              <p className="mt-4 text-ink-muted leading-relaxed text-base">
                CampusPlacement is engineered specifically for higher education campuses to bridge academic cohorts and corporate hiring teams. Designed with 100% data sovereignty, all resume parsing and skill matching run locally with zero cloud API reliance.
              </p>
              
              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-teal-soft text-teal flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <p className="text-sm text-ink-muted">
                    <strong className="text-ink">Multi-Format Resume AI:</strong> Local in-memory parsing for PDF, DOC, and DOCX files without third-party data transmission.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-teal-soft text-teal flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <p className="text-sm text-ink-muted">
                    <strong className="text-ink">Explainable Skill Fit:</strong> Transparent match breakdowns keeping academic eligibility distinct from skill scores.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-teal-soft text-teal flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <p className="text-sm text-ink-muted">
                    <strong className="text-ink">Institutional Governance:</strong> Dedicated portals for Students, Recruiters, Placement Officers, and Super Admins.
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <Link
                  to="/about"
                  className="btn-secondary px-6 py-2.5 text-sm inline-flex items-center gap-2"
                >
                  Read Full Architecture & Mission <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="panel p-4 sm:p-5 bg-paper">
                <p className="font-display text-2xl sm:text-3xl font-bold text-teal">100%</p>
                <p className="text-xs font-semibold text-ink mt-1">Local Processing</p>
                <p className="text-[11px] text-ink-muted mt-1">Zero cloud AI vendor dependencies</p>
              </div>
              <div className="panel p-4 sm:p-5 bg-paper">
                <p className="font-display text-2xl sm:text-3xl font-bold text-teal">3 Formats</p>
                <p className="text-xs font-semibold text-ink mt-1">Resume Ingestion</p>
                <p className="text-[11px] text-ink-muted mt-1">PDF, DOCX & legacy DOC</p>
              </div>
              <div className="panel p-4 sm:p-5 bg-paper">
                <p className="font-display text-2xl sm:text-3xl font-bold text-teal">4 Tiers</p>
                <p className="text-xs font-semibold text-ink mt-1">Role Security</p>
                <p className="text-[11px] text-ink-muted mt-1">Strict role-based data isolation</p>
              </div>
              <div className="panel p-4 sm:p-5 bg-paper">
                <p className="font-display text-2xl sm:text-3xl font-bold text-teal">Real-time</p>
                <p className="text-xs font-semibold text-ink mt-1">Cohort Analytics</p>
                <p className="text-[11px] text-ink-muted mt-1">Departmental placement metrics</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-sage bg-paper">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <div className="max-w-2xl mb-8 sm:mb-12">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
              Student features
            </h2>
            <p className="mt-2 sm:mt-3 text-ink-muted text-sm sm:text-base">
              Everything you need for campus drives in one student portal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8">
            <div className="panel p-6">
              <div className="w-11 h-11 rounded-xl bg-teal-soft text-teal flex items-center justify-center mb-4">
                <FileCheck className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-semibold text-ink mb-2">
                Profile & resume
              </h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                Complete academic details and upload a PDF resume for local skill extraction you can review before saving.
              </p>
            </div>
            <div className="panel p-6">
              <div className="w-11 h-11 rounded-xl bg-teal-soft text-teal flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-semibold text-ink mb-2">
                AI job matches
              </h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                See explainable match scores against verified company openings, with eligibility kept separate from skill scoring.
              </p>
            </div>
            <div className="panel p-6">
              <div className="w-11 h-11 rounded-xl bg-teal-soft text-teal flex items-center justify-center mb-4">
                <ClipboardList className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-semibold text-ink mb-2">
                Applications & results
              </h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                Track Applied → Interview → Selected stages and see confirmed placement results after recruiter decisions.
              </p>
            </div>
          </div>

          {!user && (
            <div className="mt-12 flex flex-col sm:flex-row gap-3">
              <Link
                to="/student/register"
                className="btn-primary px-6 py-3 inline-flex items-center justify-center gap-2"
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/student/login"
                className="btn-secondary px-6 py-3 inline-flex items-center justify-center"
              >
                Student Login
              </Link>
            </div>
          )}

          <div className="mt-16 flex items-center justify-center gap-3 text-ink-muted text-xs">
            <GraduationCap className="w-5 h-5 text-teal" />
            <span>CampusPlacement · Free & open-source local stack</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
