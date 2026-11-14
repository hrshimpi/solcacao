// The addresses of an answer of the server. Anything that is not in the shape we know is left out, so one broken address
// cannot break a page. Used by the address page and by the checkout.
import type { Address } from "./components/AddressForm";

export function readAddresses(body: unknown): Address[] | null {
  const list = typeof body === "object" && body !== null ? (body as { addresses?: unknown }).addresses : undefined;
  if (!Array.isArray(list)) return null;
  return list.flatMap((item): Address[] => {
    if (typeof item !== "object" || item === null) return [];
    const entry = item as Record<string, unknown>;
    const text = (value: unknown) => (typeof value === "string" ? value : null);
    const [id, label, street, city, state, postalCode, country] = [entry.id, entry.label, entry.street, entry.city, entry.state, entry.postalCode, entry.country].map(text);
    if (!id || !label || !street || !city || !state || !postalCode || !country) return [];
    return [{ id, label, street, ...(text(entry.street2) ? { street2: text(entry.street2)! } : {}), city, state, postalCode, country, isDefault: entry.isDefault === true }];
  });
}
