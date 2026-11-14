// The drop area for brand files, plus a "Choose file" button for keyboard users.
// It only hands over the files that were dropped or chosen. The step decides which ones are kept.
import { useId, useRef, useState, type DragEvent } from "react";
import { useLang } from "../../../i18n/LanguageContext";
import { UploadIcon } from "../../../ui/Icons";
import { allowedExtensions, MAX_FILE_MB, MAX_FILES } from "../studioOptions";

interface FileDropProps {
  onFiles: (files: File[]) => void;
  // the id of the list of problems, so a screen reader reads it with the button
  problemsId?: string;
}

export default function FileDrop({ onFiles, problemsId }: FileDropProps) {
  const { t } = useLang();
  const rulesId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    onFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`border-2 border-dashed p-8 text-center sm:p-12 ${dragOver ? "border-pod-wine bg-pod-wine/5" : "border-pod-wine/70"}`}
    >
      <UploadIcon size={28} className="mx-auto mb-3 text-ink-cacao/70" />
      <p className="font-spectral text-sm text-ink-cacao">{t("studio.dropText")}</p>
      <input
        ref={inputRef}
        id="brand-files"
        type="file"
        multiple
        accept={allowedExtensions.map((extension) => `.${extension}`).join(",")}
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-describedby={problemsId ? `${rulesId} ${problemsId}` : rulesId}
        className="mt-4 min-h-11 border border-ink-cacao px-6 py-2 font-sans text-sm font-medium text-ink-cacao hover:bg-ink-cacao hover:text-stone-paper"
      >
        {t("studio.chooseFile")}
      </button>
      <p id={rulesId} className="mt-3 font-sans text-xs text-ink-cacao/70">
        {t("studio.fileRules", { size: MAX_FILE_MB, max: MAX_FILES })}
      </p>
    </div>
  );
}
