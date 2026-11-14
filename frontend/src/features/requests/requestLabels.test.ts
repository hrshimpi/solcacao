import i18next from "../../i18n";
import { cacaoProfileNames, packagingTypes } from "../studio/quoteRequest";
import { packagingIds, profileIds } from "../studio/studioOptions";
import { packagingLabel, problemMessage, profileLabel, statusText } from "./requestLabels";

const en = i18next.getFixedT("en");
const es = i18next.getFixedT("es");

describe("profileLabel", () => {
  it("is the label of the card, in English", () => {
    expect(profileLabel("Ecuador 72%", en)).toBe("Ecuador 72%");
    expect(profileLabel("Custom blend", en)).toBe("Custom blend");
  });

  it("is in Spanish on the Spanish page", () => {
    expect(profileLabel("Peru 68%", es)).toBe("Perú 68%");
    expect(profileLabel("Custom blend", es)).toBe("Mezcla personalizada");
  });

  it("knows all of the profiles that the studio sends", () => {
    for (const id of profileIds) expect(profileLabel(cacaoProfileNames[id], en)).toBe(en(`studio.profiles.${id}.label`));
  });

  it("is the stored text when it is not one of them", () => {
    expect(profileLabel("Ghana 70%", en)).toBe("Ghana 70%");
    expect(profileLabel("", en)).toBe("");
  });
});

describe("packagingLabel", () => {
  it("is the label of the packaging, in the language of the page", () => {
    expect(packagingLabel("rigid_box", en)).toBe("Rigid gift box");
    expect(packagingLabel("rigid_box", es)).toBe("Caja de regalo rígida");
  });

  it("knows all of the packaging values that the studio sends", () => {
    for (const id of packagingIds) expect(packagingLabel(packagingTypes[id], en)).toBe(en(`studio.packaging.${id}.label`));
  });

  it("is the stored text when it is not one of them", () => {
    expect(packagingLabel("gold_bar", en)).toBe("gold_bar");
  });
});

describe("statusText", () => {
  it("is the word for the status in the language of the page", () => {
    expect(statusText("quoted", en)).toBe("Quoted");
    expect(statusText("quoted", es)).toBe("Cotizada");
    expect(statusText("rejected", es)).toBe("Rechazada");
  });

  it("is the status as it was sent when it is not a known one", () => {
    expect(statusText("on_hold", en)).toBe("on_hold");
  });
});

describe("problemMessage", () => {
  it.each([
    [0, "We could not reach the server. Check your connection and try again."],
    [401, "The server does not know who you are. Please sign in again."],
    [403, "Only business accounts have quote requests."],
    [404, "That file could not be found. It may have been removed."],
    [500, "Something went wrong. Please try again."],
    [429, "Something went wrong. Please try again."],
  ])("says what a %i answer means", (status, message) => {
    expect(problemMessage({ status }, en)).toBe(message);
  });

  it("says something went wrong for anything that is not an error with a status", () => {
    expect(problemMessage(new Error("boom"), en)).toBe("Something went wrong. Please try again.");
    expect(problemMessage(undefined, en)).toBe("Something went wrong. Please try again.");
    expect(problemMessage("text", en)).toBe("Something went wrong. Please try again.");
  });

  it("does not repeat the English message of the server", () => {
    expect(problemMessage({ status: 500, message: "The database exploded." }, en)).not.toContain("exploded");
  });

  it("says it in Spanish", () => {
    expect(problemMessage({ status: 404 }, es)).toBe("No encontramos ese archivo. Puede que lo hayan quitado.");
  });
});
