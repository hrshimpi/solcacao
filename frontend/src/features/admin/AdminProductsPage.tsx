// The products of the shop for the team: the price, the stock and whether the product is in the shop, each with its own Save
// button. A product that is switched off is not in the shop, but its orders and its carts stay as they are.
import { useState } from "react";
import { fetchAdminProducts, setStock, updateProduct, type AdminProduct } from "../../api/admin";
import { formatPrice } from "../../i18n/format";
import { useLang } from "../../i18n/LanguageContext";
import { useAnnounce } from "../../ui/LiveRegion";
import LocaleLink from "../../ui/LocaleLink";
import { LoadState, useLoad } from "./useLoad";

interface Draft {
  price: string;
  stock: string;
  active: boolean;
}

const draftOf = (product: AdminProduct): Draft => ({ price: product.price.toFixed(2), stock: String(product.quantity), active: product.active });

function Row({ product, onSaved }: { product: AdminProduct; onSaved: (product: AdminProduct) => void }) {
  const { t, lang } = useLang();
  const announce = useAnnounce();
  const [draft, setDraft] = useState<Draft>(draftOf(product));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "saved" | "error"; text: string } | null>(null);

  const price = Number(draft.price);
  const stock = Number(draft.stock);
  const valid = draft.price.trim() !== "" && Number.isFinite(price) && price > 0 && /^\d+$/.test(draft.stock.trim()) && Number.isInteger(stock);
  const changed = draft.price !== product.price.toFixed(2) || draft.stock !== String(product.quantity) || draft.active !== product.active;

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      let latest = product;
      if (Math.round(price * 100) !== Math.round(product.price * 100) || draft.active !== product.active) {
        latest = await updateProduct(product.id, { price, active: draft.active }, { lang });
      }
      if (stock !== product.quantity) latest = await setStock(product.id, stock, { lang });
      onSaved(latest);
      setDraft(draftOf(latest));
      setMessage({ kind: "saved", text: t("admin.products.saved") });
      announce(`${latest.name}: ${t("admin.products.saved")}`);
    } catch {
      setMessage({ kind: "error", text: t("admin.products.saveError") });
    } finally {
      setBusy(false);
    }
  }

  const field = "w-24 border-b border-ink-cacao/60 bg-transparent py-1 font-sans text-sm text-ink-cacao focus:border-ink-cacao focus:outline-none";

  return (
    <tr className="border-b border-ink-cacao/15 align-top">
      <th scope="row" className="py-4 pr-4 text-left font-normal">
        <div className="flex gap-3">
          {product.thumbnail && <img src={product.thumbnail} alt="" width={40} height={50} loading="lazy" className="h-[50px] w-10 shrink-0 object-cover" />}
          <div>
            <p className="font-medium text-ink-cacao">{product.name}</p>
            <p className="font-sans text-xs text-ink-cacao/70">{product.sku} · {product.originName}</p>
            {product.quantity === 0 ? <p className="mt-1 text-xs font-medium text-pod-wine">{t("admin.products.soldOut")}</p> : product.quantity <= product.lowStockThreshold ? <p className="mt-1 text-xs font-medium text-gold-deep">{t("admin.products.low")}</p> : null}
          </div>
        </div>
      </th>
      <td className="py-4 pr-4">
        <input aria-label={t("admin.products.priceFor", { name: product.name })} inputMode="decimal" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} className={field} />
        <p className="mt-1 text-[11px] text-ink-cacao/60">{formatPrice(product.price, lang)}</p>
      </td>
      <td className="py-4 pr-4">
        <input aria-label={t("admin.products.stockFor", { name: product.name })} inputMode="numeric" value={draft.stock} onChange={(event) => setDraft({ ...draft, stock: event.target.value })} className={field} />
      </td>
      <td className="py-4 pr-4">
        <input type="checkbox" aria-label={t("admin.products.shownFor", { name: product.name })} checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} className="h-5 w-5 accent-pod-wine" />
      </td>
      <td className="py-4">
        <button type="button" onClick={() => void save()} disabled={!changed || !valid || busy} className="min-h-11 border border-ink-cacao px-4 py-2 font-sans text-xs font-medium text-ink-cacao hover:bg-clay-surface disabled:opacity-40">
          {t("admin.products.save")}
        </button>
        {message && (
          <p role={message.kind === "error" ? "alert" : "status"} className={`mt-1 text-xs ${message.kind === "error" ? "text-pod-wine" : "text-canopy-green"}`}>
            {message.text}
          </p>
        )}
      </td>
    </tr>
  );
}

export default function AdminProductsPage() {
  const { t, lang } = useLang();
  const { load, reload, setData } = useLoad((signal) => fetchAdminProducts({ lang, signal }), [lang]);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <p role="status" className="font-sans text-xs text-ink-cacao/70">
          {load.status === "ready" ? t("admin.products.count", { count: load.data.total }) : ""}
        </p>
        <LocaleLink to="/admin/products/new" className="inline-flex min-h-11 items-center bg-sun-gold px-6 py-2 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90">
          {t("admin.products.add")}
        </LocaleLink>
      </div>

      <LoadState load={load} reload={reload}>
        {({ items, total }) =>
          items.length === 0 ? (
            <p className="border border-ink-cacao/30 p-6 font-spectral text-ink-cacao">{t("admin.products.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-left font-sans text-sm text-ink-cacao">
                <thead>
                  <tr className="border-b border-ink-cacao text-[11px] uppercase tracking-widest text-ink-cacao/70">
                    <th scope="col" className="py-3 pr-4 font-normal">{t("admin.products.product")}</th>
                    <th scope="col" className="py-3 pr-4 font-normal">{t("admin.products.price")}</th>
                    <th scope="col" className="py-3 pr-4 font-normal">{t("admin.products.stock")}</th>
                    <th scope="col" className="py-3 pr-4 font-normal">{t("admin.products.shown")}</th>
                    <th scope="col" className="py-3 font-normal"><span className="sr-only">{t("admin.products.save")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((product) => (
                    <Row key={product.id} product={product} onSaved={(saved) => setData({ items: items.map((item) => (item.id === saved.id ? saved : item)), total })} />
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </LoadState>
    </div>
  );
}
