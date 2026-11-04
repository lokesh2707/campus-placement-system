import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import { LogIn, AlertCircle, Shield } from "lucide-react";

/**
 * Unadvertised institutional login for Placement Officers and Administrators.
 * Not linked from the public landing page.
 */
const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, expectedRole: "placement_officer" }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to log in");
      }

      const role = data.user?.role;
      if (role !== "placement_officer") {
        throw new Error(
          "This sign-in page is reserved for Placement Officers only."
        );
      }

      login(data.user, data.token);

      if (from && from !== "/") {
        navigate(from, { replace: true });
      } else {
        navigate("/placement-officer/dashboard");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] campus-atmosphere flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full panel p-5 sm:p-8 animate-fade-up shadow-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-teal-soft text-teal flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">
            Placement Officer Sign In
          </h2>
          <p className="text-sm text-ink-muted mt-1">
            Institutional placement team and officer access
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="institutional-email"
              className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5"
            >
              Email
            </label>
            <input
              id="institutional-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-teal text-sm bg-white"
            />
          </div>
          <div>
            <label
              htmlFor="institutional-password"
              className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5"
            >
              Password
            </label>
            <PasswordInput
              id="institutional-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-teal text-sm bg-white pr-11"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-teal hover:bg-teal-deep text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign In"}
            <LogIn className="w-4 h-4" />
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-muted">
          Looking for the student portal?{" "}
          <Link to="/student/login" className="font-semibold text-teal hover:underline">
            Student Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
