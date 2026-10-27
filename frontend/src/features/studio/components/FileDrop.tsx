// The brand file upload: a drop area plus a "Choose file" button for keyboard users.
// Only PDF, AI and PNG files up to the size limit are accepted. Nothing is really sent anywhere yet.
import { useRef, useState, type DragEvent } from "react";
import { useLang } from "../../../i18n/LanguageContext";
import { useAnnounce } from "../../../ui/LiveRegion";
import { UploadIcon } from "../../../ui/Icons";
import { allowedExtensions, formatSize, MAX_FILE_MB, type StudioFile } from "../studioOptions";

interface FileDropProps {
  files: StudioFile[];
  onChange: (files: StudioFile[]) => void;
}

export default function FileDrop({ files, onChange }: FileDropProps) {
  const { t } = useLang();
  const announce = useAnnounce();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    const messages: string[] = [];
    let added = 0;

    for (const file of Array.from(list)) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!allowedExtensions.includes(extension)) {
        messages.push(t("errors.fileType", { name: file.name }));
      } else if (file.size > MAX_FILE_MB * 1024 * 1024) {
        messages.push(t("errors.fileSize", { name: file.name, size: MAX_FILE_MB }));
      } else if (!next.some((item) => item.name === file.name && item.size === file.size)) {
        next.push({ name: file.name, size: file.size });
        added += 1;
      }
    }

    onChange(next);
    setProblems(messages);
    if (added > 0) announce(t("studio.filesAdded", { count: added }));
    if (messages.length > 0) announce(messages[0]);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    addFiles(event.dataTransfer.files);
  }

  function remove(file: StudioFile) {
    onChange(files.filter((item) => item !== file));
    announce(t("studio.fileRemoved", { name: file.name }));
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed p-8 text-center sm:p-12 ${
          dragOver ? "border-pod-wine bg-pod-wine/5" : "border-pod-wine/70"
        }`}
      >
        <UploadIcon size={28} className="mx-auto mb-3 text-ink-cacao/70" />
        <p className="font-spectral text-sm text-ink-cacao">{t("studio.dropText")}</p>
        <input
          ref={inputRef}
          id="brand-files"
          type="file"
          multiple
          accept=".pdf,.ai,.png"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-4 min-h-11 border border-ink-cacao px-6 py-2 font-sans text-sm font-medium text-ink-cacao hover:bg-ink-cacao hover:text-stone-paper"
        >
          {t("studio.chooseFile")}
        </button>
        <p className="mt-3 font-sans text-xs text-ink-cacao/70">{t("studio.fileRules", { size: MAX_FILE_MB })}</p>
      </div>

      {problems.length > 0 && (
        <ul className="mt-4 space-y-1 font-sans text-sm font-medium text-pod-wine">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <div className="mt-6 border-t border-ink-cacao/15 pt-4">
          <h3 className="mb-2 font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">{t("studio.selectedFiles")}</h3>
          <ul>
            {files.map((file) => (
              <li key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-4 border-b border-ink-cacao/10 py-1">
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
