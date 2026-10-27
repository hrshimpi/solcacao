// Turns what the API stores for a request into words in the language of the page. A cacao profile is stored as the
// English name of its card (like "Ecuador 72%") and a packaging as a code (like "rigid_box"). A value that is not one
// of the known ones is shown as it is, so an older or newer request is never shown as an empty field.
import type { TFunction } from "i18next";
import { cacaoProfileNames, packagingTypes } from "../studio/quoteRequest";
import { packagingIds, profileIds } from "../studio/studioOptions";
import { isKnownStatus } from "./requestTypes";

// the status in words. A status that is not one of the known ones is shown as the server sent it.
export function statusText(status: string, t: TFunction): string {
  return isKnownStatus(status) ? t(`b2b.requests.status.${status}`) : status;
}

export function profileLabel(stored: string, t: TFunction): string {
  const id = profileIds.find((candidate) => cacaoProfileNames[candidate] === stored);
  return id ? t(`studio.profiles.${id}.label`) : stored;
}

export function packagingLabel(stored: string, t: TFunction): string {
  const id = packagingIds.find((candidate) => packagingTypes[candidate] === stored);
  return id ? t(`studio.packaging.${id}.label`) : stored;
}

// what went wrong, said in the words of the page. The server's own messages are in English, so they are not shown.
export function problemMessage(error: unknown, t: TFunction): string {
  const status = typeof error === "object" && error !== null && "status" in error ? (error as { status: unknown }).status : undefined;
  if (status === 0) return t("b2b.requests.problem.network");
  if (status === 401) return t("b2b.requests.problem.signedOut");
  if (status === 403) return t("b2b.requests.problem.notBusiness");
  if (status === 404) return t("b2b.requests.problem.notFound");
  return t("b2b.requests.problem.unknown");
}
