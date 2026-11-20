import { AlertCircle, Check } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { Wordmark } from "../components/Layout";
import { Button, FloatingField } from "../components/ui";
import { t } from "../strings";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="login-bg grid min-h-dvh place-items-center px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6 sm:p-8">
        <Wordmark className="block text-primary" />
        <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight">{title}</h1>
        <div className="mt-4 flex flex-col gap-5">{children}</div>
      </div>
    </main>
  );
}

const Alert = ({ children }: { children: React.ReactNode }) => (
  <p role="alert" className="flex items-start gap-2 border-l-2 border-danger bg-danger/10 p-3 text-sm text-danger">
    <AlertCircle size={18} aria-hidden className="mt-0.5 shrink-0" />
    {children}
  </p>
);
const Done = ({ children }: { children: React.ReactNode }) => (
  <p role="status" className="flex items-start gap-2 border-l-2 border-success bg-success/10 p-3 text-sm font-medium">
    <Check size={18} aria-hidden className="mt-0.5 shrink-0 text-success" />
    {children}
  </p>
);

/** Pide el enlace de recuperación. La respuesta es la misma exista o no la cuenta. */
export function ForgotPage() {
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (state === "busy" || !slug.trim() || !email.trim()) return;
    setState("busy");
    try {
      await api("/auth/forgot-password", { method: "POST", auth: false, body: { tenantSlug: slug.trim().toLowerCase(), email: email.trim() } });
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <Shell title={t.recovery.forgotTitle}>
      <p className="text-sm text-ink-2">{t.recovery.forgotBody}</p>
      {state === "sent" ? (
        <Done>{t.recovery.forgotSent}</Done>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <FloatingField label={t.login.slug} id="slug" required maxLength={60} autoCapitalize="none" spellCheck={false} className="font-mono" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <FloatingField label={t.login.email} id="email" type="email" required maxLength={254} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          {state === "error" && <Alert>{t.login.unavailable}</Alert>}
          <Button type="submit" variant="primary" disabled={state === "busy"} className="min-h-12 w-full text-lg">
            {state === "busy" ? t.recovery.sending : t.recovery.send}
          </Button>
        </form>
      )}
      <Link to="/login" className="font-semibold text-link underline underline-offset-2">
        {t.recovery.toLogin}
      </Link>
    </Shell>
  );
}

/** Elegir la contraseña nueva con el token del correo. */
export function ResetPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "invalid" | "short" | "error">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (state === "busy") return;
    if (password.length < 10) return setState("short");
    setState("busy");
    try {
      await api("/auth/reset-password", { method: "POST", auth: false, body: { token, password } });
      setState("done");
    } catch (err) {
      setState(err instanceof ApiError && err.status === 400 ? "invalid" : "error");
    }
  }

  return (
    <Shell title={t.recovery.resetTitle}>
      {state === "done" ? (
        <Done>{t.recovery.resetDone}</Done>
      ) : !token ? (
        <Alert>{t.recovery.invalidLink}</Alert>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <FloatingField label={t.recovery.newPassword} id="password" type="password" autoComplete="new-password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} error={state === "short" ? t.login.passwordShort : undefined} />
          {state === "invalid" && <Alert>{t.recovery.invalidLink}</Alert>}
          {state === "error" && <Alert>{t.login.unavailable}</Alert>}
          <Button type="submit" variant="primary" disabled={state === "busy"} className="min-h-12 w-full text-lg">
            {state === "busy" ? t.recovery.saving : t.recovery.save}
          </Button>
        </form>
      )}
      <Link to="/login" className="font-semibold text-link underline underline-offset-2">
        {t.recovery.toLogin}
      </Link>
    </Shell>
  );
}

/** Confirma el correo al abrir el enlace. */
export function VerifyPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"busy" | "ok" | "fail">(token ? "busy" : "fail");

  useEffect(() => {
    if (!token) return;
    api("/auth/verify-email", { method: "POST", auth: false, body: { token } }).then(
      () => setState("ok"),
      () => setState("fail"),
    );
  }, [token]);

  return (
    <Shell title={t.recovery.verifyTitle}>
      {state === "ok" && <Done>{t.recovery.verifyDone}</Done>}
      {state === "fail" && <Alert>{t.recovery.verifyFail}</Alert>}
      <Link to="/" className="font-semibold text-link underline underline-offset-2">
        {t.recovery.toPanel}
      </Link>
    </Shell>
  );
}
