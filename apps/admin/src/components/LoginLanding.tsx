import { type LucideIcon, Download, Gamepad2, LayoutDashboard, Lock, MonitorDown, Play, Wallet } from "lucide-react";
import { useLottie } from "lottie-react";
import arrow from "../assets/arrow.json";
import { t } from "../strings";
import { usePlans } from "../api/plans";
import { PlanTiers } from "./PlanTiers";
import { cx } from "./ui";

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Flecha animada junto al título. Con "reducir movimiento" se queda en su primer fotograma. */
function ArrowIcon({ className }: { className?: string }) {
  const { View } = useLottie({
    animationData: arrow,
    loop: true,
    autoplay: !reduceMotion(),
    rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
  });
  return (
    <div aria-hidden className={cx("arrow-lottie size-8", className)}>
      {View}
    </div>
  );
}

const ctaButton =
  "inline-flex min-h-12 items-center justify-center rounded-md border-2 border-on-primary bg-canvas px-8 font-display text-lg font-bold uppercase tracking-wide text-ink shadow-hard transition-[transform,box-shadow] duration-100 hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-none";

const HOW_ICONS: LucideIcon[] = [Gamepad2, Wallet, LayoutDashboard];

const WINDOWS_DOWNLOAD_URL = import.meta.env.VITE_ARCADE_WINDOWS_URL?.trim();
const LINUX_DOWNLOAD_URL = import.meta.env.VITE_ARCADE_LINUX_URL?.trim();
const TABLET_ARCADE_URL = import.meta.env.VITE_ARCADE_WEB_URL?.trim();
const DEMO_VIDEO_URL = import.meta.env.VITE_ARCADE_DEMO_URL?.trim() || "/arcade/kairos-arcade-demo.mp4";
const DEMO_POSTER_URL = import.meta.env.VITE_ARCADE_DEMO_POSTER_URL?.trim() || "/arcade/kairos-arcade-demo-poster.webp";

function Eyebrow({ children, className }: { children: string; className?: string }) {
  return <p className={cx("mb-2 text-sm font-bold uppercase tracking-widest", className ?? "text-primary")}>{children}</p>;
}

function ArcadeDownload({ href, label, pending }: { href?: string; label: string; pending: string }) {
  if (!href) {
    return (
      <span aria-disabled="true" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border-2 border-paper/35 px-5 font-display text-base font-bold uppercase tracking-wide text-paper/60">
        <Download size={19} aria-hidden />
        {pending}
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border-2 border-reward bg-reward px-5 font-display text-base font-bold uppercase tracking-wide text-night shadow-[4px_4px_0_0_var(--kairos-paper)] transition-transform duration-100 hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
      <Download size={19} aria-hidden />
      {label}
    </a>
  );
}

function ArcadePreview() {
  if (DEMO_VIDEO_URL) {
    return (
      <video aria-label={t.landing.arcade.videoLabel} className="aspect-video w-full border-2 border-paper object-cover" controls muted playsInline preload="metadata" poster={DEMO_POSTER_URL}>
        <source src={DEMO_VIDEO_URL} />
      </video>
    );
  }
  return (
    <div aria-label={t.landing.arcade.previewLabel} className="relative aspect-video overflow-hidden border-2 border-paper bg-night p-4 sm:p-6">
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(color-mix(in_srgb,var(--kairos-paper)_9%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--kairos-paper)_9%,transparent)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b-2 border-paper/30 pb-3 font-display text-sm font-bold uppercase tracking-wide text-paper sm:text-base">
          <span>{t.landing.arcade.previewTitle}</span>
          <span className="inline-flex items-center gap-1.5 text-reward"><span className="size-2 rounded-full bg-success" />{t.landing.arcade.previewStatus}</span>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 py-4 sm:grid-cols-3 sm:gap-3">
          {t.landing.arcade.games.map((game, index) => (
            <div key={game} className="flex min-h-0 flex-col justify-end border-2 border-paper/35 bg-paper/8 p-2 shadow-[3px_3px_0_0_var(--kairos-primary)] sm:p-3">
              <span className={cx("mb-auto size-7 border-2 border-paper/80 sm:size-9", index % 3 === 0 ? "bg-primary" : index % 3 === 1 ? "bg-reward" : "bg-success")} aria-hidden />
              <span className="font-display text-sm font-bold uppercase leading-none text-paper sm:text-base">{game}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 border-t-2 border-paper/30 pt-3 font-display text-sm font-bold uppercase tracking-wide text-reward">
          <Play size={18} fill="currentColor" aria-hidden />
          <span>{t.landing.arcade.videoUnavailable}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Información debajo del formulario de login, para quien baja a conocer Kairos.
 * Cada bloque tiene su propio aspecto para que no se lea como una sola lista de tarjetas:
 * tarjetas con ícono, un recorrido numerado, una banda oscura para suscripciones y un cierre.
 */
export default function LoginLanding({ onStartTrial }: { onStartTrial?: () => void }) {
  const { data: catalog } = usePlans();
  function scrollToLogin() {
    const form = document.getElementById("login");
    if (!form) return;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    // El foco va al primer campo, para poder escribir sin tocar nada.
    window.setTimeout(() => (document.getElementById("slug") ?? document.getElementById("email"))?.focus({ preventScroll: true }), 400);
  }

  return (
    <>
      {/* 1. Cómo funciona: tres piezas de la plataforma, en tarjetas con ícono. */}
      <section id="como-funciona" aria-labelledby="how-title" className="scroll-mt-4 px-4 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-8 flex items-center gap-3">
            <h2 id="how-title" className="font-display text-4xl font-black uppercase tracking-wide sm:text-5xl">
              {t.landing.howTitle}
            </h2>
            <ArrowIcon className="mt-2 size-9" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {t.landing.how.map((item, i) => {
              const Icon = HOW_ICONS[i] ?? Gamepad2;
              return (
                <article key={item.title} className="flex flex-col gap-4 rounded-md border-2 border-ink bg-surface p-6 shadow-hard">
                  <span className="inline-flex size-14 items-center justify-center rounded-md bg-primary text-on-primary">
                    <Icon size={28} aria-hidden />
                  </span>
                  <h3 className="font-display text-2xl font-black">{item.title}</h3>
                  <p className="leading-relaxed text-ink-2">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. Terminal Arcade: descarga empresarial y demo, antes de explicar el alta. */}
      <section id="arcade" aria-labelledby="arcade-title" className="scroll-mt-4 border-y-2 border-line bg-night px-4 py-16 text-paper sm:px-8 lg:px-12">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <Eyebrow className="text-reward">{t.landing.arcade.label}</Eyebrow>
            <h2 id="arcade-title" className="max-w-xl font-display text-4xl font-black uppercase tracking-wide sm:text-5xl">
              {t.landing.arcade.title}
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-paper/80">{t.landing.arcade.body}</p>
            <ul className="mt-7 space-y-3">
              {t.landing.arcade.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-paper">
                  <MonitorDown size={21} aria-hidden className="mt-0.5 shrink-0 text-reward" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <div className="mt-9 flex flex-wrap gap-3">
              <ArcadeDownload href={TABLET_ARCADE_URL} label={t.landing.arcade.tablet} pending={t.landing.arcade.tablet} />
              <ArcadeDownload href={WINDOWS_DOWNLOAD_URL} label={t.landing.arcade.windows} pending={t.landing.arcade.windowsPending} />
              <ArcadeDownload href={LINUX_DOWNLOAD_URL} label={t.landing.arcade.linux} pending={t.landing.arcade.linuxPending} />
            </div>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-paper/65">{t.landing.arcade.downloadNote}</p>
          </div>
          <ArcadePreview />
        </div>
      </section>

      {/* 3. {t.landing.stepsTitle}: recorrido numerado, sin cajas. */}
      <section aria-labelledby="steps-title" className="border-t-2 border-line px-4 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-6xl">
          <h2 id="steps-title" className="mb-10 font-display text-4xl font-black uppercase tracking-wide sm:text-5xl">
            {t.landing.stepsTitle}
          </h2>
          <ol className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
            {t.landing.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-5 border-b-2 border-dashed border-line pb-6">
                <span aria-hidden className="font-display text-6xl font-black leading-none text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="pt-2 text-lg leading-snug text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. {t.landing.subs.title} {t.landing.subs.titleWord}: banda oscura fija (no se invierte con el tema) con los {t.landing.subs.titleWord} y qué pasa si se suspende. */}
      <section aria-labelledby="subs-title" className="bg-night px-4 py-16 text-paper sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-6xl">
          <h2 id="subs-title" className="font-display text-4xl font-black uppercase tracking-wide sm:text-5xl">
            {t.landing.subs.title} <em className="k text-reward">{t.landing.subs.titleWord}</em>
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-paper/80">{t.landing.subs.intro}</p>
          <div className="mt-10">
            <PlanTiers
              tone="dark"
              highlight="TRIAL"
              tag={t.landing.subs.startHere}
              catalog={catalog}
              action={(plan) =>
                plan === "TRIAL" && onStartTrial ? (
                  <button
                    type="button"
                    onClick={onStartTrial}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-md border-2 border-reward bg-reward px-4 font-display text-lg font-bold uppercase tracking-wide text-night hover:brightness-110"
                  >
                    {t.landing.trialAction}
                  </button>
                ) : null
              }
            />
          </div>
          <div className="mt-6 flex items-start gap-4 border-l-4 border-reward bg-paper/10 p-5">
            <Lock size={26} aria-hidden className="mt-0.5 shrink-0 text-reward" />
            <p className="max-w-3xl leading-relaxed">{t.landing.subs.logic}</p>
          </div>
          <p className="mt-4 text-sm text-paper/70">{t.landing.subs.note}</p>
        </div>
      </section>

      {/* 5. Cierre: lleva de vuelta al formulario. */}
      <section aria-label={t.landing.cta} className="bg-primary px-4 py-16 text-center text-on-primary sm:px-8 lg:px-12">
        <h2 className="font-display text-4xl font-black uppercase tracking-wide sm:text-5xl">{t.landing.cta}</h2>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {onStartTrial && (
            <button type="button" onClick={onStartTrial} className={ctaButton}>
              {t.landing.trialAction}
            </button>
          )}
          <button type="button" onClick={scrollToLogin} className={ctaButton}>
            {t.landing.action}
          </button>
        </div>
      </section>
    </>
  );
}
