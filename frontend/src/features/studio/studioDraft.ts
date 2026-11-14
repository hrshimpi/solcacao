// The wizard state and its draft. The draft is kept in the browser tab, so a refresh does not lose the answers.
// A file cannot be kept there, so only the names of the files are, to tell the person which ones to add again.
import { packagingIds, profileIds, type PackagingId, type ProfileId } from "./studioOptions";
import type { ReviewField } from "./studioRules";

export const DRAFT_KEY = "sc_studio_draft";
export const LAST_STEP = 3;

// everything the person has entered in the wizard
export interface WizardState extends Record<ReviewField, string> {
  profile: ProfileId | null;
  packaging: PackagingId | null;
  files: File[];
}

// the same without the files
export interface StudioDraft extends Record<ReviewField, string> {
  step: number;
  profile: ProfileId | null;
  packaging: PackagingId | null;
  fileNames: string[];
}

interface Prefill {
  companyName: string;
  contactName: string;
}

const MAX_TEXT = 10_000;

function text(value: unknown) {
  return typeof value === "string" ? value.slice(0, MAX_TEXT) : "";
}

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return allowed.find((option) => option === value) ?? null;
}

// the furthest step the person may be on, with the same rules as the Continue button
function furthestStep(profile: ProfileId | null, packaging: PackagingId | null) {
  if (!profile) return 0;
  return packaging ? LAST_STEP : 1;
}

// the draft belongs to the account that wrote it, so someone else signing in in the same tab does not get it
export function loadDraft(owner: string): StudioDraft | null {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null");
    if (typeof saved !== "object" || saved === null) return null;
    const { owner: savedOwner, draft } = saved as Record<string, unknown>;
    if (savedOwner !== owner || typeof draft !== "object" || draft === null) return null;

    const data = draft as Record<string, unknown>;
    const profile = pick(data.profile, profileIds);
    const packaging = pick(data.packaging, packagingIds);
    const step = Number.isInteger(data.step) ? Math.max(0, Math.min(data.step as number, LAST_STEP)) : 0;

    return {
      step: Math.min(step, furthestStep(profile, packaging)),
      profile,
      packaging,
      companyName: text(data.companyName),
      contactName: text(data.contactName),
      units: text(data.units),
      notes: text(data.notes),
      fileNames: Array.isArray(data.fileNames)
        ? data.fileNames.filter((name): name is string => typeof name === "string").slice(0, 5).map((name) => name.slice(0, 255))
        : [],
    };
  } catch {
    // a missing or broken draft just means starting empty
    return null;
  }
}

export function saveDraft(owner: string, draft: StudioDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ owner, draft }));
  } catch {
    // saving is a convenience only, the form works without it
  }
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // nothing to clean up if the browser does not let the page use its storage
  }
}

// lostFileNames are the files of a draft from before a refresh: they stay in the draft until new files are added
export function toDraft(step: number, state: WizardState, lostFileNames: string[]): StudioDraft {
  const { files, ...rest } = state;
  return { step, ...rest, fileNames: files.length > 0 ? files.map((file) => file.name) : lostFileNames };
}

// where the wizard starts: from the draft when there is one, with the names of the account as the first answers
export function startingPoint(owner: string, account: { name?: string; companyName?: string }) {
  const prefill: Prefill = { companyName: account.companyName ?? "", contactName: account.name ?? "" };
  const draft = loadDraft(owner);

  return {
    prefill,
    restored: draft !== null,
    step: draft?.step ?? 0,
    profile: draft?.profile ?? null,
    packaging: draft?.packaging ?? null,
    fileNames: draft?.fileNames ?? [],
    fields: {
      companyName: draft?.companyName || prefill.companyName,
      contactName: draft?.contactName || prefill.contactName,
      units: draft?.units ?? "",
      notes: draft?.notes ?? "",
    } satisfies Record<ReviewField, string>,
  };
}

// true when the person has entered something that would be lost, the names from the account do not count
export function hasChanges(state: WizardState, prefill: Prefill) {
  return (
    state.profile !== null ||
    state.packaging !== null ||
    state.files.length > 0 ||
    state.units !== "" ||
    state.notes !== "" ||
    state.companyName !== prefill.companyName ||
    state.contactName !== prefill.contactName
  );
}
