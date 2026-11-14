import { en } from "../../i18n/en";
import type { WizardState } from "./studioDraft";
import { buildQuoteForm, cacaoProfileNames, isReady, packagingTypes, type ReadyWizardState } from "./quoteRequest";
import { packagingIds, profileIds } from "./studioOptions";

const ready: ReadyWizardState = {
  profile: "ecu",
  packaging: "rigid",
  files: [],
  companyName: "Hacienda Brands",
  contactName: "Isabel Vasquez",
  units: "800",
  notes: "Gold foil on the lid",
};

function makeFile(name: string, type = "application/pdf") {
  return new File(["x"], name, { type });
}

describe("the values of the ids", () => {
  it("has a name for every cacao profile of the wizard, and no other", () => {
    expect(Object.keys(cacaoProfileNames).sort()).toEqual([...profileIds].sort());
  });

  it("names the profiles like their cards, in English", () => {
    for (const id of profileIds) expect(cacaoProfileNames[id]).toBe(en.studio.profiles[id].label);
  });

  it("has a value for every packaging of the wizard, and no other", () => {
    expect(Object.keys(packagingTypes).sort()).toEqual([...packagingIds].sort());
  });

  it("uses the packaging values the server accepts", () => {
    expect(packagingTypes).toEqual({ foil: "foil_wrap", rigid: "rigid_box", specimen: "specimen_card", sleeve: "paper_sleeve" });
  });

  it("keeps every cacao profile within the 60 characters the server allows", () => {
    for (const name of Object.values(cacaoProfileNames)) expect(name.length).toBeLessThanOrEqual(60);
  });
});

describe("isReady", () => {
  const empty: WizardState = { profile: null, packaging: null, files: [], companyName: "", contactName: "", units: "", notes: "" };

  it("needs a profile and a packaging", () => {
    expect(isReady(empty)).toBe(false);
    expect(isReady({ ...empty, profile: "ecu" })).toBe(false);
    expect(isReady({ ...empty, packaging: "foil" })).toBe(false);
    expect(isReady({ ...empty, profile: "ecu", packaging: "foil" })).toBe(true);
  });
});

describe("buildQuoteForm", () => {
  it("uses the field names that the quote endpoint expects", () => {
    const form = buildQuoteForm(ready);

    expect(Object.fromEntries(form.entries())).toEqual({
      cacaoProfile: "Ecuador 72%",
      packagingType: "rigid_box",
      quantityEstimate: "800",
      companyName: "Hacienda Brands",
      contactName: "Isabel Vasquez",
      notes: "Gold foil on the lid",
    });
  });

  it("sends only the fields of the quote, so nothing like a status or an amount can be added by the form", () => {
    const keys = new Set(buildQuoteForm({ ...ready, files: [makeFile("a.pdf")] }).keys());

    expect([...keys].sort()).toEqual(["brandAssets", "cacaoProfile", "companyName", "contactName", "notes", "packagingType", "quantityEstimate"]);
  });

  it.each(profileIds)("sends the name of the profile %s", (id) => {
    expect(buildQuoteForm({ ...ready, profile: id }).get("cacaoProfile")).toBe(cacaoProfileNames[id]);
  });

  it.each(packagingIds)("sends the value of the packaging %s", (id) => {
    expect(buildQuoteForm({ ...ready, packaging: id }).get("packagingType")).toBe(packagingTypes[id]);
  });

  it("takes the spaces off the text", () => {
    const form = buildQuoteForm({ ...ready, companyName: "  Hacienda Brands ", contactName: " Isabel ", units: " 800 ", notes: "  hello  " });

    expect(form.get("companyName")).toBe("Hacienda Brands");
    expect(form.get("contactName")).toBe("Isabel");
    expect(form.get("quantityEstimate")).toBe("800");
    expect(form.get("notes")).toBe("hello");
  });

  it("leaves the notes out when they are empty or only spaces", () => {
    expect(buildQuoteForm({ ...ready, notes: "" }).has("notes")).toBe(false);
    expect(buildQuoteForm({ ...ready, notes: "   " }).has("notes")).toBe(false);
  });

  it("sends each brand file in the field brandAssets, in order, with its name", () => {
    const form = buildQuoteForm({ ...ready, files: [makeFile("logo.pdf"), makeFile("mark.png", "image/png")] });

    const files = form.getAll("brandAssets") as File[];
    expect(files.map((file) => file.name)).toEqual(["logo.pdf", "mark.png"]);
    expect(files[1].type).toBe("image/png");
  });

  it("sends no brandAssets field when there are no files, which the server allows", () => {
    expect(buildQuoteForm(ready).has("brandAssets")).toBe(false);
  });
});
