import { useState, FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (mode === "register") {
      if (!name.trim()) {
        errs.name = "Full name is required";
      }
    }

    if (!email.trim()) {
      errs.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please enter a valid email address";
    }

    if (!password) {
      errs.password = "Password is required";
    } else if (password.length < 8) {
      errs.password = "Password must be at least 8 characters";
    }

    setClientErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (!validate() || submitting) return;

    setSubmitting(true);
    try {
      if (mode === "login") {
        await login({
          email: email.trim().toLowerCase(),
          password,
        });
      } else {
        await register({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        });
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError(err?.message || "An unexpected error occurred. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(newMode: "login" | "register") {
    setMode(newMode);
    setClientErrors({});
    setServerError(null);
  }

  return (
    <div className="min-h-screen bg-[#f9f9f9] flex flex-col justify-center items-center px-4 py-12">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-8 h-8 bg-[#0d0d0d] rounded-[4px] flex items-center justify-center shrink-0 shadow-sm">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L2 4v4c0 3.31 2.55 6.41 6 7 3.45-.59 6-3.69 6-7V4L8 1z" fill="white" />
          </svg>
        </div>
        <span className="font-semibold text-lg tracking-tight text-[#0d0d0d]">QuickClaim</span>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md bg-white border border-[#e4e4e7] rounded-[4px] shadow-sm overflow-hidden">
        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 border-b border-[#e4e4e7] bg-[#fcfcfc]">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`py-3 text-sm font-medium transition-colors text-center ${
              mode === "login"
                ? "bg-white text-[#0d0d0d] border-b-2 border-[#0d0d0d] -mb-[1px]"
                : "text-[#71717a] hover:text-[#0d0d0d] hover:bg-[#f4f4f5]"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`py-3 text-sm font-medium transition-colors text-center ${
              mode === "register"
                ? "bg-white text-[#0d0d0d] border-b-2 border-[#0d0d0d] -mb-[1px]"
                : "text-[#71717a] hover:text-[#0d0d0d] hover:bg-[#f4f4f5]"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Card Body */}
        <div className="p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-[17px] font-semibold text-[#0d0d0d] leading-tight">
              {mode === "login" ? "Welcome back" : "Get started with QuickClaim"}
            </h2>
            <p className="text-xs text-[#71717a] mt-1">
              {mode === "login"
                ? "Sign in to access your saved products, receipts, and warranty reminders."
                : "Create an account to track warranties and share product ownership."}
            </p>
          </div>

          {/* Server Error Alert */}
          {serverError && (
            <div className="mb-5 flex items-start gap-2.5 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-[4px]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5 text-[#dc2626]">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M7 4v3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <circle cx="7" cy="10" r="0.7" fill="currentColor" />
              </svg>
              <div className="text-xs text-[#b91c1c] font-medium leading-relaxed">{serverError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-[11px] font-semibold text-[#52525b] mono uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-[#b91c1c]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Marcus Johnson"
                  disabled={submitting}
                  className={`w-full text-sm border rounded-[4px] px-3 py-2 bg-white focus:outline-none transition-colors placeholder:text-[#d4d4d8] ${
                    clientErrors.name
                      ? "border-[#fca5a5] bg-[#fff8f8] focus:border-[#dc2626]"
                      : "border-[#e4e4e7] focus:border-[#a1a1aa]"
                  }`}
                />
                {clientErrors.name && (
                  <p className="text-[11px] text-[#b91c1c] mt-1">{clientErrors.name}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-[#52525b] mono uppercase tracking-wider mb-1.5">
                Email Address <span className="text-[#b91c1c]">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={submitting}
                className={`w-full text-sm border rounded-[4px] px-3 py-2 bg-white focus:outline-none transition-colors placeholder:text-[#d4d4d8] ${
                  clientErrors.email
                    ? "border-[#fca5a5] bg-[#fff8f8] focus:border-[#dc2626]"
                    : "border-[#e4e4e7] focus:border-[#a1a1aa]"
                }`}
              />
              {clientErrors.email && (
                <p className="text-[11px] text-[#b91c1c] mt-1">{clientErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#52525b] mono uppercase tracking-wider mb-1.5">
                Password <span className="text-[#b91c1c]">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={submitting}
                className={`w-full text-sm border rounded-[4px] px-3 py-2 bg-white focus:outline-none transition-colors placeholder:text-[#d4d4d8] ${
                  clientErrors.password
                    ? "border-[#fca5a5] bg-[#fff8f8] focus:border-[#dc2626]"
                    : "border-[#e4e4e7] focus:border-[#a1a1aa]"
                }`}
              />
              {clientErrors.password && (
                <p className="text-[11px] text-[#b91c1c] mt-1">{clientErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-[#0d0d0d] text-white text-sm font-medium py-2.5 rounded-[4px] hover:bg-[#262626] active:bg-[#1a1a1a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>{mode === "login" ? "Signing In..." : "Creating Account..."}</span>
                </>
              ) : (
                <span>{mode === "login" ? "Sign In" : "Create Account"}</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
