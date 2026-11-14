import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { es } from "../../../i18n/es";
import { renderPiece } from "../../../test/renderAt";
import { packagingIds, type PackagingId } from "../studioOptions";
import PackagingStep from "./PackagingStep";

const labels = ["Premium foil wrap", "Rigid gift box", "Specimen card label", "Paper sleeve"];

// the step keeps no state of its own, so a small parent holds the choice like the wizard does
function Parent({ start = null, error, onPick }: { start?: PackagingId | null; error?: string; onPick?: (id: PackagingId) => void }) {
  const [value, setValue] = useState<PackagingId | null>(start);
  return (
    <>
      <h2 id="step-heading">Select packaging &amp; branding</h2>
      <PackagingStep
        headingId="step-heading"
        value={value}
        error={error}
        onChange={(id) => {
          setValue(id);
          onPick?.(id);
        }}
      />
    </>
  );
}

describe("PackagingStep", () => {
  it("offers the four packaging options of the brief as one group named by the step heading", () => {
    renderPiece(<Parent />);

    expect(screen.getByRole("radiogroup", { name: "Select packaging & branding" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([...packagingIds]);
    for (const label of labels) {
      expect(screen.getByRole("radio", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("shows what each option is under its name", () => {
    renderPiece(<Parent />);

    expect(screen.getByRole("radio", { name: /Premium foil wrap/ })).toHaveAccessibleName(/Matte or gloss, Pantone matched/);
    expect(screen.getByRole("radio", { name: /Paper sleeve/ })).toHaveAccessibleName(/Recycled board, minimal print/);
  });

  it("starts with nothing chosen", () => {
    renderPiece(<Parent />);

    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
  });

  it("tells the parent which option was chosen, and shows the choice", async () => {
    const user = userEvent.setup();
    const picks: PackagingId[] = [];
    renderPiece(<Parent onPick={(id) => picks.push(id)} />);

    await user.click(screen.getByRole("radio", { name: /Rigid gift box/ }));

    expect(picks).toEqual(["rigid"]);
    expect(screen.getByRole("radio", { name: /Rigid gift box/ })).toBeChecked();
    expect(screen.getAllByRole("radio").filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(1);
  });

  it("shows a choice that was made before, for example when going back a step", () => {
    renderPiece(<Parent start="specimen" />);

    expect(screen.getByRole("radio", { name: /Specimen card label/ })).toBeChecked();
  });

  it("changes the choice when another card is chosen", async () => {
    const user = userEvent.setup();
    renderPiece(<Parent start="foil" />);

    await user.click(screen.getByRole("radio", { name: /Paper sleeve/ }));

    expect(screen.getByRole("radio", { name: /Paper sleeve/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Premium foil wrap/ })).not.toBeChecked();
  });

  it("can be used with the arrow keys", async () => {
    const user = userEvent.setup();
    renderPiece(<Parent start="foil" />);

    screen.getByRole("radio", { name: /Premium foil wrap/ }).focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("radio", { name: /Rigid gift box/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Rigid gift box/ })).toHaveFocus();
  });

  it("shows no error when there is none", () => {
    renderPiece(<Parent />);

    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-describedby");
  });

  it("shows the error under the cards and ties it to the group", () => {
    renderPiece(<Parent error="Choose a packaging option to continue." />);

    const group = screen.getByRole("radiogroup");
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription("Choose a packaging option to continue.");
    expect(screen.getByText("Choose a packaging option to continue.")).toBeInTheDocument();
  });

  it("is in Spanish on the Spanish address", () => {
    renderPiece(<Parent />, "/es/wholesale/studio");

    expect(screen.getByRole("radio", { name: new RegExp(es.studio.packaging.sleeve.label) })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: new RegExp(es.studio.packaging.rigid.label) })).toBeInTheDocument();
  });
});
