// Step 3 of the studio: the brand files. It is optional, but every file kept here has passed the file rules.
// A file that does not pass is not kept, and the person is told why.
import { useId, useState } from "react";
import { useLang } from "../../../i18n/LanguageContext";
import { useAnnounce } from "../../../ui/LiveRegion";
import { addBrandFiles, type FileProblem } from "../brandFiles";
import FileDrop from "../components/FileDrop";
import { formatSize, MAX_FILE_MB, MAX_FILES } from "../studioOptions";

interface AssetsStepProps {
  files: File[];
  onChange: (files: File[]) => void;
}

const problemKeys = {
  type: "errors.fileType",
  empty: "b2b.files.empty",
  size: "errors.fileSize",
  count: "b2b.files.tooMany",
} as const satisfies Record<FileProblem["reason"], string>;

export default function AssetsStep({ files, onChange }: AssetsStepProps) {
  const { t } = useLang();
  const announce = useAnnounce();
  const problemsId = useId();
  const [problems, setProblems] = useState<string[]>([]);

  function add(incoming: File[]) {
    const result = addBrandFiles(files, incoming);
    const messages = result.problems.map((problem) => t(problemKeys[problem.reason], { name: problem.name, size: MAX_FILE_MB, max: MAX_FILES }));
    const added = result.files.length - files.length;

    if (added > 0) onChange(result.files);
    setProblems(messages);
    announce([added > 0 ? t("studio.filesAdded", { count: added }) : "", ...messages].filter(Boolean).join(" "));
  }

  function remove(file: File) {
    onChange(files.filter((item) => item !== file));
    setProblems([]);
    announce(t("studio.fileRemoved", { name: file.name }));
  }

  return (
    <div>
      <FileDrop onFiles={add} problemsId={problems.length > 0 ? problemsId : undefined} />

      {problems.length > 0 && (
        <ul id={problemsId} className="mt-4 space-y-1 font-sans text-sm font-medium text-pod-wine">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <div className="mt-6 border-t border-ink-cacao/15 pt-4">
          <h3 className="mb-2 font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">
            {t("studio.selectedFiles")} <span className="normal-case tracking-normal">({t("b2b.files.counter", { used: files.length, max: MAX_FILES })})</span>
          </h3>
          <ul>
            {files.map((file) => (
              <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-4 border-b border-ink-cacao/10 py-1">
                <span className="min-w-0 break-words font-sans text-sm text-ink-cacao">
                  {file.name} <span className="text-ink-cacao/70">({formatSize(file.size)})</span>
                </span>
                <button
                  type="button"
                  onClick={() => remove(file)}
                  aria-label={t("studio.removeFile", { name: file.name })}
                  className="min-h-11 shrink-0 px-2 font-sans text-xs text-ink-cacao/70 underline underline-offset-4 hover:text-ink-cacao"
                >
                  {t("cart.remove")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
