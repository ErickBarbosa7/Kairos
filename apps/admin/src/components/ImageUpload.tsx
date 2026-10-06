import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { uploadImage } from "../api/tenantPanel";
import { t } from "../strings";
import { Button, cx } from "./ui";

const TYPES = ["image/png", "image/jpeg", "image/webp"];

interface Props {
  value: string | null;
  onChange(url: string | null): void;
  label: string;
  hint?: string;
  shape?: "square" | "wide";
}

export function ImageUpload({ value, onChange, label, hint, shape = "square" }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!TYPES.includes(file.type)) return setError(t.upload.badType);
    if (file.size > 1024 * 1024) return setError(t.upload.tooBig);
    setBusy(true);
    try {
      onChange(await uploadImage(file));
    } catch {
      setError(t.upload.failed);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-4">
        <div
          className={cx(
            "grid shrink-0 place-items-center overflow-hidden rounded-md border border-dashed border-line bg-canvas",
            shape === "square" ? "size-24" : "h-24 w-40",
          )}
        >
          {value ? (
            <img src={value} alt="" className="size-full object-contain" />
          ) : (
            <ImagePlus size={28} className="text-ink-3" aria-hidden />
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <input
            ref={input}
            type="file"
            accept={TYPES.join(",")}
            className="sr-only"
            aria-label={label}
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => input.current?.click()} disabled={busy}>
              {busy ? t.upload.uploading : value ? t.brand.replace : t.brand.upload}
            </Button>
            {value && !busy && (
              <Button type="button" variant="ghost" onClick={() => onChange(null)}>
                <Trash2 size={16} aria-hidden /> {t.brand.remove}
              </Button>
            )}
          </div>
          {hint && <p className="text-xs text-ink-2">{hint}</p>}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
