// The progress strip of the wizard: an ordered list on wider screens, one line of text on phones.
import { useLang } from "../../../i18n/LanguageContext";
import { CheckIcon } from "../../../ui/Icons";

interface WizardStepsProps {
  names: string[];
  shortNames: string[];
  current: number;
  onGoTo: (step: number) => void;
}

export default function WizardSteps({ names, shortNames, current, onGoTo }: WizardStepsProps) {
  const { t } = useLang();

  return (
    <div>
      <p className="py-4 font-sans text-sm font-medium text-ink-cacao sm:hidden">
        {t("studio.stepOf", { current: current + 1, total: names.length, name: shortNames[current] })}
      </p>
      <ol aria-label={t("studio.progress")} className="hidden sm:flex">
        {names.map((name, index) => {
          const done = index < current;
          const active = index === current;
          const box = `flex flex-1 min-w-0 flex-col justify-center border-y border-l px-4 py-4 text-left last:border-r ${
            done
              ? "border-pod-wine bg-pod-wine text-paper-text"
              : active
                ? "border-2 border-sun-gold bg-stone-paper text-ink-cacao"
                : "border-ink-cacao/60 bg-stone-paper text-ink-cacao/70"
          }`;
          const inner = (
            <>
              <span className="mb-1 flex items-center gap-1.5 font-mono text-[11px]">
                {String(index + 1).padStart(2, "0")}
                {done && <CheckIcon size={12} />}
              </span>
              <span className={`font-sans text-xs leading-tight ${active ? "font-medium" : ""}`}>{name}</span>
            </>
          );
          return (
            <li key={name} aria-current={active ? "step" : undefined} className="flex flex-1 min-w-0">
              {done ? (
                <button type="button" onClick={() => onGoTo(index)} className={box}>
                  {inner}
                </button>
              ) : (
                <div className={box}>{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
