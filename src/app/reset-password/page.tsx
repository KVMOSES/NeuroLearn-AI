"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Brain, Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowLeft, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { validatePasswordStrengthClient } from "@/lib/password-strength";

/**
 * Stage 1: Forgot-password email form (shown when no token in URL)
 */
function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await api.post("/api/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Check Your Email</h2>
        <p className="text-sm text-muted-foreground mb-6">
          If an account with that email exists, we've sent a password reset link. 
          Please check your inbox and spam folder.
        </p>
        <Button onClick={() => router.push("/")} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Email Address</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type="email"
            className="pl-9 h-10"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading || !email}
        className="w-full h-10 text-sm bg-gradient-to-r from-primary to-primary hover:opacity-90 text-white shadow-sm"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
          <>
            Send Reset Link <Send className="w-3.5 h-3.5 ml-1.5" />
          </>
        )}
      </Button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          Back to Sign In
        </button>
      </div>
    </form>
  );
}

/**
 * Stage 2: Password reset form (shown when token is in the URL)
 * The email is NOT in the URL — the server looks up the user by hashed token.
 */
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const pwStrength = validatePasswordStrengthClient(password);
  const passwordsMatch = password === confirmPassword;

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link. Please request a new password reset.");
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }
    if (!pwStrength.ok) {
      setError(`Password needs: ${pwStrength.reasons.join(", ")}`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.post("/api/auth/reset-password", {
        token,
        password,
        confirmPassword,
      });
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || "Password reset failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Invalid/expired link
  if (!token) {
    return (
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Invalid Reset Link</h2>
        <p className="text-sm text-muted-foreground mb-6">{error || "This link is invalid or has expired."}</p>
        <Button onClick={() => router.push("/reset-password")} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" /> Request New Reset Link
        </Button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Password Reset Successfully</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Your password has been updated. You can now sign in with your new password.
        </p>
        <Button onClick={() => router.push("/")}>
          Sign In <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">New Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type={showPw ? "text" : "password"}
            className="pl-9 pr-10 h-10"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        {password.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i < pwStrength.score
                      ? pwStrength.score <= 1 ? "bg-rose-500"
                        : pwStrength.score <= 2 ? "bg-amber-500"
                        : pwStrength.score <= 3 ? "bg-yellow-500"
                        : "bg-emerald-500"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>
            {pwStrength.reasons.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Needs: {pwStrength.reasons.join(" · ")}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Confirm Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type={showPw ? "text" : "password"}
            className="pl-9 pr-10 h-10"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        {confirmPassword.length > 0 && !passwordsMatch && (
          <p className="text-[10px] text-rose-500">Passwords do not match</p>
        )}
        {confirmPassword.length > 0 && passwordsMatch && (
          <p className="text-[10px] text-emerald-500 flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" /> Passwords match
          </p>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading || !passwordsMatch}
        className="w-full h-10 text-sm bg-gradient-to-r from-primary to-primary hover:opacity-90 text-white shadow-sm"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset Password"}
      </Button>
    </form>
  );
}

/**
 * Page router: shows ForgotPasswordForm when no token, ResetPasswordForm when token present.
 */
function PageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const hasToken = !!token;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden bg-zinc-950">
        <div className="absolute inset-0 mesh-bg opacity-60" />
        <div className="absolute inset-0 grid-bg-white opacity-30" />
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xl border border-white/15 flex items-center justify-center">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold tracking-tight">NeuroLearn AI</p>
              <p className="text-xs text-white/50">Adaptive Learning Platform</p>
            </div>
          </div>

          <div className="max-w-md">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl xl:text-5xl font-bold leading-[1.1] tracking-tight"
            >
              {hasToken ? "Reset your" : "Forgot your"}{" "}
              <span className="gradient-text-warm">password.</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-white/60 text-base mt-5 leading-relaxed"
            >
              {hasToken
                ? "Choose a strong, unique password that you haven't used before."
                : "Enter your email and we'll send you a reset link."}
            </motion.p>
          </div>

          <p className="text-xs text-white/40">Your security matters to us.</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold tracking-tight">NeuroLearn AI</p>
              <p className="text-[11px] text-muted-foreground">Adaptive Learning</p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="text-2xl font-semibold tracking-tight">
              {hasToken ? "Set New Password" : "Forgot Password"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 mb-8">
              {hasToken
                ? "Enter your new password below."
                : "Enter your email to receive a reset link."}
            </p>

            <Suspense fallback={
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            }>
              {hasToken ? <ResetPasswordForm /> : <ForgotPasswordForm />}
            </Suspense>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <PageContent />
    </Suspense>
  );
}