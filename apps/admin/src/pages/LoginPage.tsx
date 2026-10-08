import { AlertCircle } from "lucide-react";
import { type FormEvent, lazy, Suspense, useState } from "react";
import { Navigate } from "react-router-dom";
import { useLottie } from "lottie-react";
import arrow from "../assets/arrow.json";
import { useAuth } from "../api/auth";
import { ApiError } from "../api/client";
import { Wordmark } from "../components/Layout";
import { Modal } from "../components/Modal";
import { ThemeSwitch } from "../components/ThemeSwitch";
import { useToast } from "../components/Toast";
import { Button, cx, FloatingField } from "../components/ui";
import { t } from "../strings";

const LoginAnimation = lazy(() => import("../components/LoginAnimation"));
const LoginLanding = lazy(() => import("../components/LoginLanding"));

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function ArrowIcon({ className }: { className?: string }) {
  const { View } = useLottie({
    animationData: arrow,
    loop: true,
    autoplay: !reduceMotion(),
    rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
  });
  return (
    <div aria-hidden className={cx("size-8", className)}>
      {View}
    </div>
  );
}

const SLUG_KEY = "kairos-last-slug";
const readSlug = () => {
  try {
    return localStorage.getItem(SLUG_KEY) ?? "";
  } catch {
    return "";
  }
};

export function LoginPage() {
  const { user, login, register } = useAuth();
  const toast = useToast();
  // "register" es el alta de un negocio con prueba gratis; "login" es entrar a una cuenta.
  const [mode, setMode] = useState<"login" | "register">("login");
  const [businessName, setBusinessName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [kind, setKind] = useState<"tenant" | "super">("tenant");
  const [slug, setSlug] = useState(readSlug);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  if (user) return <Navigate to="/" replace />;

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError(null);
    setErrors({});
    setFormOpen(true);
    window.setTimeout(() => (document.getElementById(next === "register" ? "businessName" : slug ? "email" : "slug") ?? document.getElementById("email"))?.focus(), 50);
  }

  async function submitRegister(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const fields: Record<string, string> = {};
    const cleanEmail = email.trim();
    if (businessName.trim().length < 2) fields.businessName = t.login.required;
    if (adminName.trim().length < 2) fields.adminName = t.login.required;
    if (!cleanEmail) fields.email = t.login.required;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) fields.email = t.login.invalidEmail;
    if (password.length < 10) fields.password = t.login.passwordShort;
    setErrors(fields);
    setError(null);
    const first = Object.keys(fields)[0];
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    setBusy(true);
    try {
      const { slug: assigned } = await register({ businessName: businessName.trim(), adminName: adminName.trim(), email: cleanEmail, password });
      try {
        localStorage.setItem(SLUG_KEY, assigned);
      } catch {
        /* sin almacenamiento */
      }
      toast(t.login.registered(assigned));
    } catch (err) {
      let message = t.login.unavailable;
      if (err instanceof ApiError) {
        if (err.status === 0) message = t.login.networkError;
        else if (err.status === 429) message = t.login.registerRateLimited;
        else if (err.status === 400) message = t.login.emailTaken;
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const fields: Record<string, string> = {};
    const cleanEmail = email.trim();
    const cleanSlug = slug.trim().toLowerCase();
    if (kind === "tenant" && !cleanSlug) fields.slug = t.login.required;
    if (!cleanEmail) fields.email = t.login.required;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) fields.email = t.login.invalidEmail;
    if (!password) fields.password = t.login.required;
    setErrors(fields);
    setError(null);
    if (Object.keys(fields).length) {
      const first = Object.keys(fields)[0];
      if (first) document.getElementById(first)?.focus();
      return;
    }
    setBusy(true);
    try {
      if (kind === "tenant") {
        await login({ kind, slug: cleanSlug, email: cleanEmail, password });
        try {
          localStorage.setItem(SLUG_KEY, cleanSlug);
        } catch {
          /* sin almacenamiento */
        }
      } else {
        await login({ kind, email: cleanEmail, password });
      }
    } catch (err) {
      let message = t.login.unavailable;
      if (err instanceof ApiError) {
        if (err.status === 0) message = t.login.networkError;
        else if (err.status === 429) message = t.login.rateLimited;
        else if (err.status === 401) message = err.message;
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="login-bg flex min-h-dvh flex-col px-4 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
          <Wordmark className="login-wordmark block text-primary" />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="min-h-11 rounded-md border-2 border-ink px-4 font-display text-base font-bold uppercase tracking-wide text-ink hover:bg-line/60"
            >
              {t.login.title}
            </button>
            <ThemeSwitch />
          </div>
        </div>
        <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 py-8 sm:gap-10 lg:grid-cols-2 lg:gap-16 lg:py-12">
          <header className="min-w-0 text-center lg:text-left">
            <h1 className="mx-auto max-w-xl font-display text-4xl font-black leading-tight sm:text-5xl lg:mx-0 lg:text-6xl">
              {t.login.headline} <em className="k text-reward-ink">{t.login.headlineWord}</em>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-ink-2 sm:text-lg lg:mx-0">{t.login.tagline}</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Button type="button" variant="primary" onClick={() => switchMode("register")} className="min-h-12 px-8 text-lg">
                {t.login.trialAction}
              </Button>
              <a href="#como-funciona" className="inline-flex min-h-12 items-center px-2 font-semibold text-link underline underline-offset-2 hover:text-ink">
                {t.landing.scroll}
              </a>
            </div>
            <p className="mt-3 text-sm text-ink-2">{t.login.trialNote}</p>
          </header>
          <div className="mx-auto w-full max-w-xs lg:max-w-md">
            <Suspense fallback={null}>
              <LoginAnimation />
            </Suspense>
          </div>
        </div>
        <a
          href="#como-funciona"
          className="mx-auto mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"
        >
          {t.landing.scroll}
          <ArrowIcon />
        </a>
      </div>
      <Modal dismissible open={formOpen} title={mode === "register" ? t.login.registerTitle : t.login.title} onClose={() => !busy && setFormOpen(false)}>
          <form id="login" onSubmit={mode === "register" ? submitRegister : submit} noValidate aria-busy={busy} className="w-full min-w-0">
            {mode === "login" && (
              <div role="group" aria-label={t.login.title} className="grid grid-cols-2 rounded-md border-2 border-ink overflow-hidden mb-4">
                {(["tenant", "super"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={kind === k}
                    disabled={busy}
                    onClick={() => {
                      setKind(k);
                      setError(null);
                      setErrors({});
                    }}
                    className={cx(
                      "min-h-14 px-3 py-2 font-display text-base font-bold uppercase tracking-wide transition-colors duration-100 first:border-r-2 first:border-ink disabled:opacity-60",
                      kind === k ? "bg-ink text-canvas" : "text-ink-2 hover:bg-line/60 hover:text-ink",
                    )}
                  >
                    {k === "tenant" ? t.login.tabTenant : t.login.tabSuper}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-5 pt-1">
              <div>
                <p className="text-sm text-ink-2">
                  {mode === "register" ? t.login.registerSubtitle : kind === "tenant" ? t.login.tenantSubtitle : t.login.subtitle}
                </p>
              </div>

              {mode === "register" && (
                <>
                  <FloatingField
                    label={t.login.businessName}
                    id="businessName"
                    error={errors.businessName}
                    required
                    disabled={busy}
                    maxLength={100}
                    autoComplete="organization"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                  <FloatingField
                    label={t.login.adminName}
                    id="adminName"
                    error={errors.adminName}
                    required
                    disabled={busy}
                    maxLength={100}
                    autoComplete="name"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                  />
                </>
              )}
              {mode === "login" && kind === "tenant" && (
                <FloatingField
                  label={t.login.slug}
                  id="slug"
                  hint={t.login.slugHint}
                  error={errors.slug}
                  required
                  disabled={busy}
                  maxLength={60}
                  autoCapitalize="none"
                  spellCheck={false}
                  className="font-mono"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              )}
              <FloatingField
                label={t.login.email}
                id="email"
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                error={errors.email}
                disabled={busy}
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <FloatingField
                label={mode === "register" ? t.login.registerPassword : t.login.password}
                id="password"
                type="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                required
                disabled={busy}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
              />

              {error && (
                <p role="alert" className="flex items-start gap-2 border-l-2 border-danger bg-danger/10 p-3 text-sm text-danger">
                  <AlertCircle size={18} aria-hidden className="mt-0.5 shrink-0" />
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" disabled={busy} className="min-h-12 w-full text-lg">
                {mode === "register" ? (busy ? t.login.registering : t.login.registerSubmit) : busy ? t.login.submitting : t.login.submit}
              </Button>
              <p className="text-center text-sm text-ink-2">
                {mode === "login" && <>{t.login.trialPrompt} </>}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => switchMode(mode === "register" ? "login" : "register")}
                  className="min-h-11 font-semibold text-link underline underline-offset-2 hover:text-ink disabled:opacity-60"
                >
                  {mode === "register" ? t.login.backToLogin : t.login.trialAction}
                </button>
              </p>
            </div>
          </form>
      </Modal>
      <Suspense fallback={null}>
        <LoginLanding onStartTrial={() => switchMode("register")} onLogin={() => switchMode("login")} />
      </Suspense>
      <footer className="mx-auto w-full max-w-6xl border-t-2 border-line pt-4 text-center text-xs text-ink-2 lg:text-left">
        {t.login.footer}
      </footer>
    </div>
  );
}
