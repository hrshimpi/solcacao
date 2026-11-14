// The profile photo with its caption. While editing there is a button to pick a different photo from the device.
import { useEffect, useRef, useState } from "react";
import { useLang } from "../../../i18n/LanguageContext";
import { useAnnounce } from "../../../ui/LiveRegion";

const defaultPhoto =
  "https://images.unsplash.com/photo-1743807059766-9d3ca4f35b60?crop=faces&cs=tinysrgb&fit=crop&fm=jpg&h=900&q=85&w=720";

interface ProfilePhotoProps {
  name: string;
  email: string;
  editing: boolean;
}

export default function ProfilePhoto({ name, email, editing }: ProfilePhotoProps) {
  const { t } = useLang();
  const announce = useAnnounce();
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);
  const [photo, setPhoto] = useState(defaultPhoto);
  const [error, setError] = useState("");

  // free the temporary address of a picked photo when the page closes
  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  function pick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("profile.photoError"));
      return;
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);
    setPhoto(objectUrl.current);
    setError("");
    announce(t("profile.photoUpdated"));
  }

  return (
    <aside>
      <div className="relative aspect-[4/5] max-w-sm overflow-hidden bg-clay-surface">
        <img src={photo} alt={t("profile.photoAlt", { name })} className="h-full w-full object-cover grayscale-[15%]" />
        <div className="absolute bottom-0 left-0 bg-ink-cacao px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-paper-text">
          {t("profile.note")}
        </div>
      </div>

      {editing && (
        <div className="mt-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={(event) => {
              pick(event.target.files?.[0]);
              event.target.value = "";
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="min-h-11 font-sans text-sm text-pod-wine underline underline-offset-4 hover:text-ink-cacao"
          >
            {t("profile.photoAction")}
          </button>
          {error && (
            <p role="alert" className="font-sans text-sm font-medium text-pod-wine">
              {error}
            </p>
          )}
        </div>
      )}

      <div className="mt-7 border-t border-ink-cacao/20 pt-5">
        <p className="font-spectral text-2xl font-semibold text-ink-cacao">{name}</p>
        <p className="mt-1 break-words font-sans text-sm text-ink-cacao/70">{email}</p>
      </div>
    </aside>
  );
}
