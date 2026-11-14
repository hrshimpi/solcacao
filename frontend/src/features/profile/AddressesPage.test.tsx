import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFakeServer, retailAccount, type FakeAddress } from "../../test/fakeServer";
import { renderAt, sessionFor } from "../../test/renderAt";

const home: FakeAddress = { id: "64b7f0c2a1b2c3d4e5f60901", label: "Home", street: "12 Cacao Lane", city: "Arlington", state: "TX", postalCode: "76010", country: "United States", isDefault: true };
const office: FakeAddress = { id: "64b7f0c2a1b2c3d4e5f60902", label: "Office", street: "500 Main St", street2: "Suite 4", city: "Dallas", state: "TX", postalCode: "75201", country: "United States", isDefault: false };

async function openAddresses(addresses: FakeAddress[] = [home, office], path = "/en/profile/addresses") {
  const user = userEvent.setup();
  const server = installFakeServer([retailAccount]);
  server.addresses = addresses.map((address) => ({ ...address }));
  const result = renderAt(path, { user: sessionFor(server, server.accounts[0]) });
  await screen.findByRole("heading", { level: 1 });
  return { user, server, ...result };
}

// the header and the footer have lists too, so only the content of the page is looked at
const page = () => within(screen.getByRole("main"));
const items = () => page().getAllByRole("listitem");

const answer = (status: number, code: string, message = "No.", details: unknown[] = []) => new Response(JSON.stringify({ error: { code, message, details } }), { status });

async function fillAddress(user: ReturnType<typeof userEvent.setup>, values: Partial<Record<"label" | "street" | "street2" | "city" | "state" | "postalCode" | "country", string>> = {}) {
  const all = { label: "Studio", street: "9 Bean St", street2: "", city: "Austin", state: "TX", postalCode: "78701", country: "United States", ...values };
  await user.type(screen.getByLabelText(/Name for this address/), all.label);
  await user.type(screen.getByLabelText(/Street address/), all.street);
  if (all.street2) await user.type(screen.getByLabelText(/Apartment, suite/), all.street2);
  await user.type(screen.getByLabelText(/^City/), all.city);
  await user.type(screen.getByLabelText(/State or region/), all.state);
  await user.type(screen.getByLabelText(/Zip code/), all.postalCode);
  await user.type(screen.getByLabelText(/^Country/), all.country);
}

describe("the addresses page", () => {
  it("lists the addresses of the account, the default one marked in words", async () => {
    await openAddresses();

    const [first, second] = items();
    expect(items()).toHaveLength(2);
    expect(within(first).getByRole("heading", { level: 2, name: "Home" })).toBeInTheDocument();
    expect(within(first).getByText("Default")).toBeInTheDocument();
    expect(within(first).getByText(/12 Cacao Lane/)).toBeInTheDocument();
    expect(within(first).getByText(/Arlington, TX 76010/)).toBeInTheDocument();
    expect(within(second).getByText(/Suite 4/)).toBeInTheDocument();
    expect(within(second).queryByText("Default")).not.toBeInTheDocument();
  });

  it("has one h1, a page title, and a link back to the profile", async () => {
    await openAddresses();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(document.title).toBe("Your addresses | SolCacao");
    expect(screen.getByRole("link", { name: "Back to your profile" })).toHaveAttribute("href", "/en/profile");
  });

  it("reads the addresses from the server with the token", async () => {
    const { server } = await openAddresses();

    expect(server.callsTo("GET", "/api/users/me/addresses")).toHaveLength(1);
    expect(server.callsTo("GET", "/api/users/me/addresses")[0].headers.authorization).toBe("Bearer token-0");
  });

  it("says that there are none, and offers to add one", async () => {
    await openAddresses([]);

    expect(await screen.findByText("You have no saved addresses yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add an address" })).toBeInTheDocument();
  });

  it("shows a loading message while the addresses are on their way", async () => {
    const user = userEvent.setup();
    const server = installFakeServer([retailAccount]);
    let release: (response: Response) => void = () => {};
    server.override = (call) => (call.path === "/api/users/me/addresses" ? (new Promise<Response>((resolve) => (release = resolve)) as unknown as Response) : undefined);
    renderAt("/en/profile/addresses", { user: sessionFor(server, server.accounts[0]) });

    expect(await page().findByRole("status")).toHaveTextContent("Loading your addresses...");
    release(new Response(JSON.stringify({ addresses: [home] }), { status: 200 }));

    expect(await screen.findByRole("heading", { level: 2, name: "Home" })).toBeInTheDocument();
    expect(user).toBeDefined();
  });

  it("says that the addresses could not be loaded, and loads them again on request", async () => {
    const user = userEvent.setup();
    const server = installFakeServer([retailAccount]);
    server.addresses = [{ ...home }];
    let fail = true;
    server.override = (call) => (call.method === "GET" && call.path === "/api/users/me/addresses" && fail ? answer(500, "INTERNAL_ERROR") : undefined);
    renderAt("/en/profile/addresses", { user: sessionFor(server, server.accounts[0]) });

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load your addresses.");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 2, name: "Home" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not show an address that is not in the shape it knows", async () => {
    const user = userEvent.setup();
    const server = installFakeServer([retailAccount]);
    server.override = (call) => (call.path === "/api/users/me/addresses" ? new Response(JSON.stringify({ addresses: [home, { id: 5 }, null, "x", { ...office, street: undefined }] }), { status: 200 }) : undefined);
    renderAt("/en/profile/addresses", { user: sessionFor(server, server.accounts[0]) });

    await screen.findByRole("heading", { level: 2, name: "Home" });
    expect(items()).toHaveLength(1);
    expect(user).toBeDefined();
  });

  it("sends somebody who is not signed in to the sign in page, which brings them back", async () => {
    installFakeServer();
    const { router } = renderAt("/en/profile/addresses");

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("?next=%2Fprofile%2Faddresses");
  });

  it("is written in Spanish for the Spanish address", async () => {
    await openAddresses([home], "/es/profile/addresses");

    expect(screen.getByRole("heading", { level: 1, name: "Direcciones de envío" })).toBeInTheDocument();
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar una dirección" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a tu perfil" })).toHaveAttribute("href", "/es/profile");
  });
});

describe("adding an address", () => {
  it("opens a form, sends it to the server, and shows the new address", async () => {
    const { user, server } = await openAddresses([home]);

    await user.click(screen.getByRole("button", { name: "Add an address" }));
    await waitFor(() => expect(screen.getByLabelText(/Name for this address/)).toHaveFocus());
    await fillAddress(user, { street2: "Suite 1" });
    await user.click(screen.getByRole("button", { name: "Save address" }));

    expect(await screen.findByRole("heading", { level: 2, name: "Studio" })).toBeInTheDocument();
    expect(server.callsTo("POST", "/api/users/me/addresses")[0].body).toEqual({ label: "Studio", street: "9 Bean St", street2: "Suite 1", city: "Austin", state: "TX", postalCode: "78701", country: "United States" });
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Add an address" })).toHaveFocus());
  });

  it("makes the first address the default, and a later one only when asked", async () => {
    const { user, server } = await openAddresses([]);

    await user.click(await screen.findByRole("button", { name: "Add an address" }));
    await fillAddress(user);
    await user.click(screen.getByRole("button", { name: "Save address" }));
    expect(await screen.findByText("Default")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add an address" }));
    await fillAddress(user, { label: "Office", street: "1 Main St" });
    await user.click(screen.getByLabelText("Make this my default address"));
    await user.click(screen.getByRole("button", { name: "Save address" }));

    await screen.findByRole("heading", { level: 2, name: "Office" });
    expect(server.callsTo("POST", "/api/users/me/addresses")[1].body).toMatchObject({ isDefault: true });
    expect(screen.getAllByText("Default")).toHaveLength(1);
    expect(within(items().find((item) => within(item).queryByText("Default"))!).getByRole("heading", { name: "Office" })).toBeInTheDocument();
  });

  it("does not send a form with mistakes, and shows them on the fields", async () => {
    const { user, server } = await openAddresses([]);

    await user.click(await screen.findByRole("button", { name: "Add an address" }));
    await user.type(screen.getByLabelText(/Zip code/), "<>");
    await user.click(screen.getByRole("button", { name: "Save address" }));

    expect(screen.getByLabelText(/Name for this address/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/Street address/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/Zip code/)).toHaveAccessibleDescription("Use only letters, numbers, spaces and dashes.");
    expect(screen.getByLabelText(/Name for this address/)).toHaveFocus();
    expect(server.callsTo("POST", "/api/users/me/addresses")).toHaveLength(0);
  });

  it("closes the form without saving, and asks nothing of the server", async () => {
    const { user, server } = await openAddresses([home]);

    await user.click(screen.getByRole("button", { name: "Add an address" }));
    await user.type(screen.getByLabelText(/Name for this address/), "Studio");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText(/Name for this address/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Add an address" })).toHaveFocus());
    expect(server.callsTo("POST", "/api/users/me/addresses")).toHaveLength(0);
  });

  it("puts a problem that the server finds on its field", async () => {
    const { user, server } = await openAddresses([]);
    server.override = (call) => (call.method === "POST" && call.path === "/api/users/me/addresses" ? answer(400, "VALIDATION_ERROR", "Bad zip.", [{ field: "postalCode", message: "Bad zip." }]) : undefined);

    await user.click(await screen.findByRole("button", { name: "Add an address" }));
    await fillAddress(user);
    await user.click(screen.getByRole("button", { name: "Save address" }));

    await waitFor(() => expect(screen.getByLabelText(/Zip code/)).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByLabelText(/Zip code/)).toHaveFocus();
  });

  it.each([
    ["a server error", () => answer(500, "INTERNAL_ERROR"), "We couldn't save the address. Please try again."],
    ["the limit of addresses", () => answer(409, "ADDRESS_LIMIT"), "You can keep up to 10 addresses. Delete one to add another."],
    ["a server that cannot be reached", () => Promise.reject(new TypeError("Failed to fetch")), "We couldn't reach the server. Check your connection and try again."],
  ])("explains %s above the form, and keeps what was typed", async (_what, respond, message) => {
    const { user, server } = await openAddresses([]);
    server.override = (call) => (call.method === "POST" ? (respond() as unknown as Response) : undefined);

    await user.click(await screen.findByRole("button", { name: "Add an address" }));
    await fillAddress(user);
    await user.click(screen.getByRole("button", { name: "Save address" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText(/Street address/)).toHaveValue("9 Bean St");
  });

  it("does not offer a form at the limit of 10, and says why", async () => {
    const many = Array.from({ length: 10 }, (_, index) => ({ ...office, id: `64b7f0c2a1b2c3d4e5f6${String(1000 + index)}`, label: `Place ${index}`, isDefault: index === 0 }));
    await openAddresses(many);

    expect(screen.queryByRole("button", { name: "Add an address" })).not.toBeInTheDocument();
    expect(screen.getByText("You can keep up to 10 addresses. Delete one to add another.")).toBeInTheDocument();
  });
});

describe("changing an address", () => {
  it("opens the form with its values, saves the change, and shows it", async () => {
    const { user, server } = await openAddresses();

    await user.click(screen.getByRole("button", { name: "Edit Office" }));
    const street = screen.getByLabelText(/Street address/);
    expect(street).toHaveValue("500 Main St");
    expect(screen.getByLabelText(/Apartment, suite/)).toHaveValue("Suite 4");
    expect(screen.queryByLabelText("Make this my default address")).not.toBeInTheDocument();
    await user.clear(street);
    await user.type(street, "501 Main St");
    await user.click(screen.getByRole("button", { name: "Save address" }));

    expect(await screen.findByText(/501 Main St/)).toBeInTheDocument();
    expect(server.callsTo("PATCH", `/api/users/me/addresses/${office.id}`)[0].body).toMatchObject({ street: "501 Main St", label: "Office" });
    expect(screen.queryByLabelText(/Street address/)).not.toBeInTheDocument();
  });

  it("takes the second line away when it is emptied", async () => {
    const { user, server } = await openAddresses();

    await user.click(screen.getByRole("button", { name: "Edit Office" }));
    await user.clear(screen.getByLabelText(/Apartment, suite/));
    await user.click(screen.getByRole("button", { name: "Save address" }));

    await waitFor(() => expect(screen.queryByText(/Suite 4/)).not.toBeInTheDocument());
    expect(server.callsTo("PATCH", `/api/users/me/addresses/${office.id}`)[0].body).toMatchObject({ street2: "" });
  });

  it("names every button after the address it is for", async () => {
    await openAddresses();

    for (const name of ["Edit Home", "Delete Home", "Edit Office", "Delete Office", "Make Office the default"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "Make Home the default" })).not.toBeInTheDocument();
  });
});

describe("the default address", () => {
  it("is changed with a button, and the marker moves", async () => {
    const { user, server } = await openAddresses();

    await user.click(screen.getByRole("button", { name: "Make Office the default" }));

    await waitFor(() => {
      const defaultItem = items().find((item) => within(item).queryByText("Default"));
      expect(within(defaultItem!).getByRole("heading", { name: "Office" })).toBeInTheDocument();
    });
    expect(screen.getAllByText("Default")).toHaveLength(1);
    expect(server.callsTo("POST", `/api/users/me/addresses/${office.id}/default`)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Make Home the default" })).toBeInTheDocument();
  });

  it("says when it could not be changed, and the marker stays", async () => {
    const { user, server } = await openAddresses();
    server.override = (call) => (call.method === "POST" && call.path.endsWith("/default") ? answer(500, "INTERNAL_ERROR") : undefined);

    await user.click(screen.getByRole("button", { name: "Make Office the default" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't change the default address. Please try again.");
    expect(within(items()[0]).getByText("Default")).toBeInTheDocument();
  });
});

describe("deleting an address", () => {
  it("asks first, and then removes it", async () => {
    const { user, server } = await openAddresses();

    await user.click(screen.getByRole("button", { name: "Delete Office" }));
    const question = screen.getByRole("group", { name: "Delete Office" });
    expect(within(question).getByText("Delete Office? This can't be undone.")).toBeInTheDocument();
    expect(server.callsTo("DELETE", `/api/users/me/addresses/${office.id}`)).toHaveLength(0);
    await user.click(within(question).getByRole("button", { name: "Yes, delete it" }));

    await waitFor(() => expect(screen.queryByRole("heading", { level: 2, name: "Office" })).not.toBeInTheDocument());
    expect(server.callsTo("DELETE", `/api/users/me/addresses/${office.id}`)).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole("button", { name: "Add an address" })).toHaveFocus());
  });

  it("keeps the address when the question is answered with no", async () => {
    const { user, server } = await openAddresses();

    await user.click(screen.getByRole("button", { name: "Delete Office" }));
    await user.click(screen.getByRole("button", { name: "Keep it" }));

    expect(screen.queryByRole("group", { name: "Delete Office" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Office" })).toBeInTheDocument();
    expect(server.callsTo("DELETE", `/api/users/me/addresses/${office.id}`)).toHaveLength(0);
  });

  it("hands the default to another address when the default is deleted", async () => {
    const { user } = await openAddresses();

    await user.click(screen.getByRole("button", { name: "Delete Home" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete it" }));

    await waitFor(() => expect(screen.queryByRole("heading", { level: 2, name: "Home" })).not.toBeInTheDocument());
    expect(within(items()[0]).getByText("Default")).toBeInTheDocument();
  });

  it("says when it could not be deleted, and the address stays", async () => {
    const { user, server } = await openAddresses();
    server.override = (call) => (call.method === "DELETE" ? answer(500, "INTERNAL_ERROR") : undefined);

    await user.click(screen.getByRole("button", { name: "Delete Office" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete it" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't delete the address. Please try again.");
    expect(screen.getByRole("heading", { level: 2, name: "Office" })).toBeInTheDocument();
  });
});
