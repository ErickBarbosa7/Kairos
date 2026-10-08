import { isHex } from "@kairos/design/theme-tenant";
import { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "../api/auth";
import { ApiError } from "../api/client";
import type { ThemeMode } from "../api/types";
import { useBrand, useUpdateBrand } from "../api/tenantPanel";
import { BrandPreview } from "../components/BrandPreview";
import { ColorField } from "../components/ColorField";
import { ImageUpload } from "../components/ImageUpload";
import { useToast } from "../components/Toast";
import { Button, Card, Field, Select, Spinner } from "../components/ui";
import { t } from "../strings";

export function TenantBrandPage() {
  const { data, isPending, isError } = useBrand();
  const save = useUpdateBrand();
  const { refreshMe } = useAuth();
  const toast = useToast();

  const [primary, setPrimary] = useState("#7C3AED");
  const [secondary, setSecondary] = useState("");
  const [mode, setMode] = useState<ThemeMode>("AUTO");
  const [logo, setLogo] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    setPrimary(data.primaryColor);
    setSecondary(data.secondaryColor ?? "");
    setMode(data.themeMode);
    setLogo(data.logoUrl);
  }, [data]);

  if (isPending) return <Spinner />;
  if (isError) return <p className="text-sm text-danger">{t.errors.generic}</p>;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!isHex(primary)) errs.primaryColor = "#RRGGBB";
    if (secondary && !isHex(secondary)) errs.secondaryColor = "#RRGGBB";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await save.mutateAsync({
        primaryColor: primary.toUpperCase(),
        secondaryColor: secondary ? secondary.toUpperCase() : null,
        themeMode: mode,
        logoUrl: logo,
      });
      await refreshMe();
      toast(t.brand.saved);
    } catch (err) {
      if (err instanceof ApiError && err.issues.length) setErrors(Object.fromEntries(err.issues.map((i) => [i.path, i.message])));
      else setErrors({ form: t.errors.generic });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          {t.brand.title} <em className="k">{t.brand.titleWord}</em>
        </h1>
        <p className="mt-2 text-ink-2">{t.brand.intro}</p>
      </header>

      <form onSubmit={submit} noValidate className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-w-0 flex flex-col gap-6 p-4 sm:p-6">
          <ImageUpload label={t.brand.logo} hint={t.brand.logoHint} value={logo} onChange={setLogo} />
          <div className="grid gap-5 sm:grid-cols-2">
            <ColorField id="primary" label={t.form.primary} value={primary} onChange={setPrimary} error={errors.primaryColor} />
            <ColorField id="secondary" label={t.form.secondary} value={secondary} onChange={setSecondary} error={errors.secondaryColor} optional />
            <Field label={t.form.themeMode} htmlFor="mode">
              <Select id="mode" value={mode} onChange={(e) => setMode(e.target.value as ThemeMode)}>
                {(["AUTO", "LIGHT", "DARK"] as const).map((m) => (
                  <option key={m} value={m}>
                    {t.form.themeModes[m]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {errors.logoUrl && <p role="alert" className="text-sm text-danger">{errors.logoUrl}</p>}
          {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
          <div>
            <Button type="submit" variant="primary" disabled={save.isPending}>
              {t.common.save}
            </Button>
          </div>
        </Card>

        <Card className="min-w-0 p-4 sm:p-5 xl:sticky xl:top-8">
          <BrandPreview name={data.name} primary={primary} themeMode={mode} logoUrl={logo} />
        </Card>
      </form>
    </div>
  );
}
