import { clearDraft, DRAFT_KEY, hasChanges, loadDraft, saveDraft, startingPoint, toDraft, type StudioDraft, type WizardState } from "./studioDraft";

const owner = "isabel@hacienda.example";

const draft: StudioDraft = {
  step: 2,
  profile: "ecu",
  packaging: "rigid",
  companyName: "Hacienda Brands",
  contactName: "Isabel",
  units: "800",
  notes: "Gold foil",
  fileNames: ["logo.pdf"],
};

const empty: WizardState = { profile: null, packaging: null, files: [], companyName: "", contactName: "", units: "", notes: "" };

function makeFile(name: string) {
  return new File(["x"], name);
}

// writes a draft by hand, with a part of it changed, the way a broken or old draft could look
function store(changes: Record<string, unknown>, savedOwner: unknown = owner) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ owner: savedOwner, draft: { ...draft, ...changes } }));
}

describe("saveDraft and loadDraft", () => {
  it("bring a draft back as it was saved", () => {
    saveDraft(owner, draft);

    expect(loadDraft(owner)).toEqual(draft);
  });

  it("find nothing when nothing was saved", () => {
    expect(loadDraft(owner)).toBeNull();
  });

  it("keep only the draft and the account it belongs to, which has no files in it", () => {
    saveDraft(owner, draft);

    const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY)!);
    expect(Object.keys(saved)).toEqual(["owner", "draft"]);
    expect(Object.keys(saved.draft).sort()).toEqual(
      ["companyName", "contactName", "fileNames", "notes", "packaging", "profile", "step", "units"].sort(),
    );
  });

  it("do not give a draft to another account", () => {
    saveDraft("someone@else.example", draft);

    expect(loadDraft(owner)).toBeNull();
  });

  it.each([
    ["text that is not JSON", "not json"],
    ["a number", "42"],
    ["null", "null"],
    ["a list", "[]"],
    ["a draft that is not an object", JSON.stringify({ owner, draft: 5 })],
    ["a draft that is null", JSON.stringify({ owner, draft: null })],
  ])("find nothing in %s", (_label, saved) => {
    sessionStorage.setItem(DRAFT_KEY, saved);

    expect(loadDraft(owner)).toBeNull();
  });

  it("find nothing when the browser does not let the page read its storage", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(loadDraft(owner)).toBeNull();
    getItem.mockRestore();
  });

  it("do not fail when the browser does not let the page save", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => saveDraft(owner, draft)).not.toThrow();
    setItem.mockRestore();
  });

  it("drop a profile or a packaging that does not exist", () => {
    store({ profile: "atlantis", packaging: "gold bar", step: 0 });

    expect(loadDraft(owner)).toMatchObject({ profile: null, packaging: null });
  });

  it.each([
    ["a step past the last one", { step: 9 }, 3],
    ["a negative step", { step: -2 }, 0],
    ["a step with a fraction", { step: 1.5 }, 0],
    ["a step written as text", { step: "2" }, 0],
    ["the review step without a profile", { step: 3, profile: null }, 0],
    ["the review step without a packaging", { step: 3, packaging: null }, 1],
    ["the packaging step without a profile", { step: 1, profile: null, packaging: null }, 0],
  ])("hold the step to what the choices allow for %s", (_label, changes, step) => {
    store(changes);

    expect(loadDraft(owner)?.step).toBe(step);
  });

  it("turn text fields that are not text into empty ones, and cut very long text", () => {
    store({ companyName: 42, contactName: null, units: ["8"], notes: "a".repeat(20_000) });

    const loaded = loadDraft(owner)!;
    expect(loaded.companyName).toBe("");
    expect(loaded.contactName).toBe("");
    expect(loaded.units).toBe("");
    expect(loaded.notes).toHaveLength(10_000);
  });

  it("keep at most five file names, as text, and cut a very long name", () => {
    store({ fileNames: ["a.pdf", 7, null, "b.pdf", "c.pdf", "d.pdf", "e.pdf", "f.pdf", "g.pdf"] });
    expect(loadDraft(owner)?.fileNames).toEqual(["a.pdf", "b.pdf", "c.pdf", "d.pdf", "e.pdf"]);

    store({ fileNames: ["x".repeat(500)] });
    expect(loadDraft(owner)?.fileNames[0]).toHaveLength(255);

    store({ fileNames: "logo.pdf" });
    expect(loadDraft(owner)?.fileNames).toEqual([]);
  });
});

describe("clearDraft", () => {
  it("removes the draft", () => {
    saveDraft(owner, draft);

    clearDraft();

    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("does not fail when the browser does not let the page use its storage", () => {
    const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => clearDraft()).not.toThrow();
    removeItem.mockRestore();
  });
});

describe("toDraft", () => {
  it("turns the files into their names and keeps the step", () => {
    const state: WizardState = { ...empty, profile: "ecu", packaging: "foil", files: [makeFile("a.pdf"), makeFile("b.png")], units: "800" };

    expect(toDraft(3, state, [])).toEqual({
      step: 3,
      profile: "ecu",
      packaging: "foil",
      companyName: "",
      contactName: "",
      units: "800",
      notes: "",
      fileNames: ["a.pdf", "b.png"],
    });
  });

  it("keeps the names of files that were lost until new files are added", () => {
    expect(toDraft(2, { ...empty, profile: "ecu" }, ["old.pdf"]).fileNames).toEqual(["old.pdf"]);
    expect(toDraft(2, { ...empty, profile: "ecu", files: [makeFile("new.pdf")] }, ["old.pdf"]).fileNames).toEqual(["new.pdf"]);
  });
});

describe("startingPoint", () => {
  it("starts empty on the first step when there is no draft and no account names", () => {
    expect(startingPoint(owner, {})).toEqual({
      prefill: { companyName: "", contactName: "" },
      restored: false,
      step: 0,
      profile: null,
      packaging: null,
      fileNames: [],
      fields: { companyName: "", contactName: "", units: "", notes: "" },
    });
  });

  it("starts the company and the contact from the account", () => {
    const start = startingPoint(owner, { name: "Isabel", companyName: "Hacienda Brands" });

    expect(start.prefill).toEqual({ companyName: "Hacienda Brands", contactName: "Isabel" });
    expect(start.fields).toMatchObject({ companyName: "Hacienda Brands", contactName: "Isabel" });
    expect(start.restored).toBe(false);
  });

  it("starts from the draft when there is one", () => {
    saveDraft(owner, draft);

    const start = startingPoint(owner, {});

    expect(start).toMatchObject({ restored: true, step: 2, profile: "ecu", packaging: "rigid", fileNames: ["logo.pdf"] });
    expect(start.fields).toEqual({ companyName: "Hacienda Brands", contactName: "Isabel", units: "800", notes: "Gold foil" });
  });

  it("lets what was typed win over the names of the account", () => {
    saveDraft(owner, { ...draft, companyName: "Other Co" });

    expect(startingPoint(owner, { name: "Someone", companyName: "Hacienda Brands" }).fields).toMatchObject({
      companyName: "Other Co",
      contactName: "Isabel",
    });
  });

  it("falls back to the account when the draft has no company or contact", () => {
    saveDraft(owner, { ...draft, companyName: "", contactName: "" });

    expect(startingPoint(owner, { name: "Someone", companyName: "Hacienda Brands" }).fields).toMatchObject({
      companyName: "Hacienda Brands",
      contactName: "Someone",
    });
  });
});

describe("hasChanges", () => {
  const prefill = { companyName: "Hacienda Brands", contactName: "Isabel" };
  const pristine: WizardState = { ...empty, companyName: "Hacienda Brands", contactName: "Isabel" };

  it("is false when nothing was entered, and when only the names of the account are there", () => {
    expect(hasChanges(empty, { companyName: "", contactName: "" })).toBe(false);
    expect(hasChanges(pristine, prefill)).toBe(false);
  });

  it.each([
    ["a profile", { profile: "ecu" }],
    ["a packaging", { packaging: "foil" }],
    ["a file", { files: [makeFile("a.pdf")] }],
    ["units", { units: "1" }],
    ["notes", { notes: "hello" }],
    ["another company", { companyName: "Other Co" }],
    ["another contact", { contactName: "Someone" }],
    ["an emptied company", { companyName: "" }],
  ])("is true for %s", (_label, changes) => {
    expect(hasChanges({ ...pristine, ...changes } as WizardState, prefill)).toBe(true);
  });
});
