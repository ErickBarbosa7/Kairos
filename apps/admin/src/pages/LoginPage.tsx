import { type FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../api/auth";
import { Wordmark } from "../components/Layout";
import { ThemeSwitch } from "../components/ThemeSwitch";
import { Button, cx, FloatingField } from "../components/ui";
import { t } from "../strings";

const SLUG_KEY = "kairos-last-slug";
const readSlug = () => {
  try {
    return localStorage.getItem(SLUG_KEY) ?? "";
  } catch {
    return "";
  }
};

export function LoginPage() {
  const { user, login } = useAuth();
  const [kind, setKind] = useState<"tenant" | "super">("tenant");
  const [slug, setSlug] = useState(readSlug);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      if (kind === "tenant") {
        await login({ kind, slug: slug.trim().toLowerCase(), email, password });
        try {
          localStorage.setItem(SLUG_KEY, slug.trim().toLowerCase());
        } catch {
          /* sin almacenamiento */
        }
      } else {
        await login({ kind, email, password });
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const ready = email && password && (kind === "super" || slug);

  return (
    <div className="login-bg relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="login-enter w-full max-w-md">
        <header className="mb-8 text-center">
          <Wordmark className="text-5xl text-primary" />
          <h1 className="mt-4 font-display text-3xl font-black leading-tight">
            {t.login.headline} <em className="k text-reward-ink">{t.login.headlineWord}</em>
          </h1>
          <p className="mt-1 text-sm text-ink-2">{t.login.tagline}</p>
        </header>

        <form onSubmit={submit} noValidate className="rounded-md border-2 border-ink bg-surface shadow-hard-lg">
          <div role="tablist" aria-label={t.login.title} className="grid grid-cols-2 border-b-2 border-ink">
            {(["tenant", "super"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                onClick={() => {
                  setKind(k);
                  setError(false);
                }}
                className={cx(
                  "min-h-12 px-2 font-display text-base font-bold uppercase tracking-wide transition-colors duration-100 first:border-r-2 first:border-ink",
                  kind === k ? "bg-ink text-canvas" : "text-ink-2 hover:bg-line/60 hover:text-ink",
                )}
              >
                {k === "tenant" ? t.login.tabTenant : t.login.tabSuper}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-5 p-6 sm:p-8">
            <div>
              <h2 className="font-display text-2xl font-bold">{t.login.title}</h2>
              <p className="mt-1 text-sm text-ink-2">{kind === "tenant" ? t.login.tenantSubtitle : t.login.subtitle}</p>
            </div>

            {kind === "tenant" && (
              <FloatingField label={t.login.slug} id="slug" hint={t.login.slugHint} autoCapitalize="none" spellCheck={false} className="font-mono" value={slug} onChange={(e) => setSlug(e.target.value)} />
            )}
            <FloatingField label={t.login.email} id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <FloatingField
              label={t.login.password}
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error ? t.login.error : undefined}
            />

            <Button type="submit" variant="primary" disabled={busy || !ready} className="min-h-12 w-full text-lg">
              {busy ? t.login.submitting : t.login.submit}
            </Button>
          </div>
        </form>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-xs text-ink-3">{t.login.footer}</p>
          <ThemeSwitch />
        </div>
      </div>
    </div>
  );
}
