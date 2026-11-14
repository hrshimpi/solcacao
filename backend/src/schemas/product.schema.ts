// The zod schemas of the shop: the filters of the product list (what comes in the address) and the bodies that the
// team sends to make and change products. The messages are written for the person who reads them.
import { z } from "zod";
import { productCategories, productOrigins, productSorts, tastingNotes } from "../models/product.model.ts";
import { pageFields } from "./pagination.ts";
import { text } from "./plain-text.ts";

// a list in the address: ?origin=peru,ecuador, or the same name more than once (?origin=peru&origin=ecuador)
const listOf = <const Values extends readonly [string, ...string[]]>(values: Values, name: string) =>
  z
    .preprocess((value) => (Array.isArray(value) ? value.join(",") : value), z.string({ error: `${name} must be text.` }))
    .transform((value) => [...new Set(value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))])
    .pipe(z.array(z.enum(values, { error: `${name} must be some of: ${values.join(", ")}.` })).max(values.length));

const percent = (name: string) =>
  z.coerce
    .number({ error: `${name} must be a number.` })
    .int(`${name} must be a whole number.`)
    .min(1, `${name} must be at least 1.`)
    .max(100, `${name} can be at most 100.`);

export const productListQuerySchema = z
  .object({
    q: z
      .string({ error: "q must be text." })
      .trim()
      .max(80, "q can be at most 80 characters.")
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
    origin: listOf(productOrigins, "origin").optional(),
    category: listOf(productCategories, "category").optional(),
    minPct: percent("minPct").optional(),
    maxPct: percent("maxPct").optional(),
    notes: listOf(tastingNotes, "notes").optional(),
    featured: z
      .enum(["true", "false"], { error: "featured must be true or false." })
      .transform((value) => value === "true")
      .optional(),
    sort: z.enum(productSorts, { error: `sort must be one of: ${productSorts.join(", ")}.` }).default("featured"),
    page: pageFields.page,
    limit: z.coerce
      .number({ error: "limit must be a number." })
      .int("limit must be a whole number.")
      .min(1, "limit must be at least 1.")
      .max(48, "limit can be at most 48.")
      .default(12),
  })
  .refine((query) => query.minPct === undefined || query.maxPct === undefined || query.minPct <= query.maxPct, { path: ["minPct"], message: "minPct can't be higher than maxPct." });

export type ProductListQuery = z.output<typeof productListQuerySchema>;

// a product page is found by its slug: anything that cannot be a slug is simply not a product
export const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/i).max(80);
export const productIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, "That isn't a valid product id.");

const bilingual = (name: string, max: number, min = 1) =>
  z.strictObject({
    en: text(`The English ${name} is needed.`).pipe(z.string().min(min, `The English ${name} is needed.`).max(max, `The ${name} can be at most ${max} characters.`)),
    es: text(`The Spanish ${name} is needed.`).pipe(z.string().min(min, `The Spanish ${name} is needed.`).max(max, `The ${name} can be at most ${max} characters.`)),
  });

const image = z
  .string({ error: "An image must be a web address." })
  .max(500, "An image address can be at most 500 characters.")
  .regex(/^(https:\/\/|\/)[^\s"'<>]+$/i, "An image must be an https address or a path on this site.");

const month = (name: string) => z.string({ error: `${name} must look like 2024-03.` }).regex(/^\d{4}-(0[1-9]|1[0-2])$/, `${name} must look like 2024-03.`);

const productShape = {
  slug: z.string({ error: "A slug is needed." }).trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "The slug can only have lower case words joined with dashes.").max(80, "The slug can be at most 80 characters."),
  sku: z.string({ error: "A SKU is needed." }).trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]*$/, "The SKU can only have capitals, numbers and dashes.").max(40, "The SKU can be at most 40 characters."),
  name: bilingual("name", 80),
  caption: bilingual("caption", 120),
  tastingSummary: bilingual("tasting summary", 160),
  imageAlt: bilingual("image description", 200),
  farm: bilingual("farm", 120),
  description: bilingual("description", 2000),
  origin: z.enum(productOrigins, { error: `origin must be one of: ${productOrigins.join(", ")}.` }),
  originName: bilingual("country name", 80),
  percentage: z.number({ error: "percentage must be a number." }).int("percentage must be a whole number.").min(1, "percentage must be at least 1.").max(100, "percentage can be at most 100."),
  category: z.enum(productCategories, { error: `category must be one of: ${productCategories.join(", ")}.` }),
  // whole cents, so 12 dollars is 1200
  price: z.number({ error: "price must be a number of cents." }).int("price must be a whole number of cents.").min(1, "price must be at least 1 cent.").max(10_000_000, "price is too high."),
  notes: z.array(z.enum(tastingNotes, { error: `Each note must be one of: ${tastingNotes.join(", ")}.` })).max(tastingNotes.length, "That is too many notes.").refine((notes) => new Set(notes).size === notes.length, "A note can only be there once."),
  thumbnail: image,
  images: z.array(image).min(1, "A product needs at least one image.").max(8, "A product can have at most 8 images."),
  batchCode: text("The batch code is needed.").pipe(z.string().min(1, "The batch code is needed.").max(40, "The batch code can be at most 40 characters.")),
  harvestMonth: month("harvestMonth"),
  roastMonth: month("roastMonth"),
  featured: z.boolean({ error: "featured must be true or false." }),
  active: z.boolean({ error: "active must be true or false." }),
  sortOrder: z.number({ error: "sortOrder must be a number." }).int("sortOrder must be a whole number.").min(0, "sortOrder can't be negative.").max(10_000, "sortOrder is too high."),
};

const units = (name: string) => z.number({ error: `${name} must be a number.` }).int(`${name} must be a whole number.`).min(0, `${name} can't be negative.`).max(1_000_000, `${name} is too high.`);

const onlyThese = { error: (issue: { code: string }) => (issue.code === "unrecognized_keys" ? "That has a field that a product does not have." : undefined) };

export const productCreateSchema = z.strictObject(
  {
    ...productShape,
    featured: productShape.featured.default(false),
    active: productShape.active.default(true),
    sortOrder: productShape.sortOrder.default(0),
    // the stock the product starts with
    quantity: units("quantity").default(0),
  },
  onlyThese,
);

// a change names only what changes. The stock has its own call, so that it is never changed by accident.
export const productPatchSchema = z
  .strictObject(Object.fromEntries(Object.entries(productShape).map(([name, rule]) => [name, rule.optional()])) as { [Name in keyof typeof productShape]: z.ZodOptional<(typeof productShape)[Name]> }, onlyThese)
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), "Send at least one thing to change.");

export const inventorySchema = z.strictObject({ quantity: units("quantity"), lowStockThreshold: units("lowStockThreshold").optional() }, { error: (issue) => (issue.code === "unrecognized_keys" ? "You can only set the quantity and the number for low stock." : undefined) });

export type ProductCreateInput = z.output<typeof productCreateSchema>;
export type ProductPatchInput = z.output<typeof productPatchSchema>;
