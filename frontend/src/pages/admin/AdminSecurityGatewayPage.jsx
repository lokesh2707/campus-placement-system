import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ShieldAlert, Lock, AlertTriangle, KeyRound, CheckCircle, Shield, Mail } from "lucide-react";
import PasswordInput from "../../components/PasswordInput";

const AdminSecurityGatewayPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Handle countdown if locked out
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setError("");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/admin/secure-gateway-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429 && data.remainingSeconds) {
          setLockoutSeconds(Math.ceil(data.remainingSeconds));
        }
        throw new Error(data.message || "Administrative verification failed");
      }

      if (data.user?.role !== "admin" && data.user?.role !== "SUPER_ADMIN") {
        throw new Error("Unauthorized privilege level.");
      }

      login(data.user, data.token);
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isLocked = lockoutSeconds > 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-paper">
      <div className="max-w-md w-full panel p-8 border-2 border-sage/80 shadow-md">
        {/* Security Badge Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-teal-soft text-teal-deep flex items-center justify-center mx-auto mb-3 shadow-sm border border-sage">
            <ShieldAlert className="w-7 h-7 text-teal" />
          </div>
          <span className="inline-block text-[11px] font-bold tracking-wider uppercase px-2.5 py-1 rounded bg-accent-soft text-ink border border-sage mb-2">
            Restricted System Zone
          </span>
          <h2 className="font-display text-2xl font-bold text-ink tracking-tight">
            Administrative Security Gateway
          </h2>
          <p className="text-xs text-ink-muted mt-1 leading-relaxed">
            Cryptographically audited access for Platform Super Administrators
          </p>
        </div>

        {/* Brute Force Active Guard Notice */}
        <div className="mb-6 p-3 rounded-lg bg-surface border border-sage text-xs text-ink-muted flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-teal shrink-0 mt-0.5" />
          <span>
            <strong>Anti-Brute Force Protection:</strong> 5 failed attempts will trigger an automatic 15-minute IP lockdown and system audit alert.
          </span>
        </div>

        {/* Lockout Banner */}
        {isLocked && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 animate-shake">
            <Lock className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Gateway Lockout Active</p>
              <p className="text-xs text-red-700 mt-1">
                Access temporarily suspended due to repeated invalid attempts. Cooldown remaining:{" "}
                <span className="font-mono font-bold text-red-900">
                  {Math.floor(lockoutSeconds / 60)}m {lockoutSeconds % 60}s
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && !isLocked && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
              Admin Identity / Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-ink-muted/60 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                required
                disabled={isLocked || submitting}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal text-sm bg-white text-ink placeholder:text-ink-muted/50 shadow-xs transition"
                placeholder="Enter admin email"
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
              Security Key / Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-muted/60 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <PasswordInput
                required
                disabled={isLocked || submitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal text-sm bg-white text-ink placeholder:text-ink-muted/50 shadow-xs transition"
                placeholder="••••••••••••"
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLocked || submitting}
            className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 mt-2 ${
              isLocked
                ? "bg-sage/40 text-ink-muted cursor-not-allowed border border-sage"
                : "btn-primary shadow-sm hover:shadow"
            }`}
          >
            {submitting ? (
              "Authenticating..."
            ) : isLocked ? (
              `Locked (${lockoutSeconds}s)`
            ) : (
              <>
                <KeyRound className="w-4 h-4" /> Authenticate Administrator
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-sage text-center text-[11px] text-ink-muted">
          <span>CampusPlacement Security Framework · Immutable Audit Logging</span>
        </div>
      </div>
    </div>
  );
};

export default AdminSecurityGatewayPage;
