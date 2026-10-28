// The rules for the review step. They match what the server checks, so a request that passes here is not refused there.
import { maxLength, maxNumber, minLength, minNumber, required, wholeNumber, type Rule } from "../../lib/validation";
import { MIN_UNITS } from "./studioOptions";

export type ReviewField = "companyName" | "contactName" | "units" | "notes";

export const MAX_UNITS = 10_000_000;

// the server trims text before it counts the characters, so the rules do the same
const trimmed =
  (rule: Rule): Rule =>
  (value) =>
    rule(value.trim());

export const reviewRules: Record<ReviewField, Rule[]> = {
  companyName: [required, trimmed(minLength(2)), trimmed(maxLength(80))],
  contactName: [required, trimmed(minLength(2)), trimmed(maxLength(80))],
  units: [required, wholeNumber, minNumber(1), maxNumber(MAX_UNITS)],
  notes: [trimmed(maxLength(2000))],
};

// a good number of units that is under the usual minimum run: worth a warning, but not an error
export function isSmallRun(units: string) {
  const value = units.trim();
  return /^\d+$/.test(value) && Number(value) >= 1 && Number(value) < MIN_UNITS;
}
