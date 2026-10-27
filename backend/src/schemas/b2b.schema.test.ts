import { describe, expect, it } from "vitest";
import { packagingTypes } from "../models/b2b-request.model.ts";
import { quoteRequestSchema } from "./b2b.schema.ts";

const valid = {
  cacaoProfile: "Ecuador",
  packagingType: "foil_wrap",
  quantityEstimate: "800",
  companyName: "Hacienda Brands",
  contactName: "Isabel Vasquez",
  notes: "Before the holidays, please.",
};

function problems(data: unknown): string[] {
  const result = quoteRequestSchema.safeParse(data);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

function parsed(data: unknown) {
  const result = quoteRequestSchema.safeParse(data);
  if (!result.success) throw new Error(`should have been valid: ${problems(data).join(", ")}`);
  return result.data;
}

describe("quote request: a valid request", () => {
  it("reads the text fields of a form and turns the units into a number", () => {
    expect(parsed(valid)).toEqual({
      cacaoProfile: "Ecuador",
      packagingType: "foil_wrap",
      quantityEstimate: 800,
      companyName: "Hacienda Brands",
      contactName: "Isabel Vasquez",
      notes: "Before the holidays, please.",
    });
  });

  it("also takes a number, like a JSON body has", () => {
    expect(parsed({ ...valid, quantityEstimate: 800 }).quantityEstimate).toBe(800);
  });

  it.each(packagingTypes)("accepts the packaging %s", (packagingType) => {
    expect(problems({ ...valid, packagingType })).toEqual([]);
  });

  it("does not need notes, and treats empty notes as none", () => {
    expect(parsed({ ...valid, notes: undefined })).not.toHaveProperty("notes", expect.anything());
    expect(parsed({ ...valid, notes: "   " }).notes).toBeUndefined();
  });

  it("accepts the origin names the studio sends, and custom", () => {
    for (const cacaoProfile of ["Ecuador", "Peru", "Venezuela", "Colombia", "Madagascar", "custom"]) {
      expect(problems({ ...valid, cacaoProfile }), cacaoProfile).toEqual([]);
    }
  });

  it("trims the text", () => {
    const result = parsed({ ...valid, cacaoProfile: "  Ecuador ", companyName: "  Hacienda Brands\n", packagingType: " rigid_box ", quantityEstimate: " 1200 " });

    expect(result).toMatchObject({ cacaoProfile: "Ecuador", companyName: "Hacienda Brands", packagingType: "rigid_box", quantityEstimate: 1200 });
  });

  it("strips HTML from every text field", () => {
    const result = parsed({
      ...valid,
      cacaoProfile: "<b>Ecuador</b>",
      companyName: "<i>Hacienda</i> Brands",
      contactName: "Isabel <script>alert(1)</script>Vasquez",
      notes: "Hello <img src=x onerror=alert(1)>there",
    });

    expect(result).toMatchObject({ cacaoProfile: "Ecuador", companyName: "Hacienda Brands", contactName: "Isabel Vasquez", notes: "Hello there" });
  });

  it("drops fields that nobody may set through the form", () => {
    const result = parsed({ ...valid, status: "approved", quoteAmount: 1, quoteNote: "free", userId: "64b7f0c2a1b2c3d4e5f60718", id: "mine", brandAssets: ["x"] });

    expect(Object.keys(result).sort()).toEqual(["cacaoProfile", "companyName", "contactName", "notes", "packagingType", "quantityEstimate"]);
  });
});

describe("quote request: what is wrong", () => {
  it("says what is missing, in plain words", () => {
    expect(problems({})).toEqual([
      "cacaoProfile: Please choose a cacao profile.",
      "packagingType: Please choose a packaging option: foil_wrap, rigid_box, specimen_card or paper_sleeve.",
      "quantityEstimate: Please enter how many units you need, as a whole number.",
      "companyName: Please enter your company name.",
      "contactName: Please enter the name of the contact person.",
    ]);
  });

  it("treats empty fields as missing, with one message each", () => {
    expect(problems({ ...valid, cacaoProfile: "", companyName: "  ", contactName: "", quantityEstimate: "", packagingType: "" })).toEqual([
      "cacaoProfile: Please choose a cacao profile.",
      "packagingType: Please choose a packaging option: foil_wrap, rigid_box, specimen_card or paper_sleeve.",
      "quantityEstimate: Please enter how many units you need, as a whole number.",
      "companyName: Please enter your company name.",
      "contactName: Please enter the name of the contact person.",
    ]);
  });

  it.each(["gift_bag", "Foil_Wrap", "foil wrap", "FOIL_WRAP", "box"])("refuses the packaging %j", (packagingType) => {
    expect(problems({ ...valid, packagingType })).toEqual([
      "packagingType: Please choose a packaging option: foil_wrap, rigid_box, specimen_card or paper_sleeve.",
    ]);
  });

  describe("units", () => {
    it.each(["0", "-5", 0, -1])("needs at least 1: %j", (quantityEstimate) => {
      expect(problems({ ...valid, quantityEstimate })).toEqual(["quantityEstimate: Please ask for at least 1 unit."]);
    });

    it.each(["2.5", 2.5, "800.1"])("needs a whole number: %j", (quantityEstimate) => {
      expect(problems({ ...valid, quantityEstimate })).toEqual(["quantityEstimate: Please enter how many units you need, as a whole number."]);
    });

    it.each(["abc", "lots", "12 boxes", true, [], {}, null])("needs a number: %j", (quantityEstimate) => {
      expect(problems({ ...valid, quantityEstimate })).toEqual(["quantityEstimate: Please enter how many units you need, as a whole number."]);
    });

    it("has an upper limit, with a way out", () => {
      expect(problems({ ...valid, quantityEstimate: "10000000" })).toEqual([]);
      expect(problems({ ...valid, quantityEstimate: "10000001" })).toEqual([
        "quantityEstimate: For more than 10,000,000 units, please contact us instead.",
      ]);
    });

    it("accepts the smallest request", () => {
      expect(parsed({ ...valid, quantityEstimate: "1" }).quantityEstimate).toBe(1);
    });
  });

  it("checks the lengths of the names, the profile and the notes", () => {
    expect(problems({ ...valid, companyName: "A" })).toEqual(["companyName: The company name needs at least 2 characters."]);
    expect(problems({ ...valid, companyName: "a".repeat(81) })).toEqual(["companyName: The company name can be at most 80 characters."]);
    expect(problems({ ...valid, contactName: "I" })).toEqual(["contactName: The contact name needs at least 2 characters."]);
    expect(problems({ ...valid, contactName: "a".repeat(81) })).toEqual(["contactName: The contact name can be at most 80 characters."]);
    expect(problems({ ...valid, cacaoProfile: "a".repeat(61) })).toEqual(["cacaoProfile: The cacao profile can be at most 60 characters."]);
    expect(problems({ ...valid, notes: "a".repeat(2001) })).toEqual(["notes: The notes can be at most 2000 characters."]);
    expect(problems({ ...valid, notes: "a".repeat(2000) })).toEqual([]);
  });

  it("counts the length of the plain text, after the tags are gone", () => {
    expect(problems({ ...valid, companyName: "<b>A</b>" })).toEqual(["companyName: The company name needs at least 2 characters."]);
    expect(problems({ ...valid, companyName: "<b></b>" })).toEqual(["companyName: Please enter your company name."]);
  });

  it("refuses text fields that are not text, such as a field sent twice", () => {
    expect(problems({ ...valid, companyName: ["Hacienda", "Brands"] })).toEqual(["companyName: Please enter your company name."]);
    expect(problems({ ...valid, notes: ["a", "b"] })).toEqual(["notes: The notes must be text."]);
  });

  it("refuses something that is not an object", () => {
    for (const data of [null, undefined, "text", 42, []]) {
      expect(problems(data).length, String(data)).toBeGreaterThan(0);
    }
  });
});
