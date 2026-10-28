import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "../../../lib/useForm";
import { renderPiece } from "../../../test/renderAt";
import { reviewRules, type ReviewField } from "../studioRules";
import ReviewStep from "./ReviewStep";

function makeFile(name: string, size = 2048) {
  const file = new File(["x"], name, { lastModified: 1000 });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

type Values = Record<ReviewField, string>;

interface ParentProps {
  files?: File[];
  start?: Partial<Values>;
  onSubmit?: (values: Values) => void;
}

// the step gets its fields from the form hook, so a small parent with a form works like the wizard does
function Parent({ files = [], start, onSubmit = () => {} }: ParentProps) {
  const form = useForm<ReviewField>({
    initial: { companyName: "", contactName: "", units: "", notes: "", ...start },
    rules: reviewRules,
    onSubmit,
  });
  return (
    <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate>
      <ReviewStep summary={{ profile: "Ecuador 72%", packaging: "Rigid gift box", files }} field={form.field} />
      <button type="submit">Send</button>
    </form>
  );
}

const company = () => screen.getByLabelText(/Company name/);
const contact = () => screen.getByLabelText(/Contact name/);
const units = () => screen.getByLabelText(/Estimated units/);
const notes = () => screen.getByLabelText(/Additional notes/);

describe("ReviewStep", () => {
  describe("summary", () => {
    it("shows the profile and the packaging that were chosen", () => {
      renderPiece(<Parent />);

      expect(screen.getByText("Cacao profile").nextElementSibling).toHaveTextContent("Ecuador 72%");
      expect(screen.getByText("Packaging").nextElementSibling).toHaveTextContent("Rigid gift box");
    });

    it("says when no brand files were added", () => {
      renderPiece(<Parent />);

      expect(screen.getByText("Brand assets").nextElementSibling).toHaveTextContent("None uploaded");
    });

    it("counts the brand files and lists their names", () => {
      renderPiece(<Parent files={[makeFile("logo.pdf"), makeFile("mark.png")]} />);

      const row = screen.getByText("Brand assets").nextElementSibling!;
      expect(row).toHaveTextContent("2 files");
      expect(row).toHaveTextContent("logo.pdf");
      expect(row).toHaveTextContent("mark.png");
    });

    it("says one file in the singular", () => {
      renderPiece(<Parent files={[makeFile("logo.pdf")]} />);

      expect(screen.getByText("Brand assets").nextElementSibling).toHaveTextContent(/^1 file/);
    });
  });

  describe("fields", () => {
    it("asks for the company, the contact and the units, and lets the notes be empty", () => {
      renderPiece(<Parent />);

      expect(company()).toBeRequired();
      expect(contact()).toBeRequired();
      expect(units()).toBeRequired();
      expect(notes()).not.toBeRequired();
    });

    it("lets the browser fill in the company and the contact", () => {
      renderPiece(<Parent />);

      expect(company()).toHaveAttribute("autocomplete", "organization");
      expect(contact()).toHaveAttribute("autocomplete", "name");
    });

    it("shows the usual minimum run as a hint for the units", () => {
      renderPiece(<Parent />);

      expect(units()).toHaveAttribute("inputmode", "numeric");
      expect(units()).toHaveAccessibleDescription("Our usual minimum run is 500 units.");
    });

    it("shows values that were there before, for example from a saved draft", () => {
      renderPiece(<Parent start={{ companyName: "Hacienda Brands", contactName: "Isabel", units: "800", notes: "Gold foil" }} />);

      expect(company()).toHaveValue("Hacienda Brands");
      expect(contact()).toHaveValue("Isabel");
      expect(units()).toHaveValue("800");
      expect(notes()).toHaveValue("Gold foil");
    });
  });

  describe("checks", () => {
    it("blocks an empty form, names the three required fields and puts focus on the first", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderPiece(<Parent onSubmit={onSubmit} />);

      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(screen.getAllByText("This field is required.")).toHaveLength(3);
      expect(company()).toHaveAttribute("aria-invalid", "true");
      expect(contact()).toHaveAttribute("aria-invalid", "true");
      expect(units()).toHaveAttribute("aria-invalid", "true");
      expect(notes()).not.toHaveAttribute("aria-invalid");
      expect(company()).toHaveFocus();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("sends the values when everything is filled in", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderPiece(<Parent onSubmit={onSubmit} />);

      await user.type(company(), "Hacienda Brands");
      await user.type(contact(), "Isabel Reyes");
      await user.type(units(), "800");
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(onSubmit).toHaveBeenCalledWith({ companyName: "Hacienda Brands", contactName: "Isabel Reyes", units: "800", notes: "" });
    });

    it.each([
      ["abc", "Enter a whole number."],
      ["12.5", "Enter a whole number."],
      ["0", "Enter 1 or more."],
      ["10000001", "Enter 10,000,000 or less."],
    ])("does not take %s as the units", async (value, message) => {
      const user = userEvent.setup();
      renderPiece(<Parent />);

      await user.type(units(), value);
      await user.tab();

      expect(screen.getByText(message)).toBeInTheDocument();
      expect(units()).toHaveAttribute("aria-invalid", "true");
      expect(units()).toHaveAccessibleDescription(new RegExp(message.replace(/[.]/g, "\\.")));
    });

    it("does not take a company of one character, or one that is only spaces", async () => {
      const user = userEvent.setup();
      renderPiece(<Parent />);

      await user.type(company(), "A");
      await user.tab();
      expect(screen.getByText("Use at least 2 characters.")).toBeInTheDocument();

      await user.clear(company());
      await user.type(company(), "   ");
      await user.tab();
      expect(company()).toHaveAccessibleDescription("This field is required.");
    });

    it("does not take a contact name over 80 characters", () => {
      renderPiece(<Parent />);

      fireEvent.change(contact(), { target: { value: "a".repeat(81) } });
      fireEvent.blur(contact());

      expect(screen.getByText("Use no more than 80 characters.")).toBeInTheDocument();
    });

    it("does not take notes over 2000 characters", () => {
      renderPiece(<Parent />);

      fireEvent.change(notes(), { target: { value: "a".repeat(2001) } });
      fireEvent.blur(notes());

      expect(screen.getByText("Use no more than 2000 characters.")).toBeInTheDocument();
    });
  });

  describe("the warning for a small run", () => {
    const warning = /under our usual minimum of 500 units/;

    it("is shown for 100 units once the person leaves the field", async () => {
      const user = userEvent.setup();
      renderPiece(<Parent />);

      await user.type(units(), "100");
      await user.tab();

      expect(units()).toHaveAccessibleDescription(warning);
    });

    it("is not an error: the field stays valid", async () => {
      const user = userEvent.setup();
      renderPiece(<Parent />);

      await user.type(units(), "100");
      await user.tab();

      expect(units()).not.toHaveAttribute("aria-invalid");
      expect(screen.queryByText("Enter 500 or more.")).not.toBeInTheDocument();
    });

    it("waits until the person has left the field, so it does not flash while 500 is typed", async () => {
      const user = userEvent.setup();
      renderPiece(<Parent />);

      await user.type(units(), "5");
      expect(units()).not.toHaveAccessibleDescription(warning);

      await user.type(units(), "00");
      await user.tab();
      expect(units()).not.toHaveAccessibleDescription(warning);
    });

    it.each(["500", "800", "10000000"])("is not shown for %s units", async (value) => {
      const user = userEvent.setup();
      renderPiece(<Parent />);

      await user.type(units(), value);
      await user.tab();

      expect(units()).not.toHaveAccessibleDescription(warning);
    });

    it("is not shown when the units are empty or wrong, where the error speaks instead", async () => {
      const user = userEvent.setup();
      renderPiece(<Parent />);

      await user.click(units());
      await user.tab();
      await user.type(units(), "0");
      await user.tab();

      expect(units()).not.toHaveAccessibleDescription(warning);
      expect(screen.getByText("Enter 1 or more.")).toBeInTheDocument();
    });

    it("goes away when the units are raised to 500, and comes back when they are lowered", async () => {
      const user = userEvent.setup();
      renderPiece(<Parent />);
      await user.type(units(), "100");
      await user.tab();
      expect(units()).toHaveAccessibleDescription(warning);

      await user.clear(units());
      await user.type(units(), "600");
      expect(units()).not.toHaveAccessibleDescription(warning);

      await user.clear(units());
      await user.type(units(), "300");
      expect(units()).toHaveAccessibleDescription(warning);
    });

    it("does not stop the request from being sent", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderPiece(<Parent onSubmit={onSubmit} />);

      await user.type(company(), "Hacienda Brands");
      await user.type(contact(), "Isabel Reyes");
      await user.type(units(), "100");
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ units: "100" }));
    });

    it("is shown at once when a small number comes back from a saved draft", () => {
      renderPiece(<Parent start={{ units: "100" }} />);

      expect(units()).toHaveAccessibleDescription(warning);
    });

    it("is announced to a screen reader", async () => {
      const user = userEvent.setup();
      renderPiece(<Parent />);

      await user.type(units(), "100");
      await user.tab();

      expect(screen.getByRole("status")).toHaveTextContent(warning);
    });
  });

  describe("in Spanish", () => {
    it("has the Spanish labels, the warning and the limit message", async () => {
      const user = userEvent.setup();
      renderPiece(<Parent files={[]} />, "/es/wholesale/studio");

      expect(screen.getByLabelText(/Nombre de la empresa/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Unidades estimadas/)).toHaveAccessibleDescription("Nuestra tirada mínima habitual es de 500 unidades.");

      await user.type(screen.getByLabelText(/Unidades estimadas/), "100");
      await user.tab();
      expect(screen.getByLabelText(/Unidades estimadas/)).toHaveAccessibleDescription(/menos que nuestro mínimo habitual de 500 unidades/);

      await user.clear(screen.getByLabelText(/Unidades estimadas/));
      await user.type(screen.getByLabelText(/Unidades estimadas/), "10000001");
      await user.tab();
      expect(screen.getByText("Escribe 10.000.000 o menos.")).toBeInTheDocument();
    });
  });
});
