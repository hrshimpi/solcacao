import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { B2BRequest, packagingTypes, requestStatuses } from "./b2b-request.model.ts";

// These tests only build documents and run validation, so they do not need a database.

function validData(overrides: Record<string, unknown> = {}) {
  return {
    userId: new mongoose.Types.ObjectId(),
    companyName: "Hacienda Brands",
    contactName: "Isabel Vasquez",
    cacaoProfile: "Ecuador",
    packagingType: "foil_wrap",
    quantityEstimate: 800,
    ...overrides,
  };
}

// returns the names of the fields that failed validation (an empty list means the request is valid)
async function errorPaths(overrides: Record<string, unknown> = {}) {
  try {
    await new B2BRequest(validData(overrides)).validate();
    return [];
  } catch (error) {
    return Object.keys((error as mongoose.Error.ValidationError).errors);
  }
}

const asset = {
  originalName: "logo.png",
  storedName: "a1b2c3d4.png",
  mimeType: "image/png",
  sizeBytes: 20480,
};

describe("B2BRequest defaults", () => {
  it("starts as submitted with no quote, no notes and no files", async () => {
    const request = new B2BRequest(validData());

    await expect(request.validate()).resolves.toBeUndefined();
    expect(request.status).toBe("submitted");
    expect(request.quoteAmount).toBeNull();
    expect(request.quoteNote).toBeUndefined();
    expect(request.notes).toBeUndefined();
    expect(request.brandAssets).toHaveLength(0);
  });

  it("trims the text fields", () => {
    const request = new B2BRequest(validData({ companyName: "  Hacienda Brands  ", notes: "  call me  " }));

    expect(request.companyName).toBe("Hacienda Brands");
    expect(request.notes).toBe("call me");
  });
});

describe("B2BRequest required fields", () => {
  it.each(["userId", "companyName", "contactName", "cacaoProfile", "packagingType", "quantityEstimate"])(
    "is not valid without %s",
    async (field) => {
      expect(await errorPaths({ [field]: undefined })).toContain(field);
    },
  );

  it("does not accept a company name that is only spaces", async () => {
    expect(await errorPaths({ companyName: "   " })).toContain("companyName");
  });
});

describe("B2BRequest status", () => {
  it.each(requestStatuses)("accepts %s", async (status) => {
    expect(await errorPaths({ status })).toEqual([]);
  });

  it("only accepts the four allowed values", async () => {
    expect(requestStatuses).toEqual(["submitted", "quoted", "approved", "rejected"]);
    expect(await errorPaths({ status: "shipped" })).toContain("status");
    expect(await errorPaths({ status: "" })).toContain("status");
    expect(await errorPaths({ status: "Submitted" })).toContain("status");
  });
});

describe("B2BRequest packaging type", () => {
  it.each(packagingTypes)("accepts %s", async (packagingType) => {
    expect(await errorPaths({ packagingType })).toEqual([]);
  });

  it("rejects anything else", async () => {
    expect(packagingTypes).toEqual(["foil_wrap", "rigid_box", "specimen_card", "paper_sleeve"]);
    expect(await errorPaths({ packagingType: "gift_bag" })).toContain("packagingType");
  });
});

describe("B2BRequest quantity", () => {
  it("must be at least 1", async () => {
    expect(await errorPaths({ quantityEstimate: 0 })).toContain("quantityEstimate");
    expect(await errorPaths({ quantityEstimate: -5 })).toContain("quantityEstimate");
    expect(await errorPaths({ quantityEstimate: 1 })).toEqual([]);
  });

  it("must be a whole number", async () => {
    expect(await errorPaths({ quantityEstimate: 2.5 })).toContain("quantityEstimate");
  });

  it("must be a number", async () => {
    expect(await errorPaths({ quantityEstimate: "lots" })).toContain("quantityEstimate");
  });
});

describe("B2BRequest notes and quote", () => {
  it("allows notes up to 2000 characters", async () => {
    expect(await errorPaths({ notes: "a".repeat(2000) })).toEqual([]);
    expect(await errorPaths({ notes: "a".repeat(2001) })).toContain("notes");
  });

  it("keeps the quote in whole cents", async () => {
    expect(await errorPaths({ quoteAmount: 125000, quoteNote: "Includes the foil printing" })).toEqual([]);
    expect(await errorPaths({ quoteAmount: null })).toEqual([]);
    expect(await errorPaths({ quoteAmount: 1250.5 })).toContain("quoteAmount");
    expect(await errorPaths({ quoteAmount: -100 })).toContain("quoteAmount");
  });
});

describe("B2BRequest brand assets", () => {
  it("embeds the file records in the request", async () => {
    const request = new B2BRequest(validData({ brandAssets: [asset, { ...asset, originalName: "label.pdf" }] }));

    await expect(request.validate()).resolves.toBeUndefined();
    expect(request.brandAssets).toHaveLength(2);
    expect(request.brandAssets[0].originalName).toBe("logo.png");
    expect(request.brandAssets[0].storedName).toBe("a1b2c3d4.png");
    expect(request.brandAssets[0].mimeType).toBe("image/png");
    expect(request.brandAssets[0].sizeBytes).toBe(20480);
    expect(request.brandAssets[1].originalName).toBe("label.pdf");
  });

  it("sets uploadedAt when it is not given", () => {
    const before = Date.now();
    const request = new B2BRequest(validData({ brandAssets: [asset] }));

    expect(request.brandAssets[0].uploadedAt).toBeInstanceOf(Date);
    expect(request.brandAssets[0].uploadedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("does not give each file its own _id", () => {
    const request = new B2BRequest(validData({ brandAssets: [asset] }));

    expect(request.toObject().brandAssets[0]).not.toHaveProperty("_id");
  });

  it("needs every part of a file record and a sensible size", async () => {
    expect(await errorPaths({ brandAssets: [{ ...asset, storedName: undefined }] })).toContain("brandAssets.0.storedName");
    expect(await errorPaths({ brandAssets: [{ ...asset, originalName: undefined }] })).toContain("brandAssets.0.originalName");
    expect(await errorPaths({ brandAssets: [{ ...asset, mimeType: undefined }] })).toContain("brandAssets.0.mimeType");
    expect(await errorPaths({ brandAssets: [{ ...asset, sizeBytes: -1 }] })).toContain("brandAssets.0.sizeBytes");
    expect(await errorPaths({ brandAssets: [{ ...asset, sizeBytes: 10.5 }] })).toContain("brandAssets.0.sizeBytes");
  });

  it("stores no public URL, even if one is sent", () => {
    const request = new B2BRequest(validData({ brandAssets: [{ ...asset, url: "https://cdn.example.com/logo.png" }] }));
    const stored = request.toJSON().brandAssets[0];

    expect(Object.keys(stored).sort()).toEqual(["mimeType", "originalName", "sizeBytes", "storedName", "uploadedAt"]);
    expect(JSON.stringify(request.toJSON())).not.toContain("http");
  });
});

describe("B2BRequest schema", () => {
  it("points userId at the User model", () => {
    expect(B2BRequest.schema.path("userId").options.ref).toBe("User");
  });

  it("has indexes on userId, status and createdAt (newest first)", () => {
    const indexes = B2BRequest.schema.indexes().map(([fields]) => fields);

    expect(indexes).toContainEqual({ userId: 1 });
    expect(indexes).toContainEqual({ status: 1 });
    expect(indexes).toContainEqual({ createdAt: -1 });
  });

  it("adds createdAt and updatedAt", () => {
    expect(B2BRequest.schema.path("createdAt")).toBeDefined();
    expect(B2BRequest.schema.path("updatedAt")).toBeDefined();
  });

  it("returns id instead of _id and __v when turned into JSON", () => {
    const request = new B2BRequest(validData());
    const json = request.toJSON();

    expect(json).toHaveProperty("id", String(request._id));
    expect(json).not.toHaveProperty("_id");
    expect(json).not.toHaveProperty("__v");
  });
});
