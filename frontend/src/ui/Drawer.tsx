// A modal dialog that slides in from the side or top. It traps focus, closes on Escape,
// locks page scroll and gives focus back to the button that opened it.
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLang } from "../i18n/LanguageContext";
import { CloseIcon } from "./Icons";

const focusable =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "left" | "right" | "top";
  tone?: "dark" | "light";
  children: ReactNode;
}

const placement = {
  right: "right-0 top-0 h-full w-[min(20rem,100vw)] slide-in-right",
  left: "left-0 top-0 h-full w-[min(20rem,100vw)] slide-in-left",
  top: "left-0 top-0 w-full max-h-[100dvh] slide-in-top",
};

export default function Drawer({ open, onClose, title, side = "right", tone = "dark", children }: DrawerProps) {
  const { t } = useLang();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const root = document.getElementById("root");
    document.body.style.overflow = "hidden";
    root?.setAttribute("inert", "");

    const isShown = (el: HTMLElement) => {
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    };
    const items = () => Array.from(panel.querySelectorAll<HTMLElement>(focusable)).filter(isShown);

    const start = panel.querySelector<HTMLElement>("[data-autofocus]") ?? items()[0] ?? panel;
    start.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const list = items();
      if (list.length === 0) {
        event.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      root?.removeAttribute("inert");
      opener?.focus();
    };
  }, [open]);

  if (!open) return null;

  const dark = tone === "dark";

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-ink-cacao/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`absolute flex flex-col overflow-y-auto ${placement[side]} ${
          dark ? "bg-ink-cacao text-paper-text on-dark" : "bg-stone-paper text-ink-cacao"
        }`}
      >
        <div
          className={`flex items-center justify-between px-6 py-3 border-b ${
            dark ? "border-paper-text/20" : "border-ink-cacao/20"
          }`}
        >
          <h2 id={titleId} className="font-spectral text-lg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-11 w-11 items-center justify-center -mr-3"
          >
            <CloseIcon size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
