import { configure, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FakeOrder } from "../../test/fakeOrders";
import { installFakeServer, retailAccount, type FakeAccount, type FakeServer } from "../../test/fakeServer";
import { fixtureId, fixtureRecords } from "../../test/productFixtures";
import { renderAt, sessionFor } from "../../test/renderAt";

const admin: FakeAccount = { id: "64b7f0c2a1b2c3d4e5f60abc", email: "admin@solcacao.example.com", password: "correct horse 42", name: "Demo Admin", accountType: "retail", role: "admin" };

const cents = (slug: string) => fixtureRecords.find((record) => record.product.slug === slug)!.product.price;

let count = 0;
// an order of the retail account in the fake shop
function makeOrder(server: FakeServer, overrides: Partial<FakeOrder> = {}): FakeOrder {
  count += 1;
  const id = `64b7f0c2a1b2c3d4e5f6${count.toString(16).padStart(4, "0")}`;
  const subtotal = cents("ecuador-72") * 2;
  const order: FakeOrder = {
    id,
    number: `SC-${id.slice(-8).toUpperCase()}`,
    userId: retailAccount.id,
    email: retailAccount.email,
    customerName: retailAccount.name,
    status: "paid",
    lines: [{ kind: "product", productIds: [fixtureId("ecuador-72")], quantity: 2, unitPrice: cents("ecuador-72"), lineTotal: subtotal }],
    address: { fullName: "Isabel Vasquez", phone: null, label: "Home", street: "12 Cacao Lane", street2: null, city: "Arlington", state: "TX", postalCode: "76010", country: "United States" },
    method: "standard",
    totals: { subtotal, shipping: 595, tax: 198, total: subtotal + 595 + 198 },
    payment: { brand: "visa", last4: "4242", reference: "demo_1", status: "paid" },
    note: null,
    history: [{ status: "paid", at: "2026-11-10T15:00:00.000Z" }],
    createdAt: `2026-11-${String(10 + (count % 15)).padStart(2, "0")}T15:00:00.000Z`,
    ...overrides,
  };
  server.orders.push(order);
  return order;
}

async function open(path: string, prepare: (server: FakeServer) => void = () => {}, who: FakeAccount = admin, heading = true) {
  const user = userEvent.setup();
  const server = installFakeServer([who, retailAccount]);
  const signedIn = sessionFor(server, server.accounts[0]);
  prepare(server);
  const result = renderAt(path, { user: signedIn });
  if (heading) await screen.findByRole("heading", { level: 1 });
  return { user, server, ...result };
}

const page = () => within(screen.getByRole("main"));
const failing = (status: number, code: string, details: unknown[] = []) => new Response(JSON.stringify({ error: { code, message: "No.", details } }), { status });

describe("the dashboard: who can open it", () => {
  it("sends somebody who is not signed in to sign in, and brings them back", async () => {
    installFakeServer();
    const { router } = renderAt("/en/admin");

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("?next=%2Fadmin");
  });

  it("tells a person who is signed in but is not an admin that the page is for the team", async () => {
    await open("/en/admin", () => {}, retailAccount);

    expect(await screen.findByRole("heading", { level: 1, name: "This page is for the team" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Admin sections" })).not.toBeInTheDocument();
  });

  it("opens for an admin, with the sections as links and the current one marked", async () => {
    await open("/en/admin/orders");

    const sections = within(screen.getByRole("navigation", { name: "Admin sections" }));
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(sections.getByRole("link", { name: "Orders" })).toHaveAttribute("aria-current", "page");
    expect(sections.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(sections.getByRole("link", { name: "Products" })).toHaveAttribute("href", "/en/admin/products");
  });

  it("is reached from the profile page of an admin, and not from the one of anybody else", async () => {
    await open("/en/profile");
    expect(page().getByRole("link", { name: /Open the admin dashboard/ })).toHaveAttribute("href", "/en/admin");
  });

  it("is not offered on the profile page of a customer", async () => {
    await open("/en/profile", () => {}, retailAccount);
    expect(page().queryByRole("link", { name: /Open the admin dashboard/ })).not.toBeInTheDocument();
  });
});

describe("the dashboard: the overview", () => {
  it("shows the money and the orders, without the cancelled ones", async () => {
    await open("/en/admin", (server) => {
      makeOrder(server);
      makeOrder(server, { status: "shipped" });
      makeOrder(server, { status: "cancelled" });
    });

    expect(await page().findByText("$63.86")).toBeInTheDocument();
    const orders = page().getByText("Orders", { selector: "dt" }).parentElement as HTMLElement;
    expect(within(orders).getByText("3")).toBeInTheDocument();
    expect(page().getByText("Per order that was not cancelled")).toBeInTheDocument();
    expect(page().getByText("7 products in the shop")).toBeInTheDocument();
  });

  it("counts the orders of each status", async () => {
    await open("/en/admin", (server) => {
      makeOrder(server);
      makeOrder(server);
      makeOrder(server, { status: "delivered" });
    });

    const section = within(await page().findByRole("region", { name: "Orders by status" }));
    expect(within(section.getByText("Paid").closest("li") as HTMLElement).getByText("2")).toBeInTheDocument();
    expect(within(section.getByText("Delivered").closest("li") as HTMLElement).getByText("1")).toBeInTheDocument();
    expect(within(section.getByText("Cancelled").closest("li") as HTMLElement).getByText("0")).toBeInTheDocument();
  });

  it("lists what is low on stock, and what is sold out", async () => {
    await open("/en/admin");

    const section = within(await page().findByRole("region", { name: "Low on stock" }));
    expect(section.getByText("Venezuela 76%")).toBeInTheDocument();
    expect(section.getByText("6 left")).toBeInTheDocument();
    expect(section.getByText("Fleur de Sel Bar")).toBeInTheDocument();
    expect(section.getByText("Sold out")).toBeInTheDocument();
    expect(section.getByRole("link", { name: "Manage stock" })).toHaveAttribute("href", "/en/admin/products");
  });

  it("lists the latest orders with a link to each", async () => {
    let order: FakeOrder;
    await open("/en/admin", (server) => {
      order = makeOrder(server);
    });

    const section = within(await page().findByRole("region", { name: "Latest orders" }));
    expect(section.getByRole("link", { name: order!.number })).toHaveAttribute("href", `/en/admin/orders/${order!.id}`);
    expect(section.getByText(/Isabel Vasquez/)).toBeInTheDocument();
  });

  it("says that there are no orders yet", async () => {
    await open("/en/admin");

    expect(await page().findByText("There are no orders yet.")).toBeInTheDocument();
  });

  it("says that the numbers could not be loaded, and loads them after a second try", async () => {
    const { user, server } = await open("/en/admin", (fake) => {
      fake.override = (call) => (call.path.startsWith("/api/admin/stats") ? failing(500, "INTERNAL_ERROR") : undefined);
    });

    expect(await page().findByText("We couldn't load this. Please try again.")).toBeInTheDocument();
    server.override = null;
    await user.click(page().getByRole("button", { name: "Try again" }));

    expect(await page().findByRole("region", { name: "Latest orders" })).toBeInTheDocument();
  });
});

describe("the dashboard: the orders", () => {
  it("lists every order, with the customer, the total and the status, and links to each", async () => {
    let order: FakeOrder;
    await open("/en/admin/orders", (server) => {
      order = makeOrder(server);
      makeOrder(server, { status: "shipped", customerName: "Marcus Lindqvist", email: "marcus@example.com" });
    });

    expect(await page().findByText("2 orders")).toBeInTheDocument();
    const rows = page().getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(page().getByRole("link", { name: order!.number })).toHaveAttribute("href", `/en/admin/orders/${order!.id}`);
    expect(page().getByText("marcus@example.com")).toBeInTheDocument();
    expect(page().getAllByText("$31.93").length).toBe(2);
  });

  it("shows only the orders of a status when it is chosen", async () => {
    const { user } = await open("/en/admin/orders", (server) => {
      makeOrder(server);
      makeOrder(server, { status: "shipped" });
    });
    await page().findByText("2 orders");

    await user.selectOptions(page().getByLabelText("Status"), "shipped");

    expect(await page().findByText("1 order")).toBeInTheDocument();
    expect(page().getAllByRole("row")).toHaveLength(2);
  });

  it("finds an order by a part of the name, the email or the number", async () => {
    const { user } = await open("/en/admin/orders", (server) => {
      makeOrder(server);
      makeOrder(server, { customerName: "Marcus Lindqvist", email: "marcus@example.com" });
    });
    await page().findByText("2 orders");

    await user.type(page().getByLabelText("Search by number, email or name"), "marcus");

    expect(await page().findByText("1 order")).toBeInTheDocument();
    expect(page().getByText("marcus@example.com")).toBeInTheDocument();
  });

  it("says that no order matches", async () => {
    const { user } = await open("/en/admin/orders", (server) => {
      makeOrder(server);
    });
    await page().findByText("1 order");

    await user.type(page().getByLabelText("Search by number, email or name"), "nobody");

    expect(await page().findByText("No orders match.")).toBeInTheDocument();
  });

  it("shows fifteen to a page and moves between the pages", async () => {
    const { user } = await open("/en/admin/orders", (server) => {
      for (let index = 0; index < 17; index++) makeOrder(server);
    });
    await page().findByText("17 orders");
    expect(page().getAllByRole("row")).toHaveLength(16);
    expect(page().getByText("Page 1 of 2")).toBeInTheDocument();

    await user.click(page().getByRole("button", { name: "Next" }));

    expect(await page().findByText("Page 2 of 2")).toBeInTheDocument();
    expect(page().getAllByRole("row")).toHaveLength(3);
    expect(page().getByRole("button", { name: "Next" })).toBeDisabled();
  });
});

describe("the dashboard: one order", () => {
  async function show(overrides: Partial<FakeOrder> = {}) {
    const user = userEvent.setup();
    const server = installFakeServer([admin, retailAccount]);
    const signedIn = sessionFor(server, server.accounts[0]);
    const order = makeOrder(server, overrides);
    renderAt(`/en/admin/orders/${order.id}`, { user: signedIn });
    await screen.findByRole("heading", { level: 2, name: order.number });
    return { user, server, order };
  }

  it("shows what was bought, the customer, where it goes and how it was paid", async () => {
    await show({ note: "Ring twice." });

    expect(page().getByText("Ecuador 72%")).toBeInTheDocument();
    expect(page().getByRole("link", { name: "isabel@example.com" })).toHaveAttribute("href", "mailto:isabel@example.com");
    expect(page().getByText(/12 Cacao Lane/)).toBeInTheDocument();
    expect(page().getByText("Visa ending in 4242")).toBeInTheDocument();
    expect(page().getByText("Ring twice.")).toBeInTheDocument();
  });

  it("moves the order along, one step at a time, with the buttons that the rules allow", async () => {
    const { user, server, order } = await show();
    expect(page().queryByRole("button", { name: "Mark as shipped" })).not.toBeInTheDocument();

    await user.click(page().getByRole("button", { name: "Start packing" }));
    expect(await page().findByRole("button", { name: "Mark as shipped" })).toBeInTheDocument();
    expect(page().queryByRole("button", { name: "Start packing" })).not.toBeInTheDocument();

    await user.click(page().getByRole("button", { name: "Mark as shipped" }));
    await user.click(await page().findByRole("button", { name: "Mark as delivered" }));

    expect(await page().findByText("This order is finished. There is nothing more to do.")).toBeInTheDocument();
    expect(server.orders.find((entry) => entry.id === order.id)?.status).toBe("delivered");
    expect(server.orders.find((entry) => entry.id === order.id)?.history.map((entry) => entry.status)).toEqual(["paid", "processing", "shipped", "delivered"]);
  });

  it("cancels after asking, puts the stock back and marks the payment as refunded", async () => {
    const { user, server } = await show();

    await user.click(page().getByRole("button", { name: "Cancel the order" }));
    expect(page().getByText(/The items go back to the shop and the payment is refunded/)).toBeInTheDocument();
    await user.click(page().getByRole("button", { name: "Yes, cancel it" }));

    expect(await page().findByText("Refunded")).toBeInTheDocument();
    expect(server.stock.get("ecuador-72")).toBe(122);
  });

  it("keeps the order when the cancellation is not confirmed", async () => {
    const { user, server, order } = await show();

    await user.click(page().getByRole("button", { name: "Cancel the order" }));
    await user.click(page().getByRole("button", { name: "Keep it" }));

    expect(page().getByRole("button", { name: "Cancel the order" })).toBeInTheDocument();
    expect(server.orders.find((entry) => entry.id === order.id)?.status).toBe("paid");
  });

  it("says that the order could not be changed when somebody changed it first", async () => {
    const { user, server } = await show();
    server.override = (call) => (call.method === "PATCH" ? failing(400, "INVALID_TRANSITION") : undefined);

    await user.click(page().getByRole("button", { name: "Start packing" }));

    expect(await page().findByText(/We couldn't change the order/)).toBeInTheDocument();
  });

  it("has no buttons for an order that is finished", async () => {
    await show({ status: "delivered" });

    expect(page().getByText("This order is finished. There is nothing more to do.")).toBeInTheDocument();
    expect(page().queryByRole("button", { name: /Start packing|Mark as|Cancel the order/ })).not.toBeInTheDocument();
  });
});

describe("the dashboard: the products", () => {
  const row = (name: string) => within(page().getByText(name, { selector: "p" }).closest("tr") as HTMLElement);

  it("lists the products with the price, the stock and whether they are in the shop", async () => {
    await open("/en/admin/products");

    expect(await page().findByText("7 products")).toBeInTheDocument();
    expect(row("Ecuador 72%").getByLabelText("Price of Ecuador 72%, in dollars")).toHaveValue("12.00");
    expect(row("Ecuador 72%").getByLabelText("Stock of Ecuador 72%")).toHaveValue("120");
    expect(row("Ecuador 72%").getByLabelText("Show Ecuador 72% in the shop")).toBeChecked();
    expect(row("Venezuela 76%").getByText("Low")).toBeInTheDocument();
    expect(row("Fleur de Sel Bar").getByText("Sold out")).toBeInTheDocument();
  });

  it("has a Save button that waits for a change that is good", async () => {
    const { user } = await open("/en/admin/products");
    await page().findByText("7 products");
    const save = row("Ecuador 72%").getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    await user.clear(row("Ecuador 72%").getByLabelText("Stock of Ecuador 72%"));
    await user.type(row("Ecuador 72%").getByLabelText("Stock of Ecuador 72%"), "abc");
    expect(save).toBeDisabled();

    await user.clear(row("Ecuador 72%").getByLabelText("Stock of Ecuador 72%"));
    await user.type(row("Ecuador 72%").getByLabelText("Stock of Ecuador 72%"), "80");
    expect(save).toBeEnabled();
  });

  it("saves a new stock", async () => {
    const { user, server } = await open("/en/admin/products");
    await page().findByText("7 products");

    await user.clear(row("Peru 68%").getByLabelText("Stock of Peru 68%"));
    await user.type(row("Peru 68%").getByLabelText("Stock of Peru 68%"), "5");
    await user.click(row("Peru 68%").getByRole("button", { name: "Save" }));

    expect(await row("Peru 68%").findByText("Saved.")).toBeInTheDocument();
    expect(server.stock.get("peru-68")).toBe(5);
    expect(row("Peru 68%").getByText("Low")).toBeInTheDocument();
  });

  it("saves a new price in cents", async () => {
    const { user, server } = await open("/en/admin/products");
    await page().findByText("7 products");

    await user.clear(row("Peru 68%").getByLabelText("Price of Peru 68%, in dollars"));
    await user.type(row("Peru 68%").getByLabelText("Price of Peru 68%, in dollars"), "13.50");
    await user.click(row("Peru 68%").getByRole("button", { name: "Save" }));

    await row("Peru 68%").findByText("Saved.");
    expect(server.prices.get("peru-68")).toBe(1350);
    expect(server.callsTo("PATCH", `/api/staff/products/${fixtureId("peru-68")}`)[0].body).toEqual({ price: 1350, active: true });
  });

  it("switches a product out of the shop and back in", async () => {
    const { user, server } = await open("/en/admin/products");
    await page().findByText("7 products");

    await user.click(row("Colombia 64%").getByLabelText("Show Colombia 64% in the shop"));
    await user.click(row("Colombia 64%").getByRole("button", { name: "Save" }));

    await row("Colombia 64%").findByText("Saved.");
    expect(server.inactive.has("colombia-64")).toBe(true);
    expect(row("Colombia 64%").getByLabelText("Show Colombia 64% in the shop")).not.toBeChecked();
  });

  it("says when a change could not be saved", async () => {
    const { user, server } = await open("/en/admin/products");
    await page().findByText("7 products");
    server.override = (call) => (call.method === "PUT" ? failing(500, "INTERNAL_ERROR") : undefined);

    await user.clear(row("Peru 68%").getByLabelText("Stock of Peru 68%"));
    await user.type(row("Peru 68%").getByLabelText("Stock of Peru 68%"), "5");
    await user.click(row("Peru 68%").getByRole("button", { name: "Save" }));

    expect(await row("Peru 68%").findByText("We couldn't save that. Please try again.")).toBeInTheDocument();
  });

  it("links to the form of a new product", async () => {
    await open("/en/admin/products");

    expect(await page().findByRole("link", { name: "Add a product" })).toHaveAttribute("href", "/en/admin/products/new");
  });
});

describe("the dashboard: a new product", () => {
  // the form has twenty fields, so these tests do a lot of work, and on a busy machine they need more time than the others
  beforeAll(() => configure({ asyncUtilTimeout: 6000 }));
  afterAll(() => configure({ asyncUtilTimeout: 1000 }));
  const slow = { timeout: 30_000 };

  // changes one field of the form
  async function change(user: ReturnType<typeof userEvent.setup>, label: RegExp, value: string) {
    const field = screen.getByLabelText(label);
    await user.clear(field);
    await user.click(field);
    await user.paste(value);
  }

  async function fillIn(user: ReturnType<typeof userEvent.setup>, values: Partial<Record<string, string>> = {}) {
    const all: Record<string, string> = {
      "Slug": "peru-85",
      "SKU": "SC-PER-085",
      "Name (English)": "Peru 85%",
      "Name (Spanish)": "Perú 85%",
      "Cacao percentage": "85",
      "Price in dollars": "15.50",
      "Units in stock": "40",
      "Caption (English)": "Peru, 85% cacao",
      "Caption (Spanish)": "Perú, 85% de cacao",
      "Tasting summary (English)": "dark cocoa, roasted nut",
      "Tasting summary (Spanish)": "cacao oscuro, nuez tostada",
      "Farm (English)": "Cusco cooperative",
      "Farm (Spanish)": "Cooperativa de Cusco",
      "Description (English)": "A deep, intense bar.",
      "Description (Spanish)": "Una barra profunda e intensa.",
      "Photo address": "/sample-chocolates/milk-almond-bar.jpg",
      "Description of the photo (English)": "A dark chocolate bar",
      "Description of the photo (Spanish)": "Una barra de chocolate oscuro",
      "Batch code": "PER-2024-09",
      "Harvest month": "2024-09",
      "Roast month": "2024-10",
      ...values,
    };
    for (const [label, value] of Object.entries(all)) {
      const field = screen.getByLabelText(new RegExp(`^${label.replace(/[()]/g, "\\$&")}`));
      await user.clear(field);
      // pasted, not typed: the form has twenty fields, and typing each letter is slow
      if (value) {
        await user.click(field);
        await user.paste(value);
      }
    }
  }

  it("sends the product as the server wants it, and the product is in the list afterwards", async () => {
    const { user, server } = await open("/en/admin/products/new");
    await user.selectOptions(screen.getByLabelText("Origin"), "peru");
    await user.selectOptions(screen.getByLabelText("Category"), "bar");
    await user.click(screen.getByRole("checkbox", { name: "Nutty" }));
    await user.click(screen.getByRole("checkbox", { name: "Earthy" }));
    await user.click(screen.getByRole("checkbox", { name: "Show on the home page" }));
    await fillIn(user);

    await user.click(screen.getByRole("button", { name: "Add to the shop" }));

    expect(await page().findByText("8 products")).toBeInTheDocument();
    expect(page().getByText("Peru 85%")).toBeInTheDocument();
    expect(server.createdBodies[0]).toEqual({
      slug: "peru-85",
      sku: "SC-PER-085",
      name: { en: "Peru 85%", es: "Perú 85%" },
      caption: { en: "Peru, 85% cacao", es: "Perú, 85% de cacao" },
      tastingSummary: { en: "dark cocoa, roasted nut", es: "cacao oscuro, nuez tostada" },
      imageAlt: { en: "A dark chocolate bar", es: "Una barra de chocolate oscuro" },
      farm: { en: "Cusco cooperative", es: "Cooperativa de Cusco" },
      description: { en: "A deep, intense bar.", es: "Una barra profunda e intensa." },
      origin: "peru",
      originName: { en: "Peru", es: "Perú" },
      percentage: 85,
      category: "bar",
      price: 1550,
      notes: ["nutty", "earthy"],
      thumbnail: "/sample-chocolates/milk-almond-bar.jpg",
      images: ["/sample-chocolates/milk-almond-bar.jpg"],
      batchCode: "PER-2024-09",
      harvestMonth: "2024-09",
      roastMonth: "2024-10",
      featured: true,
      quantity: 40,
    });
  }, slow.timeout);

  it("checks the fields before it asks the server, and focuses the first one that is wrong", async () => {
    const { user, server } = await open("/en/admin/products/new");
    await fillIn(user, { "Slug": "Peru 85", "SKU": "no sku!", "Cacao percentage": "150", "Price in dollars": "free", "Units in stock": "-3", "Photo address": "javascript:alert(1)", "Harvest month": "September", "Name (English)": "" });

    await user.click(screen.getByRole("button", { name: "Add to the shop" }));

    expect(screen.getByLabelText(/^Slug/)).toHaveAccessibleDescription(/Use lower case words joined with dashes, like peru-85\./);
    expect(screen.getByLabelText(/^Slug/)).toHaveFocus();
    expect(screen.getByLabelText(/^SKU/)).toHaveAccessibleDescription(/Use capitals, numbers and dashes/);
    expect(screen.getByLabelText(/^Cacao percentage/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/^Price in dollars/)).toHaveAccessibleDescription("Enter a price like 12.50.");
    expect(screen.getByLabelText(/^Photo address/)).toHaveAccessibleDescription(/Use a web address that starts with https:\/\//);
    expect(screen.getByLabelText(/^Harvest month/)).toHaveAccessibleDescription(/Use a month like 2024-09/);
    expect(screen.getByLabelText(/^Name \(English\)/)).toHaveAttribute("aria-invalid", "true");
    expect(server.callsTo("POST", "/api/staff/products")).toHaveLength(0);
  }, slow.timeout);

  it("says on the slug that it is taken, and on the SKU when that is", async () => {
    const { user } = await open("/en/admin/products/new");
    await fillIn(user, { "Slug": "ecuador-72" });
    await user.click(screen.getByRole("button", { name: "Add to the shop" }));
    expect(await screen.findByText("A product with that slug already exists.")).toBeInTheDocument();

    await change(user, /^Slug/, "peru-85");
    await change(user, /^SKU/, "SC-ECU-072");
    await user.click(screen.getByRole("button", { name: "Add to the shop" }));
    expect(await screen.findByText("A product with that SKU already exists.")).toBeInTheDocument();
  }, slow.timeout);

  it("says that the product could not be added when the server fails, and keeps what was typed", async () => {
    const { user, server } = await open("/en/admin/products/new");
    server.override = (call) => (call.method === "POST" ? failing(500, "INTERNAL_ERROR") : undefined);
    await fillIn(user);

    await user.click(screen.getByRole("button", { name: "Add to the shop" }));

    expect(await screen.findByText("We couldn't add the product. Please look at the fields and try again.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Slug/)).toHaveValue("peru-85");
  }, slow.timeout);

  it("shows a small picture of the photo that was typed, and offers the photos of the project", async () => {
    const { user } = await open("/en/admin/products/new");

    await user.click(screen.getByLabelText(/^Photo address/));
    await user.paste("/sample-chocolates/raw-cacao-beans.jpg");

    expect(document.querySelector('img[src="/sample-chocolates/raw-cacao-beans.jpg"]')).not.toBeNull();
    expect(document.querySelectorAll("#sample-photos option").length).toBeGreaterThanOrEqual(11);
  });
});

describe("the dashboard: the inquiries", () => {
  const inquiry = (overrides: Partial<import("../../test/fakeAdmin").FakeInquiry> = {}): import("../../test/fakeAdmin").FakeInquiry => ({
    id: `64b7f0c2a1b2c3d4e5f6${(count++).toString(16).padStart(4, "0")}`,
    category: "support",
    status: "new",
    name: "Isabel Vasquez",
    email: "isabel@example.com",
    message: "Do you ship to Canada?",
    createdAt: "2026-11-10T15:00:00.000Z",
    ...overrides,
  });

  it("lists the messages with the category, the sender, the date and the text, with a way to reply", async () => {
    await open("/en/admin/inquiries", (server) => {
      server.inquiryRecords.push(inquiry());
    });

    const card = within(await page().findByRole("article"));
    expect(card.getByText("Support")).toBeInTheDocument();
    expect(card.getByRole("heading", { name: "From Isabel Vasquez" })).toBeInTheDocument();
    expect(card.getByText("Do you ship to Canada?")).toBeInTheDocument();
    expect(card.getByText("New")).toBeInTheDocument();
    expect(card.getByRole("link", { name: "Reply by email" })).toHaveAttribute("href", "mailto:isabel@example.com");
  });

  it("marks a message as responded, and as new again", async () => {
    const { user, server } = await open("/en/admin/inquiries", (fake) => {
      fake.inquiryRecords.push(inquiry());
    });
    const card = within(await page().findByRole("article"));

    await user.click(card.getByRole("button", { name: "Mark as responded" }));
    expect(await card.findByText("Responded")).toBeInTheDocument();
    expect(server.inquiryRecords[0].status).toBe("responded");

    await user.click(card.getByRole("button", { name: "Mark as new" }));
    expect(await card.findByText("New")).toBeInTheDocument();
  });

  it("shows the rating of a feedback message, and a message from nobody", async () => {
    await open("/en/admin/inquiries", (server) => {
      server.inquiryRecords.push(inquiry({ category: "feedback", name: undefined, email: undefined, message: undefined, rating: 4 }));
    });

    const card = within(await page().findByRole("article"));
    expect(card.getByText("Rating: 4 of 5")).toBeInTheDocument();
    expect(card.getByRole("heading", { name: "Nobody left a name" })).toBeInTheDocument();
    expect(card.queryByRole("link", { name: "Reply by email" })).not.toBeInTheDocument();
  });

  it("filters by status", async () => {
    const { user } = await open("/en/admin/inquiries", (server) => {
      server.inquiryRecords.push(inquiry(), inquiry({ status: "responded", name: "Marcus" }));
    });
    expect(await page().findAllByRole("article")).toHaveLength(2);

    await user.selectOptions(page().getByLabelText("Status"), "responded");

    await waitFor(() => expect(page().getAllByRole("article")).toHaveLength(1));
    expect(page().getByRole("heading", { name: "From Marcus" })).toBeInTheDocument();
  });

  it("adds the next messages with a button", async () => {
    const { user } = await open("/en/admin/inquiries", (server) => {
      for (let index = 0; index < 17; index++) server.inquiryRecords.push(inquiry({ name: `Person ${index}` }));
    });
    expect(await page().findAllByRole("article")).toHaveLength(15);

    await user.click(page().getByRole("button", { name: "Show more" }));

    await waitFor(() => expect(page().getAllByRole("article")).toHaveLength(17));
    expect(page().queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("says that there are none", async () => {
    await open("/en/admin/inquiries");

    expect(await page().findByText("There are no inquiries.")).toBeInTheDocument();
  });
});

describe("the dashboard in Spanish", () => {
  it("is in Spanish, with the names of the products of the server in Spanish", async () => {
    await open("/es/admin/products");

    expect(screen.getByRole("heading", { level: 1, name: "Panel" })).toBeInTheDocument();
    expect(await page().findByText("7 productos")).toBeInTheDocument();
    expect(page().getByText("Perú 68%", { selector: "p" })).toBeInTheDocument();
  });
});
