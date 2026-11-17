import { Coins } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { useEconomy, useUpdateEconomy } from "../api/tenantPanel";
import { useToast } from "../components/Toast";
import { Button, Card, Field, Input, Spinner } from "../components/ui";
import { t } from "../strings";

/** Puntaje de ejemplo para mostrar la conversión mientras el administrador ajusta los campos. */
const EXAMPLE_SCORE = 500;

const isPositiveInt = (n: number) => Number.isInteger(n) && n >= 1;

export function TenantEconomyPage() {
  const { data, isPending, isError } = useEconomy();
  const save = useUpdateEconomy();
  const toast = useToast();

  const [scorePerPoint, setScorePerPoint] = useState("10");
  const [maxPointsPerGame, setMaxPointsPerGame] = useState("50");
  const [maxGamesPerDay, setMaxGamesPerDay] = useState("10");
  const [avgTicket, setAvgTicket] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    setScorePerPoint(String(data.scorePerPoint));
    setMaxPointsPerGame(String(data.maxPointsPerGame));
    setMaxGamesPerDay(String(data.maxGamesPerDay));
    setAvgTicket(data.avgTicket === null ? "" : String(data.avgTicket));
  }, [data]);

  if (isPending) return <Spinner />;
  if (isError) return <p className="text-sm text-danger">{t.errors.generic}</p>;

  const values = {
    scorePerPoint: Number(scorePerPoint),
    maxPointsPerGame: Number(maxPointsPerGame),
    maxGamesPerDay: Number(maxGamesPerDay),
  };
  const examplePoints =
    isPositiveInt(values.scorePerPoint) && isPositiveInt(values.maxPointsPerGame)
      ? Math.min(Math.floor(EXAMPLE_SCORE / values.scorePerPoint), values.maxPointsPerGame)
      : 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) if (!isPositiveInt(value)) errs[key] = t.economy.invalid;
    setErrors(errs);
    if (avgTicket !== "" && (!Number.isInteger(Number(avgTicket)) || Number(avgTicket) < 0)) errs.avgTicket = t.economy.invalidTicket;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await save.mutateAsync({ ...values, avgTicket: avgTicket === "" ? null : Number(avgTicket) });
      toast(t.economy.saved);
    } catch (err) {
      if (err instanceof ApiError && err.issues.length) setErrors(Object.fromEntries(err.issues.map((i) => [i.path, i.message])));
      else setErrors({ form: t.errors.generic });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          {t.economy.title} <em className="k">{t.economy.titleWord}</em>
        </h1>
        <p className="mt-2 text-ink-2">{t.economy.intro}</p>
      </header>

      <form onSubmit={submit} noValidate className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="flex min-w-0 flex-col gap-6 p-4 sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field floating label={t.form.scorePerPoint} htmlFor="e-spp" hint={t.economy.scorePerPointHint} error={errors.scorePerPoint}>
              <Input id="e-spp" inputMode="numeric" value={scorePerPoint} aria-invalid={!!errors.scorePerPoint} onChange={(e) => setScorePerPoint(e.target.value)} />
            </Field>
            <Field floating label={t.form.maxPointsPerGame} htmlFor="e-mpg" hint={t.economy.maxPointsPerGameHint} error={errors.maxPointsPerGame}>
              <Input id="e-mpg" inputMode="numeric" value={maxPointsPerGame} aria-invalid={!!errors.maxPointsPerGame} onChange={(e) => setMaxPointsPerGame(e.target.value)} />
            </Field>
            <Field floating label={t.form.maxGamesPerDay} htmlFor="e-mgd" hint={t.economy.maxGamesPerDayHint} error={errors.maxGamesPerDay}>
              <Input id="e-mgd" inputMode="numeric" value={maxGamesPerDay} aria-invalid={!!errors.maxGamesPerDay} onChange={(e) => setMaxGamesPerDay(e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field floating label={t.economy.avgTicket} htmlFor="e-ticket" hint={t.economy.avgTicketHint} error={errors.avgTicket}>
              <Input id="e-ticket" inputMode="numeric" value={avgTicket} aria-invalid={!!errors.avgTicket} onChange={(e) => setAvgTicket(e.target.value)} />
            </Field>
          </div>
          <p className="text-sm text-ink-2">{t.economy.note}</p>
          {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
          <div>
            <Button type="submit" variant="primary" disabled={save.isPending}>
              {t.common.save}
            </Button>
          </div>
        </Card>

        <Card className="flex min-w-0 flex-col gap-3 p-4 sm:p-5 xl:sticky xl:top-8">
          <p className="flex items-center gap-2 font-display text-xl font-bold">
            <Coins size={20} aria-hidden className="text-reward" />
            {t.economy.previewTitle}
          </p>
          <p className="text-sm text-ink-2">{t.economy.previewScore(EXAMPLE_SCORE)}</p>
          <p className="font-mono text-2xl font-bold tabular-nums">
            {examplePoints > 0 ? t.economy.previewPoints(examplePoints) : t.economy.previewZero}
          </p>
          {isPositiveInt(values.maxPointsPerGame) && <p className="text-xs text-ink-2">{t.economy.previewCap(values.maxPointsPerGame)}</p>}
          {isPositiveInt(values.maxGamesPerDay) && <p className="text-xs text-ink-2">{t.economy.previewDaily(values.maxGamesPerDay)}</p>}
        </Card>
      </form>
    </div>
  );
}
