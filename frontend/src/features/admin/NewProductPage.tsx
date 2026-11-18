// The form to add a product to the shop. The texts are written in English and in Spanish, and the product is in the shop as soon
// as it is saved (the server checks everything again, and a problem it names is shown on its field). The photo is a web address
// or a photo of the site, like the ones in the folder public/sample-chocolates.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { createProduct, type NewProductBody } from "../../api/admin";
import { categoryIds, noteIds, type Category, type NoteId } from "../../api/products";
import { useLang } from "../../i18n/LanguageContext";
import { ApiError } from "../../lib/apiFetch";
import { useForm } from "../../lib/useForm";
import { imageUrl, maxLength, maxNumber, minNumber, month, price, required, sku, slug, wholeNumber } from "../../lib/validation";
import { useAnnounce } from "../../ui/LiveRegion";
import LocaleLink from "../../ui/LocaleLink";
import TextField from "../../ui/TextField";

const origins = ["ecuador", "peru", "venezuela", "colombia", "madagascar"] as const;
type Origin = (typeof origins)[number];

// the name of the country in both languages, so the form asks for it once
const originNames: Record<Origin, { en: string; es: string }> = {
  ecuador: { en: "Ecuador", es: "Ecuador" },
  peru: { en: "Peru", es: "Perú" },
  venezuela: { en: "Venezuela", es: "Venezuela" },
  colombia: { en: "Colombia", es: "Colombia" },
  madagascar: { en: "Madagascar", es: "Madagascar" },
};

// the photos that come with the project (public/sample-chocolates), offered while typing
const samplePhotos = ["cacao-assortment-box", "roasted-cacao-nibs", "milk-almond-bar", "raw-cacao-beans", "ecuador-72", "peru-68", "venezuela-76", "colombia-64", "madagascar-80", "midnight-truffle", "fleur-de-sel-bar"].map((name) => `/sample-chocolates/${name}.jpg`);

const initial = {
  slug: "",
  sku: "",
  percentage: "",
  price: "",
  quantity: "",
  nameEn: "",
  nameEs: "",
  captionEn: "",
  captionEs: "",
  tastingSummaryEn: "",
  tastingSummaryEs: "",
  farmEn: "",
  farmEs: "",
  descriptionEn: "",
  descriptionEs: "",
  imageAltEn: "",
  imageAltEs: "",
  image: "",
  batchCode: "",
  harvestMonth: "",
  roastMonth: "",
};
type Field = keyof typeof initial;

// "name.en" is the field nameEn
const fieldOf = (serverField: string): Field | undefined => {
  const key = serverField.replace(/^images?(\.\d+)?$/, "image").replace(/^thumbnail$/, "image").replace(/\.(\w)/g, (_, letter: string) => letter.toUpperCase());
  return key in initial ? (key as Field) : undefined;
};

const select = "mt-1 block min-h-11 w-full border-b border-ink-cacao/60 bg-transparent py-2 font-sans text-sm text-ink-cacao focus:border-ink-cacao focus:outline-none";
const selectLabel = "block font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70";

export default function NewProductPage() {
  const { t, lang, path } = useLang();
  const navigate = useNavigate();
  const announce = useAnnounce();
  const [origin, setOrigin] = useState<Origin>("ecuador");
  const [category, setCategory] = useState<Category>("bar");
  const [notes, setNotes] = useState<NoteId[]>([]);
  const [featured, setFeatured] = useState(false);
  const [problem, setProblem] = useState("");
  const problemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (problem) problemRef.current?.focus();
  }, [problem]);

  const form = useForm<Field>({
    initial,
    rules: {
      slug: [required, slug, maxLength(80)],
      sku: [required, sku, maxLength(40)],
      percentage: [required, wholeNumber, minNumber(1), maxNumber(100)],
      price: [required, price],
      quantity: [required, wholeNumber, maxNumber(1_000_000)],
      nameEn: [required, maxLength(80)],
      nameEs: [required, maxLength(80)],
      captionEn: [required, maxLength(120)],
      captionEs: [required, maxLength(120)],
      tastingSummaryEn: [required, maxLength(160)],
      tastingSummaryEs: [required, maxLength(160)],
      farmEn: [required, maxLength(120)],
      farmEs: [required, maxLength(120)],
      descriptionEn: [required, maxLength(2000)],
      descriptionEs: [required, maxLength(2000)],
      imageAltEn: [required, maxLength(200)],
      imageAltEs: [required, maxLength(200)],
      image: [required, imageUrl, maxLength(500)],
      batchCode: [required, maxLength(40)],
      harvestMonth: [required, month],
      roastMonth: [required, month],
    },
    onSubmit: async (values) => {
      setProblem("");
      const pair = (name: "name" | "caption" | "tastingSummary" | "farm" | "description" | "imageAlt") => ({ en: values[`${name}En`].trim(), es: values[`${name}Es`].trim() });
      const body: NewProductBody = {
        slug: values.slug.trim().toLowerCase(),
        sku: values.sku.trim().toUpperCase(),
        name: pair("name"),
        caption: pair("caption"),
        tastingSummary: pair("tastingSummary"),
        imageAlt: pair("imageAlt"),
        farm: pair("farm"),
        description: pair("description"),
        origin,
        originName: originNames[origin],
        percentage: Number(values.percentage),
        category,
        price: Math.round(Number(values.price) * 100),
        notes,
        thumbnail: values.image.trim(),
        images: [values.image.trim()],
        batchCode: values.batchCode.trim(),
        harvestMonth: values.harvestMonth.trim(),
        roastMonth: values.roastMonth.trim(),
        featured,
        quantity: Number(values.quantity),
      };

      try {
        const made = await createProduct(body, { lang });
        announce(t("admin.products.form.done", { name: made.name }));
        navigate(path("/admin/products"));
      } catch (error) {
        const fields: Partial<Record<Field, string>> = {};
        if (error instanceof ApiError && error.code === "SLUG_TAKEN") fields.slug = t("admin.products.form.slugTaken");
        else if (error instanceof ApiError && error.code === "SKU_TAKEN") fields.sku = t("admin.products.form.skuTaken");
        else if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
          for (const detail of error.details) {
            const name = detail.field ? fieldOf(detail.field) : undefined;
            if (name && !fields[name]) fields[name] = t("errors.required");
          }
        }
        if (Object.keys(fields).length > 0) form.setFieldErrors(fields);
        else setProblem(t("admin.products.form.problem"));
      }
    },
  });

  const text = (name: Field, label: string, extra: { multiline?: boolean; hint?: string; placeholder?: string } = {}) => (
    <TextField label={label} required {...extra} rows={extra.multiline ? 5 : undefined} {...form.field(name)} />
  );
  const both = (name: "name" | "caption" | "tastingSummary" | "farm" | "description" | "imageAlt", multiline = false) => (
    <div className="grid gap-6 md:grid-cols-2">
      {text(`${name}En`, `${t(`admin.products.form.${name}`)} (${t("admin.products.form.english")})`, { multiline })}
      {text(`${name}Es`, `${t(`admin.products.form.${name}`)} (${t("admin.products.form.spanish")})`, { multiline })}
    </div>
  );

  const heading = "mb-6 border-b border-ink-cacao pb-3 font-spectral text-2xl font-semibold text-ink-cacao";
  const image = form.field("image");

  return (
    <div className="max-w-4xl">
      <LocaleLink to="/admin/products" className="mb-6 inline-flex min-h-11 items-center font-sans text-sm text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
        {t("admin.products.form.back")}
      </LocaleLink>
      <h2 className="font-spectral text-3xl font-semibold text-ink-cacao">{t("admin.products.form.title")}</h2>
      <p className="mb-10 mt-2 max-w-xl font-spectral text-ink-cacao/70">{t("admin.products.form.intro")}</p>

      <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate aria-busy={form.submitting} className="space-y-14">
        {problem && (
          <div ref={problemRef} role="alert" tabIndex={-1} className="border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
            {problem}
          </div>
        )}
        <p className="font-sans text-xs text-ink-cacao/70">{t("common.requiredNote")}</p>

        <section aria-labelledby="new-product-basics">
          <h3 id="new-product-basics" className={heading}>{t("admin.products.form.sectionBasics")}</h3>
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {text("slug", t("admin.products.form.slug"), { hint: t("admin.products.form.slugHint"), placeholder: "peru-85" })}
              {text("sku", t("admin.products.form.sku"), { hint: t("admin.products.form.skuHint"), placeholder: "SC-PER-085" })}
            </div>
            {both("name")}
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label htmlFor="new-product-origin" className={selectLabel}>{t("admin.products.form.origin")}</label>
                <select id="new-product-origin" value={origin} onChange={(event) => setOrigin(event.target.value as Origin)} className={select}>
                  {origins.map((value) => (
                    <option key={value} value={value}>{t(`admin.products.origins.${value}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="new-product-category" className={selectLabel}>{t("admin.products.form.category")}</label>
                <select id="new-product-category" value={category} onChange={(event) => setCategory(event.target.value as Category)} className={select}>
                  {categoryIds.map((value) => (
                    <option key={value} value={value}>{t(`admin.products.categories.${value}`)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {text("percentage", t("admin.products.form.percentage"), { placeholder: "72" })}
              {text("price", t("admin.products.form.price"), { placeholder: "12.50" })}
              {text("quantity", t("admin.products.form.quantity"), { placeholder: "40" })}
            </div>
          </div>
        </section>

        <section aria-labelledby="new-product-texts">
          <h3 id="new-product-texts" className={heading}>{t("admin.products.form.sectionTexts")}</h3>
          <div className="space-y-6">
            {both("caption")}
            {both("tastingSummary")}
            {both("farm")}
            {both("description", true)}
          </div>
        </section>

        <section aria-labelledby="new-product-photo">
          <h3 id="new-product-photo" className={heading}>{t("admin.products.form.sectionPhoto")}</h3>
          <div className="grid gap-6 md:grid-cols-[1fr_auto]">
            <div className="space-y-6">
              <TextField label={t("admin.products.form.thumbnail")} required hint={t("admin.products.form.thumbnailHint")} list="sample-photos" placeholder="/sample-chocolates/milk-almond-bar.jpg" {...image} />
              <datalist id="sample-photos">
                {samplePhotos.map((photo) => (
                  <option key={photo} value={photo} />
                ))}
              </datalist>
              {both("imageAlt")}
            </div>
            {/^(https:\/\/|\/)\S+$/.test(image.value.trim()) && <img src={image.value.trim()} alt="" width={120} height={150} className="h-[150px] w-[120px] object-cover" />}
          </div>
        </section>

        <section aria-labelledby="new-product-details">
          <h3 id="new-product-details" className={heading}>{t("admin.products.form.sectionDetails")}</h3>
          <div className="space-y-6">
            <fieldset>
              <legend className={selectLabel}>{t("admin.products.form.notes")}</legend>
              <div className="mt-2 flex flex-wrap gap-x-6">
                {noteIds.map((note) => (
                  <label key={note} className="flex min-h-11 cursor-pointer items-center gap-2 font-sans text-sm text-ink-cacao">
                    <input type="checkbox" checked={notes.includes(note)} onChange={(event) => setNotes(event.target.checked ? [...notes, note] : notes.filter((entry) => entry !== note))} className="h-4 w-4 accent-pod-wine" />
                    {t(`admin.products.notesList.${note}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-6 md:grid-cols-3">
              {text("batchCode", t("admin.products.form.batchCode"), { placeholder: "PER-2024-09" })}
              {text("harvestMonth", t("admin.products.form.harvestMonth"), { hint: t("admin.products.form.monthHint"), placeholder: "2024-09" })}
              {text("roastMonth", t("admin.products.form.roastMonth"), { hint: t("admin.products.form.monthHint"), placeholder: "2024-10" })}
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 font-sans text-sm text-ink-cacao">
              <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} className="h-4 w-4 accent-pod-wine" />
              {t("admin.products.form.featured")}
            </label>
          </div>
        </section>

        <button type="submit" disabled={form.submitting} className="min-h-12 bg-sun-gold px-10 py-3 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90 disabled:opacity-60">
          {form.submitting ? t("admin.products.form.saving") : t("admin.products.form.save")}
        </button>
      </form>
    </div>
  );
}
