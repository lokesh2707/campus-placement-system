import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PasswordInput from "../../components/PasswordInput";
import { Briefcase, Building, UserPlus, AlertCircle, CheckCircle2, GraduationCap } from "lucide-react";

const RecruiterRegisterPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyIndustry, setCompanyIndustry] = useState("Information Technology");
  const [companyLocation, setCompanyLocation] = useState("Bengaluru, India");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/recruiter/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          companyName,
          companyWebsite,
          companyIndustry,
          companyLocation,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to register recruiter account");
      }

      login(data.user, data.token);
      navigate("/recruiter/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-paper">
      <div className="max-w-lg w-full panel p-8 shadow-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto mb-3">
            <Building className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold text-purple-700 uppercase tracking-widest block mb-1">
            Recruiter Portal
          </span>
          <h2 className="text-2xl font-display font-semibold text-ink tracking-tight">
            Register Corporate Account
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Create your enterprise recruiter profile and submit company details for verification
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                Recruiter Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Neha Kapoor"
                className="w-full px-3.5 py-2 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                Work Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. neha@google.com"
                className="w-full px-3.5 py-2 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
              Password
            </label>
            <PasswordInput
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              autoComplete="new-password"
              className="w-full px-3.5 py-2 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm bg-white pr-11"
            />
          </div>

          <div className="pt-2 border-t border-sage">
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider block mb-2">
              Company / Organization Profile
            </span>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                  Company Legal Name
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Google India Pvt Ltd"
                  className="w-full px-3.5 py-2 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                    Industry Domain
                  </label>
                  <input
                    type="text"
                    value={companyIndustry}
                    onChange={(e) => setCompanyIndustry(e.target.value)}
                    placeholder="e.g. Cloud & AI"
                    className="w-full px-3.5 py-2 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                    Hiring Location / HQ
                  </label>
                  <input
                    type="text"
                    value={companyLocation}
                    onChange={(e) => setCompanyLocation(e.target.value)}
                    placeholder="e.g. Bengaluru, India"
                    className="w-full px-3.5 py-2 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                  Company Careers Website
                </label>
                <input
                  type="url"
                  value={companyWebsite}
                  onChange={(e) => setCompanyWebsite(e.target.value)}
                  placeholder="https://careers.company.com"
                  className="w-full px-3.5 py-2 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm bg-white"
                />
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-[11px] text-purple-900 leading-relaxed">
            <strong>Note on Company Verification:</strong> To protect student safety and maintain placement standards, new hiring organizations require Placement Officer verification before job listings can be published publicly.
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-xl text-sm transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? "Registering..." : "Create Recruiter Account"}
            <UserPlus className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-sage text-center space-y-3">
          <p className="text-xs text-ink-muted">
            Already have a recruiter account?{" "}
            <Link
              to="/recruiter/login"
              className="font-semibold text-purple-700 hover:underline"
            >
              Sign In
            </Link>
          </p>
          <div className="pt-2">
            <Link
              to="/student/register"
              className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition"
            >
              <GraduationCap className="w-3.5 h-3.5" /> Are you a student? Register as Student
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecruiterRegisterPage;
