import { AlertCircle, Ban, CheckCircle2, ChevronDown, Eye, EyeOff, PauseCircle } from "lucide-react";
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, useState } from "react";
import type { TenantStatus } from "../api/types";
import { t } from "../strings";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" };

export function Button({ variant = "secondary", className, ...p }: BtnProps) {
  const styles = {
    primary: "bg-primary text-on-primary border-primary-hover shadow-hard hover:bg-primary-hover hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
    secondary: "bg-transparent text-ink border-ink hover:bg-ink hover:text-canvas",
    danger: "bg-transparent text-danger border-danger hover:bg-danger/10",
    ghost: "bg-transparent text-ink-2 border-transparent hover:bg-line/50",
  }[variant];
  return (
    <button
      {...p}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border-2 px-4 font-display text-base font-bold uppercase tracking-wide transition-[transform,box-shadow,background-color] duration-100 [&>svg]:shrink-0",
        "disabled:cursor-not-allowed disabled:opacity-50",
        styles,
        className,
      )}
    />
  );
}

const floatLabel = (multiline?: boolean) =>
  cx(
    "pointer-events-none absolute left-2 -translate-y-1/2 z-10 bg-surface px-1.5 text-base leading-none text-ink-2 transition-all duration-100",
    multiline ? "top-6" : "top-1/2",
    "peer-focus:top-0 peer-focus:text-sm peer-focus:font-bold peer-focus:uppercase peer-focus:text-ink",
    "peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-sm peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:uppercase peer-[:not(:placeholder-shown)]:text-ink",
  );

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  floating,
  multiline,
}: {
  floating?: boolean;
  multiline?: boolean;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {floating ? (
        <div className="relative">
          {children}
          <label htmlFor={htmlFor} className={floatLabel(multiline)}>
            {label}
          </label>
        </div>
      ) : (
        <>
          <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
            {label}
          </label>
          <div className="relative">{children}</div>
        </>
      )}
      {hint && !error && <p className="text-xs text-ink-2">{hint}</p>}
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs font-medium text-danger">
          <AlertCircle size={14} aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

export function FloatingField({
  label,
  hint,
  error,
  id,
  className,
  type,
  ...p
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; id: string }) {
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="relative">
        <input
          {...p}
          id={id}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          type={isPassword && shown ? "text" : type}
          placeholder=" "
          className={cx(inputCls, "min-h-14", isPassword && "pr-12", className)}
        />
        {isPassword && <EyeToggle shown={shown} onClick={() => setShown((v) => !v)} />}
        <label htmlFor={id} className={floatLabel()}>
          {label}
        </label>
      </div>
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-ink-2">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1 text-xs font-bold text-danger">
          <AlertCircle size={14} aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  "peer min-h-11 min-w-0 w-full rounded-md border-2 border-line bg-surface px-3 text-base text-ink placeholder:text-ink-2 focus:border-focus aria-[invalid=true]:border-danger";

function EyeToggle({ shown, onClick }: { shown: boolean; onClick(): void }) {
  const label = shown ? t.common.password.hide : t.common.password.show;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={shown}
      title={label}
      className="absolute right-1 top-1/2 z-20 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-md border-2 border-transparent text-ink-2 hover:border-ink hover:text-ink"
    >
      {shown ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
    </button>
  );
}

export function Input({ className, type, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false);
  if (type !== "password") return <input placeholder=" " type={type} {...p} className={cx(inputCls, className)} />;
  return (
    <>
      <input placeholder=" " {...p} type={shown ? "text" : "password"} className={cx(inputCls, "pr-12", className)} />
      <EyeToggle shown={shown} onClick={() => setShown((v) => !v)} />
    </>
  );
}

export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea placeholder=" " {...p} className={cx(inputCls, "min-h-32 py-2", className)} />;
}

export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...p} className={cx(inputCls, "select-kairos h-11 appearance-none py-0 pr-10 font-semibold leading-none", className)} />
      <ChevronDown
        size={18}
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-2 transition-transform duration-100 peer-focus:text-ink"
      />
    </div>
  );
}

export function StatusBadge({ status }: { status: TenantStatus }) {
  const map = {
    ACTIVE: { Icon: CheckCircle2, cls: "text-success bg-success/10" },
    SUSPENDED: { Icon: PauseCircle, cls: "text-danger bg-danger/10" },
    CANCELLED: { Icon: Ban, cls: "text-ink-2 bg-line/60" },
  }[status];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-md border-2 border-current px-2.5 py-1 text-xs font-bold uppercase", map.cls)}>
      <map.Icon size={14} aria-hidden />
      {t.tenants.status[status]}
    </span>
  );
}

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cx("rounded-md border-2 border-line bg-surface shadow-hard", className)} />;
}

export function Spinner({ label = t.common.loading }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-ink-2">
      <span className="size-4 animate-spin border-2 border-line border-t-primary" aria-hidden />
      {label}
    </div>
  );
}
