import { isHex } from "@kairos/design/theme-tenant";
import { ArrowLeft } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { useCreateTenant, useTenant, useUpdateTenant } from "../api/tenants";
import type { Plan, ThemeMode } from "../api/types";
import { BrandPreview } from "../components/BrandPreview";
import { ColorField } from "../components/ColorField";
import { useToast } from "../components/Toast";
import { Button, Card, Field, Input, Select, Spinner } from "../components/ui";
import { slugify, toDateInput } from "../lib/format";
import { t } from "../strings";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

interface FormState {
  name: string;
  slug: string;
  plan: Plan;
  ends: string;
  primary: string;
  secondary: string;
  themeMode: ThemeMode;
  scorePerPoint: string;
  maxPointsPerGame: string;
  maxGamesPerDay: string;
  withAdmin: boolean;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

const empty: FormState = {
  name: "",
  slug: "",
  plan: "TRIAL",
  ends: "",
  primary: "#7C3AED",
  secondary: "",
  themeMode: "AUTO",
  scorePerPoint: "10",
  maxPointsPerGame: "50",
  maxGamesPerDay: "10",
  withAdmin: true,
  adminName: "",
  adminEmail: "",
  adminPassword: "",
};

type Errors = Partial<Record<string, string>>;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-4 sm:p-6">
      <h2 className="mb-5 font-display text-lg font-bold">{title}</h2>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export function TenantFormPage() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const existing = useTenant(id);
  const create = useCreateTenant();
  const update = useUpdateTenant(id ?? "");

  const [f, setF] = useState<FormState>(empty);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const tn = existing.data;
    if (!tn) return;
    setF((cur) => ({
      ...cur,
      name: tn.name,
      slug: tn.slug,
      plan: tn.plan,
      ends: toDateInput(tn.subscriptionEndsAt),
      primary: tn.primaryColor,
      secondary: tn.secondaryColor ?? "",
      themeMode: tn.themeMode,
      scorePerPoint: String(tn.scorePerPoint),
      maxPointsPerGame: String(tn.maxPointsPerGame),
      maxGamesPerDay: String(tn.maxGamesPerDay),
    }));
  }, [existing.data]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((cur) => ({ ...cur, [k]: v }));

  function validate(): Errors {
    const e: Errors = {};
    if (f.name.trim().length < 2) e.name = t.errors.required;
    if (!editing && !SLUG_RE.test(f.slug)) e.slug = t.form.slugHint;
    if (!isHex(f.primary)) e.primaryColor = "#RRGGBB";
    if (f.secondary && !isHex(f.secondary)) e.secondaryColor = "#RRGGBB";
    if (editing) {
      for (const k of ["scorePerPoint", "maxPointsPerGame", "maxGamesPerDay"] as const) {
        if (!Number.isInteger(Number(f[k])) || Number(f[k]) < 1) e[k] = "Debe ser un entero positivo";
      }
    }
    if (!editing && f.withAdmin) {
      if (f.adminName.trim().length < 2) e["admin.name"] = t.errors.required;
      if (!/^\S+@\S+\.\S+$/.test(f.adminEmail)) e["admin.email"] = "Correo inválido";
      if (f.adminPassword.length < 10) e["admin.password"] = "Mínimo 10 caracteres";
    }
    return e;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setFormError(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    const common = {
      name: f.name.trim(),
      plan: f.plan,
      subscriptionEndsAt: f.ends ? new Date(f.ends).toISOString() : null,
      primaryColor: f.primary.toUpperCase(),
      secondaryColor: f.secondary ? f.secondary.toUpperCase() : null,
      themeMode: f.themeMode,
    };

    try {
      if (editing) {
        await update.mutateAsync({
          ...common,
          scorePerPoint: Number(f.scorePerPoint),
          maxPointsPerGame: Number(f.maxPointsPerGame),
          maxGamesPerDay: Number(f.maxGamesPerDay),
        });
        toast(t.form.saved);
      } else {
        const created = await create.mutateAsync({
          ...common,
          slug: f.slug,
          ...(f.withAdmin && {
            admin: { name: f.adminName.trim(), email: f.adminEmail.trim(), password: f.adminPassword },
          }),
        });
        toast(t.form.created(created.name));
      }
      navigate("/tenants");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setErrors({ slug: "Ya existe un negocio con ese identificador" });
        else if (err.issues.length) setErrors(Object.fromEntries(err.issues.map((i) => [i.path, i.message])));
        else setFormError(err.message);
      } else {
        setFormError(t.errors.generic);
      }
    }
  }

  if (editing && existing.isPending) return <Spinner />;
  if (editing && existing.isError) return <p className="text-sm text-danger">{t.errors.generic}</p>;

  const busy = create.isPending || update.isPending;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link to="/tenants" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-link">
          <ArrowLeft size={16} aria-hidden /> {t.common.back}
        </Link>
        <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight">
          {editing ? (
            <>
              {t.form.titleEdit} <em className="k">{existing.data?.name}</em>
            </>
          ) : (
            <>
              {t.form.titleNew} <em className="k">{t.form.titleNewWord}</em>
            </>
          )}
        </h1>
      </div>

      <form onSubmit={submit} noValidate className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6">
          <Section title={t.form.sections.business}>
            <Field floating label={t.form.name} htmlFor="name" error={errors.name}>
              <Input
                id="name"
                value={f.name}
                aria-invalid={!!errors.name}
                onChange={(e) => {
                  set("name", e.target.value);
                  if (!editing && !slugTouched) set("slug", slugify(e.target.value));
                }}
              />
            </Field>
            <Field floating label={t.form.slug} htmlFor="slug" hint={t.form.slugHint} error={errors.slug}>
              <Input
                id="slug"
                value={f.slug}
                disabled={editing}
                aria-invalid={!!errors.slug}
                className="font-mono"
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value.toLowerCase());
                }}
              />
            </Field>
          </Section>

          <Section title={t.form.sections.subscription}>
            <Field label={t.form.plan} htmlFor="plan">
              <Select id="plan" value={f.plan} onChange={(e) => set("plan", e.target.value as Plan)}>
                {(["TRIAL", "BASIC", "PRO"] as const).map((p) => (
                  <option key={p} value={p}>
                    {t.tenants.plan[p]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.form.ends} htmlFor="ends" error={errors.subscriptionEndsAt}>
              <Input id="ends" type="date" value={f.ends} onChange={(e) => set("ends", e.target.value)} />
            </Field>
          </Section>

          <Section title={t.form.sections.brand}>
            <ColorField id="primary" label={t.form.primary} value={f.primary} onChange={(v) => set("primary", v)} error={errors.primaryColor} />
            <ColorField id="secondary" label={t.form.secondary} value={f.secondary} onChange={(v) => set("secondary", v)} error={errors.secondaryColor} optional />
            <Field label={t.form.themeMode} htmlFor="themeMode">
              <Select id="themeMode" value={f.themeMode} onChange={(e) => set("themeMode", e.target.value as ThemeMode)}>
                {(["AUTO", "LIGHT", "DARK"] as const).map((m) => (
                  <option key={m} value={m}>
                    {t.form.themeModes[m]}
                  </option>
                ))}
              </Select>
            </Field>
          </Section>

          {editing && (
            <Section title={t.form.sections.points}>
              <Field floating label={t.form.scorePerPoint} htmlFor="spp" error={errors.scorePerPoint}>
                <Input id="spp" inputMode="numeric" value={f.scorePerPoint} onChange={(e) => set("scorePerPoint", e.target.value)} />
              </Field>
              <Field floating label={t.form.maxPointsPerGame} htmlFor="mpg" error={errors.maxPointsPerGame}>
                <Input id="mpg" inputMode="numeric" value={f.maxPointsPerGame} onChange={(e) => set("maxPointsPerGame", e.target.value)} />
              </Field>
              <Field floating label={t.form.maxGamesPerDay} htmlFor="mgd" error={errors.maxGamesPerDay}>
                <Input id="mgd" inputMode="numeric" value={f.maxGamesPerDay} onChange={(e) => set("maxGamesPerDay", e.target.value)} />
              </Field>
            </Section>
          )}

          {!editing && (
            <Card className="p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-bold">{t.form.sections.admin}</h2>
                  <p className="mt-1 text-sm text-ink-2">{t.form.adminHint}</p>
                </div>
                <label className="flex min-h-11 shrink-0 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={f.withAdmin}
                    onChange={(e) => set("withAdmin", e.target.checked)}
                    className="size-5 accent-primary"
                  />
                  {t.form.createAdmin}
                </label>
              </div>
              {f.withAdmin && (
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Field floating label={t.form.adminName} htmlFor="aname" error={errors["admin.name"]}>
                    <Input id="aname" autoComplete="off" value={f.adminName} onChange={(e) => set("adminName", e.target.value)} />
                  </Field>
                  <Field floating label={t.form.adminEmail} htmlFor="aemail" error={errors["admin.email"]}>
                    <Input id="aemail" type="email" autoComplete="off" value={f.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field floating label={t.form.adminPassword} htmlFor="apass" error={errors["admin.password"]}>
                      <Input id="apass" type="password" autoComplete="new-password" value={f.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} />
                    </Field>
                  </div>
                </div>
              )}
            </Card>
          )}

          {formError && (
            <p role="alert" className="rounded-md bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger">
              {formError}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="submit" variant="primary" disabled={busy}>
              {editing ? t.common.save : t.common.create}
            </Button>
            <Button type="button" onClick={() => navigate("/tenants")} disabled={busy}>
              {t.common.cancel}
            </Button>
          </div>
        </div>

        <Card className="min-w-0 p-4 sm:p-5 xl:sticky xl:top-8">
          <BrandPreview name={f.name} primary={f.primary} themeMode={f.themeMode} logoUrl={existing.data?.logoUrl} />
        </Card>
      </form>
    </div>
  );
}
