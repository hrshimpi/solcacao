import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { es } from "../../../i18n/es";
import { renderPiece } from "../../../test/renderAt";
import { profileIds, type ProfileId } from "../studioOptions";
import ProfileStep from "./ProfileStep";

const labels = ["Ecuador 72%", "Peru 68%", "Venezuela 76%", "Colombia 64%", "Madagascar 80%", "Custom blend"];

// the step keeps no state of its own, so a small parent holds the choice like the wizard does
function Parent({ start = null, error, onPick }: { start?: ProfileId | null; error?: string; onPick?: (id: ProfileId) => void }) {
  const [value, setValue] = useState<ProfileId | null>(start);
  return (
    <>
      <h2 id="step-heading">Choose your cacao profile</h2>
      <ProfileStep
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

describe("ProfileStep", () => {
  it("offers the six profiles of the brief as one group named by the step heading", () => {
    renderPiece(<Parent />);

    const group = screen.getByRole("radiogroup", { name: "Choose your cacao profile" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([...profileIds]);
    for (const label of labels) {
      expect(screen.getByRole("radio", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("shows the tasting notes and the origin under each profile name", () => {
    renderPiece(<Parent />);

    expect(screen.getByRole("radio", { name: /Ecuador 72%/ })).toHaveAccessibleName(/Berry, jasmine \(Esmeraldas Province\)/);
    expect(screen.getByRole("radio", { name: /Custom blend/ })).toHaveAccessibleName(/Multi-origin, specify on review/);
  });

  it("starts with nothing chosen", () => {
    renderPiece(<Parent />);

    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
  });

  it("tells the parent which profile was chosen, and shows the choice", async () => {
    const user = userEvent.setup();
    const picks: ProfileId[] = [];
    renderPiece(<Parent onPick={(id) => picks.push(id)} />);

    await user.click(screen.getByRole("radio", { name: /Madagascar 80%/ }));

    expect(picks).toEqual(["mad"]);
    expect(screen.getByRole("radio", { name: /Madagascar 80%/ })).toBeChecked();
    expect(screen.getAllByRole("radio").filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(1);
  });

  it("changes the choice when another card is chosen", async () => {
    const user = userEvent.setup();
    renderPiece(<Parent start="ecu" />);
    expect(screen.getByRole("radio", { name: /Ecuador 72%/ })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: /Peru 68%/ }));

    expect(screen.getByRole("radio", { name: /Peru 68%/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Ecuador 72%/ })).not.toBeChecked();
  });

  it("can be used with the arrow keys", async () => {
    const user = userEvent.setup();
    renderPiece(<Parent start="ecu" />);

    screen.getByRole("radio", { name: /Ecuador 72%/ }).focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("radio", { name: /Peru 68%/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Peru 68%/ })).toHaveFocus();
  });

  it("shows no error when there is none", () => {
    renderPiece(<Parent />);

    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-describedby");
  });

  it("shows the error under the cards and ties it to the group", () => {
    renderPiece(<Parent error="Choose a cacao profile to continue." />);

    const group = screen.getByRole("radiogroup");
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription("Choose a cacao profile to continue.");
    expect(screen.getByText("Choose a cacao profile to continue.")).toBeInTheDocument();
  });

  it("is in Spanish on the Spanish address", () => {
    renderPiece(<Parent />, "/es/wholesale/studio");

    expect(screen.getByRole("radio", { name: new RegExp(es.studio.profiles.custom.label) })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: new RegExp(es.studio.profiles.ecu.sub.replace(/[()]/g, "\\$&")) })).toBeInTheDocument();
  });
});
