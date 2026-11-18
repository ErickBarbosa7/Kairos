import { CircleHelp } from "lucide-react";
import { useState } from "react";
import { type HelpTopic, t } from "../strings";
import { Modal } from "./Modal";

/** Botón «?» que abre una explicación breve del módulo. Va junto al título. */
export function HelpHint({ topic }: { topic: HelpTopic }) {
  const [open, setOpen] = useState(false);
  const help = t.help[topic];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${t.help.button}: ${help.title}`}
        title={t.help.button}
        className="ml-2 inline-grid size-8 translate-y-[-0.1em] place-items-center align-middle text-ink-2 hover:text-link focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <CircleHelp size={22} aria-hidden />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={help.title} dismissible>
        <ul className="flex flex-col gap-3 text-sm leading-relaxed">
          {help.points.map((p) => (
            <li key={p} className="flex gap-2">
              <span aria-hidden className="text-link">•</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
