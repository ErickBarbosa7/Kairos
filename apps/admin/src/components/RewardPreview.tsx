import { EyeOff, Gift } from "lucide-react";
import { t } from "../strings";

interface Props {
  title: string;
  description: string;
  imageUrl: string | null;
  pointsCost: string;
  stock: string;
  isActive: boolean;
}

export function RewardPreview({ title, description, imageUrl, pointsCost, stock, isActive }: Props) {
  const soldOut = stock !== "" && Number(stock) === 0;
  const cost = Number(pointsCost);

  return (
    <section aria-labelledby="reward-preview-title" className="flex flex-col gap-2">
      <h3 id="reward-preview-title" className="text-xs font-semibold text-ink-2">{t.rewards.previewTitle}</h3>
      <div className={`overflow-hidden rounded-md border-2 border-line bg-canvas ${isActive ? "" : "opacity-60"}`}>
        <div className={`grid aspect-[16/9] place-items-center bg-surface ${isActive ? "" : "grayscale"}`}>
          {imageUrl ? <img src={imageUrl} alt="" className="size-full object-cover" /> : <Gift size={32} className="text-ink-3" aria-hidden />}
        </div>
        <div className="flex flex-col gap-2 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 flex-1 break-words font-display text-base font-bold leading-tight">{title.trim() || t.rewards.name}</p>
            <span className="shrink-0 rounded-md bg-reward/20 px-2 py-0.5 font-mono text-xs font-medium tabular-nums">
              {Number.isInteger(cost) && cost > 0 ? cost : "—"} {t.rewards.pts}
            </span>
          </div>
          {description.trim() && <p className="break-words text-xs text-ink-2">{description}</p>}
          {soldOut && <p className="text-xs font-semibold text-ink-2">{t.rewards.soldOut}</p>}
        </div>
      </div>
      {!isActive && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
          <EyeOff size={14} aria-hidden /> {t.rewards.statusHidden}
        </p>
      )}
    </section>
  );
}
