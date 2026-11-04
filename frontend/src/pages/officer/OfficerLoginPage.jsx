import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PasswordInput from "../../components/PasswordInput";
import { Shield, LogIn, AlertCircle, GraduationCap } from "lucide-react";

const OfficerLoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/placement-officer/dashboard";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          expectedRole: "PLACEMENT_OFFICER",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to sign in to officer portal");
      }

      login(data.user, data.token);

      if (data.user?.mustChangePassword) {
        navigate("/change-password", { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-paper">
      <div className="max-w-md w-full panel p-5 sm:p-8 shadow-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-teal-soft text-teal flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold text-teal uppercase tracking-widest block mb-1">
            Institutional Officer Portal
          </span>
          <h2 className="text-2xl font-display font-semibold text-ink tracking-tight">
            Placement Officer Sign In
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Access institute placement analytics, student directory, and recruitment drives
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
              Institutional Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="officer@college.edu"
              className="w-full px-3.5 py-2.5 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-teal text-sm bg-white"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
              Password
            </label>
            <PasswordInput
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-teal text-sm bg-white pr-11"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-teal hover:bg-teal-deep text-white font-semibold rounded-xl text-sm transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {submitting ? "Signing in..." : "Sign In to Officer Portal"}
            <LogIn className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-sage text-center">
          <Link
            to="/student/login"
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition"
          >
            <GraduationCap className="w-3.5 h-3.5" /> Are you a student? Go to Student Portal
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OfficerLoginPage;
