// Adds four sample chocolates to the shop through the staff API, with the photos of frontend/public/sample-chocolates.
// The backend has to be running, and STAFF_API_KEY (at least 24 characters) has to be set in backend/.env, the same text as here:
//   cd backend
//   STAFF_API_KEY="the-same-text-as-in-the-env-file" node sample-data/add-sample-products.mjs
// Run it twice and the second time every product answers 409 (the slug is taken), so nothing is added twice.
// To show a sold out product afterwards, set a stock of 0:
//   PUT /api/staff/products/<id>/inventory  with  { "quantity": 0 }

const key = process.env.STAFF_API_KEY;
const base = process.env.API_URL ?? "http://localhost:4000";

if (!key) {
  console.error("Set STAFF_API_KEY to the staff key of backend/.env, for example: STAFF_API_KEY=... node sample-data/add-sample-products.mjs");
  process.exit(1);
}

// a photo of the folder frontend/public/sample-chocolates, which the website serves at /sample-chocolates/<name>
const photo = (name) => `/sample-chocolates/${name}.jpg`;

// prices are in cents (3400 is $34.00)
const products = [
  {
    slug: "signature-assortment-box",
    sku: "SC-BOX-030",
    name: { en: "Signature Assortment Box", es: "Caja Surtida Signature" },
    caption: { en: "Thirty hand finished pieces, 65% cacao", es: "Treinta piezas terminadas a mano, 65% de cacao" },
    tastingSummary: { en: "red fruit, toasted almond, soft caramel", es: "frutos rojos, almendra tostada, caramelo suave" },
    imageAlt: { en: "Thirty assorted chocolates in brown paper cups on a white surface", es: "Treinta chocolates surtidos en cápsulas marrones sobre una superficie blanca" },
    farm: { en: "Finca La Perla, Esmeraldas Province", es: "Finca La Perla, provincia de Esmeraldas" },
    description: {
      en: "A box of thirty pieces made from our Ecuador cacao: dark ganaches, praline centers, nut clusters and a few white chocolate squares. Every piece is finished by hand in small batches, so no two boxes look exactly the same. It is our most popular gift for hotels and for the holidays.",
      es: "Una caja de treinta piezas hechas con nuestro cacao de Ecuador: ganaches oscuros, centros de praline, racimos de nueces y algunos cuadros de chocolate blanco. Cada pieza se termina a mano en lotes pequeños, por lo que no hay dos cajas exactamente iguales. Es nuestro regalo más popular para hoteles y para las fiestas.",
    },
    origin: "ecuador",
    originName: { en: "Ecuador", es: "Ecuador" },
    percentage: 65,
    category: "truffle",
    price: 3400,
    notes: ["fruity", "nutty"],
    thumbnail: photo("cacao-assortment-box"),
    images: [photo("cacao-assortment-box")],
    batchCode: "ECU-BOX-2024-11",
    harvestMonth: "2024-09",
    roastMonth: "2024-10",
    featured: true,
    sortOrder: 10,
    quantity: 25,
  },
  {
    slug: "nib-crunch-70",
    sku: "SC-NIB-070",
    name: { en: "Cacao Nib Crunch 70%", es: "Crujiente de Nibs de Cacao 70%" },
    caption: { en: "Peru, 70% cacao with roasted nibs", es: "Perú, 70% de cacao con nibs tostados" },
    tastingSummary: { en: "roasted nut, dark cocoa, a clean earthy finish", es: "nuez tostada, cacao oscuro, final limpio y terroso" },
    imageAlt: { en: "A white bowl filled with crushed roasted cacao nibs", es: "Un tazón blanco lleno de nibs de cacao tostados y triturados" },
    farm: { en: "Cooperativa Valle Sagrado, Cusco", es: "Cooperativa Valle Sagrado, Cusco" },
    description: {
      en: "Dark chocolate from the high farms of Cusco with roasted cacao nibs folded in for a crunch that tastes like the bean itself. The nibs are roasted in our own kitchen for twelve minutes, then cooled slowly so they stay crisp inside the bar.",
      es: "Chocolate oscuro de las fincas altas de Cusco con nibs de cacao tostados para un crujido que sabe a la propia semilla. Los nibs se tuestan en nuestra cocina durante doce minutos y se enfrían despacio para que sigan crujientes dentro de la barra.",
    },
    origin: "peru",
    originName: { en: "Peru", es: "Perú" },
    percentage: 70,
    category: "bar",
    price: 1300,
    notes: ["earthy", "nutty"],
    thumbnail: photo("roasted-cacao-nibs"),
    images: [photo("roasted-cacao-nibs")],
    batchCode: "PER-NIB-2024-10",
    harvestMonth: "2024-08",
    roastMonth: "2024-10",
    featured: false,
    sortOrder: 20,
    quantity: 80,
  },
  {
    slug: "dark-milk-almond-60",
    sku: "SC-DMA-060",
    name: { en: "Dark Milk Almond 60%", es: "Chocolate Oscuro con Leche y Almendra 60%" },
    caption: { en: "Colombia, 60% cacao with almonds", es: "Colombia, 60% de cacao con almendras" },
    tastingSummary: { en: "toasted almond, cream, a hint of caramel", es: "almendra tostada, crema, un toque de caramelo" },
    imageAlt: { en: "Close up of milk chocolate covered in slivered almonds", es: "Primer plano de chocolate con leche cubierto de almendras en láminas" },
    farm: { en: "Asociación Sierra Nevada, Magdalena", es: "Asociación Sierra Nevada, Magdalena" },
    description: {
      en: "A dark milk chocolate with a high cacao content, so it is creamy without being sweet. Slivered almonds are pressed into the surface before the bar sets. A small batch, and it sells out quickly.",
      es: "Un chocolate oscuro con leche de alto contenido de cacao, cremoso sin ser dulce. Las almendras en láminas se presionan sobre la superficie antes de que la barra cuaje. Un lote pequeño que se agota rápido.",
    },
    origin: "colombia",
    originName: { en: "Colombia", es: "Colombia" },
    percentage: 60,
    category: "bar",
    price: 1100,
    notes: ["nutty"],
    thumbnail: photo("milk-almond-bar"),
    images: [photo("milk-almond-bar")],
    batchCode: "COL-DMA-2024-10",
    harvestMonth: "2024-07",
    roastMonth: "2024-09",
    featured: false,
    sortOrder: 30,
    // few left on purpose, so the page says "Only 4 left"
    quantity: 4,
  },
  {
    slug: "bean-crunch-85",
    sku: "SC-BEA-085",
    name: { en: "Cacao Bean Crunch 85%", es: "Crujiente de Granos de Cacao 85%" },
    caption: { en: "Madagascar, 85% cacao, seasonal release", es: "Madagascar, 85% de cacao, edición de temporada" },
    tastingSummary: { en: "smoky cocoa, dried fig, a long bitter finish", es: "cacao ahumado, higo seco, un final largo y amargo" },
    imageAlt: { en: "Fermented cacao beans drying in the sun", es: "Granos de cacao fermentados secandose al sol" },
    farm: { en: "Sambirano Valley cooperative, Madagascar", es: "Cooperativa del valle de Sambirano, Madagascar" },
    description: {
      en: "A seasonal release for people who like their chocolate very dark. Whole roasted beans from the Sambirano Valley are pressed into an 85% bar, so every bite has a bean in it. It comes back once a year, after the main harvest.",
      es: "Una edición de temporada para quienes prefieren el chocolate muy oscuro. Granos enteros tostados del valle de Sambirano se prensan en una barra de 85%, así que cada bocado lleva un grano. Vuelve una vez al año, después de la cosecha principal.",
    },
    origin: "madagascar",
    originName: { en: "Madagascar", es: "Madagascar" },
    percentage: 85,
    category: "seasonal",
    price: 1600,
    notes: ["smoky", "earthy"],
    thumbnail: photo("raw-cacao-beans"),
    images: [photo("raw-cacao-beans")],
    batchCode: "MAD-BEA-2024-11",
    harvestMonth: "2024-06",
    roastMonth: "2024-10",
    featured: false,
    sortOrder: 40,
    quantity: 30,
  },
];

for (const product of products) {
  try {
    const response = await fetch(`${base}/api/staff/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Staff-Key": key },
      body: JSON.stringify(product),
    });
    const body = await response.json().catch(() => ({}));
    console.log(response.status === 201 ? `added ${product.slug}` : `${product.slug}: ${response.status} ${body.error?.message ?? ""}`);
  } catch (error) {
    console.error(`${product.slug}: the backend could not be reached at ${base} (${error.message})`);
    process.exitCode = 1;
  }
}
