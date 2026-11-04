import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import { UserPlus, AlertCircle, GraduationCap, Briefcase } from "lucide-react";

const RegisterPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to register");
      }

      login(data.user, data.token);

      if (role === "student") navigate("/student/dashboard");
      else if (role === "recruiter") navigate("/recruiter/dashboard");
      else navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] campus-atmosphere flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full panel p-5 sm:p-8 animate-fade-up shadow-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-teal-soft text-teal flex items-center justify-center mx-auto mb-3">
            <UserPlus className="w-6 h-6" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">
            Create an Account
          </h2>
          <p className="text-sm text-ink-muted mt-1">
            Join CampusPlacement as a student or recruiter
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
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
              Select Your Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("student")}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                  role === "student"
                    ? "bg-teal-soft border-teal text-teal"
                    : "border-sage text-ink-muted hover:bg-paper"
                }`}
              >
                <GraduationCap className="w-4 h-4" /> Student
              </button>
              <button
                type="button"
                onClick={() => setRole("recruiter")}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                  role === "recruiter"
                    ? "bg-teal-soft border-teal text-teal"
                    : "border-sage text-ink-muted hover:bg-paper"
                }`}
              >
                <Briefcase className="w-4 h-4" /> Recruiter
              </button>
            </div>
            <p className="mt-2 text-[11px] text-ink-muted">
              Placement Officer and Administrator accounts are provisioned by an administrator — not via public registration.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="input-campus"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. rahul@example.com"
              className="input-campus"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
              Password (Min 6 Characters)
            </label>
            <PasswordInput
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="input-campus pr-11"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full mt-2 py-3 px-4 text-sm disabled:opacity-50"
          >
            {submitting ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-ink-muted">
          Already registered?{" "}
          <Link to="/login" className="font-semibold text-teal hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
