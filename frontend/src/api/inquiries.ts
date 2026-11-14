// The contact form and the newsletter box of the footer both send what a person wrote to the inquiries API. The server
// checks it again, so a field it names is shown on that field, and it answers 201 when the message is saved.
import type { Lang } from "../i18n";
import { apiFetch } from "../lib/apiFetch";

export type Inquiry =
  | { category: "general" | "wholesale" | "support"; name: string; email: string; message: string }
  | { category: "newsletter"; email: string };

export async function sendInquiry(inquiry: Inquiry, lang: Lang): Promise<void> {
  await apiFetch("/inquiries", { lang, method: "POST", json: inquiry, auth: true });
}
