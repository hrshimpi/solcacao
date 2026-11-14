// The zod schemas of checkout and orders: the body that places an order, the filters of the lists, and the status change of the
// team. A body with anything else in it is refused, and so is a price: what an order costs is worked out by the server.
import { z } from "zod";
import { orderStatuses, shippingMethods } from "../models/order.model.ts";
import { pageFields } from "./pagination.ts";
import { text } from "./plain-text.ts";

const objectId = (message: string) => z.string({ error: message }).regex(/^[0-9a-f]{24}$/i, message).transform((id) => id.toLowerCase());

const shipping = z.enum(shippingMethods, { error: "Choose standard or express shipping." });

const onlyThese = (words: string) => ({ error: (issue: { code: string }) => (issue.code === "unrecognized_keys" ? `This only has ${words}. What an order costs is worked out by the shop.` : undefined) });

// 12 to 19 digits, written with or without spaces and dashes
const cardNumber = z
  .string({ error: "Enter the card number." })
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\d{12,19}$/, "Enter the card number, with 12 to 19 digits."));

// "MM/YY" or "MM/YYYY", the way it is printed on the card
const expiry = z
  .string({ error: "Enter the expiry date." })
  .trim()
  .regex(/^(0[1-9]|1[0-2])\s?\/\s?(\d{2}|\d{4})$/, "Enter the expiry date as MM/YY.")
  .transform((value) => {
    const [month, year] = value.split("/").map((part) => Number(part.trim()));
    return { expMonth: month, expYear: year < 100 ? 2000 + year : year };
  });

export const paymentSchema = z.strictObject(
  {
    cardNumber,
    expiry,
    cvc: z.string({ error: "Enter the security code." }).trim().regex(/^\d{3,4}$/, "Enter the 3 or 4 digit security code."),
    nameOnCard: text("Enter the name on the card.").pipe(z.string().min(2, "Enter the name on the card.").max(80, "The name can be at most 80 characters.")),
  },
  onlyThese("the card number, the expiry date, the security code and the name"),
);

export const placeOrderSchema = z.strictObject(
  {
    addressId: objectId("Choose a shipping address."),
    shippingMethod: shipping,
    payment: paymentSchema,
    note: text("The note must be text.").pipe(z.string().max(300, "The note can be at most 300 characters.")).optional(),
  },
  onlyThese("an address, a shipping method, the payment and a note"),
);

export const summaryQuerySchema = z.object({ shipping: shipping.default("standard") });

export const orderIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, "That isn't a valid order id.");

export const orderListQuerySchema = z.object({
  ...pageFields,
  limit: z.coerce.number({ error: "limit must be a number." }).int("limit must be a whole number.").min(1, "limit must be at least 1.").max(50, "limit can be at most 50.").default(20),
});

export const adminOrderListQuerySchema = z.object({
  ...pageFields,
  status: z.enum(orderStatuses, { error: `status must be one of: ${orderStatuses.join(", ")}.` }).optional(),
  q: z.string({ error: "q must be text." }).trim().max(80, "q can be at most 80 characters.").optional(),
});

export const orderStatusBodySchema = z.strictObject({ status: z.enum(orderStatuses, { error: `status must be one of: ${orderStatuses.join(", ")}.` }) }, { error: (issue) => (issue.code === "unrecognized_keys" ? "You can only change the status." : undefined) });

export type PlaceOrderInput = z.output<typeof placeOrderSchema>;
export type AdminOrderListQuery = z.output<typeof adminOrderListQuerySchema>;
