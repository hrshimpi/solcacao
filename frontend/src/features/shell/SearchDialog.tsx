// The search box that opens from the header. It lists products whose name or origin country matches.
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { originName, searchProducts } from "../../data/products";
import { useLang } from "../../i18n/LanguageContext";
import Drawer from "../../ui/Drawer";
import LocaleLink from "../../ui/LocaleLink";

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SearchDialog({ open, onClose }: SearchDialogProps) {
  const { t, lang, path } = useLang();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const results = searchProducts(query, lang);

  function close() {
    setQuery("");
    onClose();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (results.length > 0) {
      navigate(path(`/shop/${results[0].slug}`));
      close();
    }
  }

  return (
    <Drawer open={open} onClose={close} title={t("search.title")} side="top" tone="light">
      <form onSubmit={submit} role="search" className="mx-auto w-full max-w-2xl px-6 py-5">
        <label htmlFor="site-search" className="block font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">
          {t("search.label")}
        </label>
        <input
          id="site-search"
          data-autofocus
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          placeholder={t("search.placeholder")}
          className="mt-1 block w-full border-b border-ink-cacao/60 bg-transparent py-2 font-spectral text-xl text-ink-cacao placeholder:text-ink-cacao/70"
        />
        <p role="status" className="mt-3 font-sans text-sm text-ink-cacao/70">
          {query.trim() ? t("search.results", { count: results.length }) : t("search.hint")}
        </p>
        {results.length > 0 && (
          <ul className="mt-2 divide-y divide-ink-cacao/15">
            {results.map((product) => (
              <li key={product.id}>
                <LocaleLink
                  to={`/shop/${product.slug}`}
                  onClick={close}
                  className="flex min-h-11 items-center justify-between gap-4 py-2 hover:text-pod-wine"
                >
                  <span className="font-spectral text-base font-semibold">{product.name}</span>
                  <span className="font-sans text-xs text-ink-cacao/70">{originName(product.origin, lang)}</span>
                </LocaleLink>
              </li>
            ))}
          </ul>
        )}
      </form>
    </Drawer>
  );
}
