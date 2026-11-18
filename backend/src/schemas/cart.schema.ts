// The zod schemas of the cart. A line is one product, or a sampler of 4 to 6 different products. A body that
// carries anything else is refused, and so is a price: the price of a line is never something a client sends.
import { z } from "zod";
import { MAX_LINE_QUANTITY } from "../models/cart.model.ts";

const productId = z
  .string({ error: "That isn't a valid product id." })
  .regex(/^[0-9a-f]{24}$/i, "That isn't a valid product id.")
  .transform((id) => id.toLowerCase());

const quantity = z
  .number({ error: "quantity must be a number." })
  .int("quantity must be a whole number.")
  .min(1, "quantity must be at least 1.")
  .max(MAX_LINE_QUANTITY, `quantity can be at most ${MAX_LINE_QUANTITY}.`);

const onlyThese = (words: string) => ({ error: (issue: { code: string }) => (issue.code === "unrecognized_keys" ? `A cart item only has ${words}. The price comes from the shop.` : undefined) });

export const addItemSchema = z.discriminatedUnion(
  "kind",
  [
    z.strictObject({ kind: z.literal("product"), productId, quantity: quantity.default(1) }, onlyThese("a kind, a product and a quantity")),
    z.strictObject(
      {
        kind: z.literal("sampler"),
        productIds: z
          .array(productId, { error: "A sampler needs a list of products." })
          .min(4, "A sampler needs 4 to 6 different specimens.")
          .max(6, "A sampler needs 4 to 6 different specimens.")
          .refine((ids) => new Set(ids).size === ids.length, "A sampler needs 4 to 6 different specimens."),
        quantity: quantity.default(1),
      },
      onlyThese("a kind, the products and a quantity"),
    ),
  ],
  { error: "kind must be product or sampler." },
);

export const quantitySchema = z.strictObject({ quantity }, onlyThese("a quantity"));

export const lineIdSchema = z.string().regex(/^(p-[0-9a-f]{24}|s-[0-9a-f]{20})$/, "That isn't a valid cart item id.");

export type AddItemInput = z.output<typeof addItemSchema>;
