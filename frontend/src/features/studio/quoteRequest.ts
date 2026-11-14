// What the quote endpoint (POST /api/b2b/quote) expects: the names of the form fields, and the values that the ids of
// the wizard stand for. The files go in the field "brandAssets", up to five of them.
import type { WizardState } from "./studioDraft";
import type { PackagingId, ProfileId } from "./studioOptions";

// the profile is sent as the English name of its card, so the request reads the same for whoever opens it later
export const cacaoProfileNames: Record<ProfileId, string> = {
  ecu: "Ecuador 72%",
  per: "Peru 68%",
  ven: "Venezuela 76%",
  col: "Colombia 64%",
  mad: "Madagascar 80%",
  custom: "Custom blend",
};

// the values the server accepts for the packaging
export const packagingTypes: Record<PackagingId, string> = {
  foil: "foil_wrap",
  rigid: "rigid_box",
  specimen: "specimen_card",
  sleeve: "paper_sleeve",
};

// a wizard where the first two steps were answered, which Continue makes sure of before the review
export type ReadyWizardState = WizardState & { profile: ProfileId; packaging: PackagingId };

export function isReady(state: WizardState): state is ReadyWizardState {
  return state.profile !== null && state.packaging !== null;
}

export function buildQuoteForm(state: ReadyWizardState) {
  const form = new FormData();
  form.append("cacaoProfile", cacaoProfileNames[state.profile]);
  form.append("packagingType", packagingTypes[state.packaging]);
  form.append("quantityEstimate", state.units.trim());
  form.append("companyName", state.companyName.trim());
  form.append("contactName", state.contactName.trim());

  const notes = state.notes.trim();
  if (notes) form.append("notes", notes);

  for (const file of state.files) form.append("brandAssets", file, file.name);
  return form;
}
