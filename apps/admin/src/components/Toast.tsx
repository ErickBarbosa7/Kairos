import { CheckCircle2 } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from "react";

const Ctx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 4000);
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {msg && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-line bg-surface px-4 py-3 text-sm font-medium text-ink shadow-lg">
            <CheckCircle2 size={18} className="text-success" aria-hidden />
            {msg}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
