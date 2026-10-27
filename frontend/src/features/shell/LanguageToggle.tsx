// The EN and ES buttons. The pressed one is the current language, and each button names its own language.
import { Fragment } from "react";
import { useLang } from "../../i18n/LanguageContext";
import type { Lang } from "../../i18n";

const options: { code: Lang; label: "common.english" | "common.spanish" }[] = [
  { code: "en", label: "common.english" },
  { code: "es", label: "common.spanish" },
];

export default function LanguageToggle() {
  const { lang, t, switchTo } = useLang();

  return (
    <div role="group" aria-label={t("common.languageGroup")} className="flex items-center font-sans text-xs">
      {options.map((option, index) => (
        <Fragment key={option.code}>
          {index > 0 && (
            <span aria-hidden="true" className="opacity-70">
              /
            </span>
          )}
          <button
            type="button"
            lang={option.code}
            aria-pressed={lang === option.code}
            aria-label={`${option.code.toUpperCase()}, ${t(option.label)}`}
            onClick={() => switchTo(option.code)}
            className={`flex min-h-11 min-w-11 items-center justify-center px-1 ${
              lang === option.code ? "font-semibold underline underline-offset-4" : "opacity-80 hover:opacity-100"
            }`}
          >
            {option.code.toUpperCase()}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
