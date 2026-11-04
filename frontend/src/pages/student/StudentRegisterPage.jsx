import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PasswordInput from "../../components/PasswordInput";
import { GraduationCap, UserPlus, AlertCircle, Building2 } from "lucide-react";

const StudentRegisterPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [institute, setInstitute] = useState("");
  const [institutes, setInstitutes] = useState([]);
  const [loadingInstitutes, setLoadingInstitutes] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Load active institutes for mandatory association
  useEffect(() => {
    let isMounted = true;
    const fetchInstitutes = async () => {
      try {
        const res = await fetch("/api/auth/institutes");
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.institutes)) {
          setInstitutes(data.institutes);
          if (data.institutes.length > 0) {
            setInstitute(data.institutes[0]._id);
          }
        }
      } catch (err) {
        console.error("Failed to load active institutes:", err);
      } finally {
        if (isMounted) setLoadingInstitutes(false);
      }
    };
    fetchInstitutes();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!rollNumber.trim()) {
      setError("College roll number is required.");
      return;
    }

    if (!institute) {
      setError("Please select your affiliated institute.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/student/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          rollNumber: rollNumber.trim().toUpperCase(),
          institute,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to create student account");
      }

      login(data.user, data.token);
      navigate("/student/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-paper">
      <div className="max-w-md w-full panel p-5 sm:p-8 shadow-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-teal-soft text-teal flex items-center justify-center mx-auto mb-3">
            <GraduationCap className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold text-teal uppercase tracking-widest block mb-1">
            Student Portal
          </span>
          <h2 className="text-2xl font-display font-semibold text-ink tracking-tight">
            Get Started
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Create your student account for campus placement drives
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
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              className="w-full px-3.5 py-2.5 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-teal text-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
              Student Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="priya@college.edu"
              className="w-full px-3.5 py-2.5 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-teal text-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
              Affiliated Institute
            </label>
            {loadingInstitutes ? (
              <div className="text-xs text-ink-muted py-2">Loading active institutes...</div>
            ) : institutes.length === 0 ? (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs">
                No active institutes found. Please contact your institutional placement administrator to activate your college.
              </div>
            ) : (
              <div className="relative">
                <select
                  required
                  value={institute}
                  onChange={(e) => setInstitute(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-teal text-sm bg-white"
                >
                  {institutes.map((inst) => (
                    <option key={inst._id} value={inst._id}>
                      {inst.name} ({inst.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
              College Roll Number
            </label>
            <input
              type="text"
              required
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
              placeholder="e.g. 22MH1A0501"
              className="w-full px-3.5 py-2.5 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-teal text-sm bg-white uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
              Password
            </label>
            <PasswordInput
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-teal text-sm bg-white pr-11"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
              Confirm Password
            </label>
            <PasswordInput
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-teal text-sm bg-white pr-11"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || (institutes.length === 0 && !loadingInstitutes)}
            className="w-full py-2.5 px-4 bg-teal hover:bg-teal-deep text-white font-semibold rounded-xl text-sm transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {submitting ? "Creating Account..." : "Create Student Account"}
            <UserPlus className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-sage text-center">
          <p className="text-xs text-ink-muted">
            Already have an account?{" "}
            <Link
              to="/student/login"
              className="font-semibold text-teal hover:underline"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default StudentRegisterPage;
