// The seven products of the shop as the tests know them: the same text as the seed of the backend, in English and Spanish,
// with prices in cents. wireProduct gives a product as the API sends it for a language, and productsFor gives what the
// pages get after reading it, so a test can start from the same products as the real shop.
import { toProduct, type Product } from "../api/products";
import type { Lang } from "../i18n";

interface Bilingual {
  en: string;
  es: string;
}

export interface FixtureRecord {
  // how many units the shop has at the start
  quantity: number;
  product: {
    slug: string;
    sku: string;
    name: Bilingual;
    caption: Bilingual;
    tastingSummary: Bilingual;
    imageAlt: Bilingual;
    farm: Bilingual;
    description: Bilingual;
    origin: string;
    originName: Bilingual;
    percentage: number;
    category: string;
    price: number;
    notes: string[];
    thumbnail: string;
    images: string[];
    batchCode: string;
    harvestMonth: string;
    roastMonth: string;
    featured: boolean;
    active: boolean;
    sortOrder: number;
  };
}

// one picture in three sizes and crops, the way the product page shows it
const photo = (id: string) => {
  const base = (size: string) => `https://images.unsplash.com/${id}?${size}&fit=crop&auto=format`;
  const large = base("w=960&h=1200");
  return {
    thumbnail: base("w=480&h=600"),
    images: [large, large.replace("fit=crop", "fit=crop&crop=top"), large.replace("fit=crop", "fit=crop&crop=bottom")],
  };
};

const records: FixtureRecord[] = [
  {
    quantity: 120,
    product: {
      slug: "ecuador-72",
      sku: "SC-ECU-072",
      name: { en: "Ecuador 72%", es: "Ecuador 72%" },
      caption: { en: "Ecuador, 72% cacao", es: "Ecuador, 72% de cacao" },
      tastingSummary: { en: "bright berry, jasmine finish", es: "bayas brillantes, final de jazmín" },
      imageAlt: {
        en: "Stacked squares of dark chocolate with cocoa shavings on a white surface",
        es: "Cuadros de chocolate oscuro apilados con virutas de cacao sobre una superficie blanca",
      },
      farm: { en: "Finca La Perla, Esmeraldas Province", es: "Finca La Perla, provincia de Esmeraldas" },
      description: {
        en: "From a small cooperative of forty families in coastal Esmeraldas, this bar is fermented under banana leaf for seven days before air-drying on raised beds. The result is a bar of unusual brightness, with fresh raspberry and dried cherry opening into a long jasmine finish.",
        es: "De una pequeña cooperativa de cuarenta familias en la costa de Esmeraldas, esta barra se fermenta siete días bajo hoja de plátano y luego se seca al aire sobre camas elevadas. El resultado es una barra de una brillantez poco común, con frambuesa fresca y cereza seca que se abren en un largo final de jazmín.",
      },
      origin: "ecuador",
      originName: { en: "Ecuador", es: "Ecuador" },
      percentage: 72,
      category: "bar",
      price: 1200,
      notes: ["fruity", "floral"],
      ...photo("photo-1575377427642-087cf684f29d"),
      batchCode: "SC-2024-ECU-072",
      harvestMonth: "2024-03",
      roastMonth: "2024-06",
      featured: true,
      active: true,
      sortOrder: 1,
    },
  },
  {
    quantity: 60,
    product: {
      slug: "peru-68",
      sku: "SC-PER-068",
      name: { en: "Peru 68%", es: "Perú 68%" },
      caption: { en: "Peru, 68% cacao", es: "Perú, 68% de cacao" },
      tastingSummary: { en: "toasted almond, forest floor", es: "almendra tostada, suelo de bosque" },
      imageAlt: {
        en: "Close-up of a dark chocolate bar with fine shavings",
        es: "Primer plano de una barra de chocolate oscuro con virutas finas",
      },
      farm: { en: "Cooperativa Pangoa, Junín Region", es: "Cooperativa Pangoa, región de Junín" },
      description: {
        en: "Grown at altitude in the Junín jungle, Pangoa cacao develops a distinctive earthiness: roasted hazelnuts, dried mushroom and a faint tobacco on the finish. A contemplative bar best enjoyed slowly.",
        es: "Cultivado en altura en la selva de Junín, el cacao de Pangoa desarrolla un carácter terroso muy particular: avellanas tostadas, hongo seco y un leve toque de tabaco en el final. Una barra para pensar, ideal para disfrutar sin prisa.",
      },
      origin: "peru",
      originName: { en: "Peru", es: "Perú" },
      percentage: 68,
      category: "bar",
      price: 1100,
      notes: ["nutty", "earthy"],
      ...photo("photo-1613669146965-507d0e72a688"),
      batchCode: "SC-2024-PER-068",
      harvestMonth: "2024-01",
      roastMonth: "2024-04",
      featured: true,
      active: true,
      sortOrder: 2,
    },
  },
  {
    quantity: 6,
    product: {
      slug: "venezuela-76",
      sku: "SC-VEN-076",
      name: { en: "Venezuela 76%", es: "Venezuela 76%" },
      caption: { en: "Venezuela, 76% cacao", es: "Venezuela, 76% de cacao" },
      tastingSummary: { en: "violet, light smoke, stone fruit", es: "violeta, humo ligero, fruta de hueso" },
      imageAlt: {
        en: "Broken pieces of dark chocolate on a white surface",
        es: "Trozos rotos de chocolate oscuro sobre una superficie blanca",
      },
      farm: { en: "Hacienda El Rosario, Barlovento", es: "Hacienda El Rosario, Barlovento" },
      description: {
        en: "Barlovento Criollo is the rarest and most delicate of Venezuela's cacao varieties. Light fermentation preserves the flower notes that characterize the finest specimens from this valley. Violet, then plum, then a warm, faint smokiness.",
        es: "El criollo de Barlovento es la variedad de cacao más rara y delicada de Venezuela. Una fermentación ligera conserva las notas florales que distinguen a los mejores ejemplares de este valle. Violeta, luego ciruela, y un humo cálido y suave.",
      },
      origin: "venezuela",
      originName: { en: "Venezuela", es: "Venezuela" },
      percentage: 76,
      category: "bar",
      price: 1500,
      notes: ["floral", "smoky"],
      ...photo("photo-1646303339019-a57056b180ae"),
      batchCode: "SC-2024-VEN-076",
      harvestMonth: "2024-02",
      roastMonth: "2024-05",
      featured: true,
      active: true,
      sortOrder: 3,
    },
  },
  {
    quantity: 45,
    product: {
      slug: "colombia-64",
      sku: "SC-COL-064",
      name: { en: "Colombia 64%", es: "Colombia 64%" },
      caption: { en: "Colombia, 64% cacao", es: "Colombia, 64% de cacao" },
      tastingSummary: { en: "mango, macadamia, mild acidity", es: "mango, macadamia, acidez suave" },
      imageAlt: {
        en: "White and dark chocolate pieces with cinnamon sticks on a slate board",
        es: "Trozos de chocolate blanco y oscuro con ramas de canela sobre una tabla de pizarra",
      },
      farm: { en: "Finca El Recreo, Tumaco", es: "Finca El Recreo, Tumaco" },
      description: {
        en: "Tumaco on Colombia's Pacific coast produces cacao of tropical exuberance: ripe mango, macadamia cream and a brightness from the coastal humidity. At 64% this bar is accessible without being sweet.",
        es: "Tumaco, en la costa del Pacífico de Colombia, da un cacao de exuberancia tropical: mango maduro, crema de macadamia y una frescura que viene de la humedad costera. Con 64% es una barra accesible sin ser dulce.",
      },
      origin: "colombia",
      originName: { en: "Colombia", es: "Colombia" },
      percentage: 64,
      category: "bar",
      price: 1000,
      notes: ["fruity", "nutty"],
      ...photo("photo-1610740655993-3080279a0022"),
      batchCode: "SC-2024-COL-064",
      harvestMonth: "2024-04",
      roastMonth: "2024-07",
      featured: false,
      active: true,
      sortOrder: 4,
    },
  },
  {
    quantity: 30,
    product: {
      slug: "madagascar-80",
      sku: "SC-MDG-080",
      name: { en: "Madagascar 80%", es: "Madagascar 80%" },
      caption: { en: "Madagascar, 80% cacao", es: "Madagascar, 80% de cacao" },
      tastingSummary: { en: "red citrus, raspberry, sharp acidity", es: "cítricos rojos, frambuesa, acidez intensa" },
      imageAlt: { en: "Ripe cacao pods hanging on a tree", es: "Mazorcas de cacao maduras colgando de un árbol" },
      farm: { en: "Sambirano Valley Collective", es: "Colectivo del Valle de Sambirano" },
      description: {
        en: "The Sambirano Valley produces one of the world's most distinctive cacao profiles: a sharp, almost startling acidity reminiscent of blood orange, then raspberry jam cooling into a clean, dry finish. Bold and unapologetic at 80%.",
        es: "El valle de Sambirano produce uno de los perfiles de cacao más distintivos del mundo: una acidez intensa, casi sorprendente, que recuerda a la naranja sanguina, y luego mermelada de frambuesa que se enfría en un final limpio y seco. Atrevida y sin disculpas con 80%.",
      },
      origin: "madagascar",
      originName: { en: "Madagascar", es: "Madagascar" },
      percentage: 80,
      category: "bar",
      price: 1400,
      notes: ["fruity", "floral"],
      ...photo("photo-1573710661345-610f790e1218"),
      batchCode: "SC-2024-MDG-080",
      harvestMonth: "2023-11",
      roastMonth: "2024-02",
      featured: true,
      active: true,
      sortOrder: 5,
    },
  },
  {
    quantity: 18,
    product: {
      slug: "midnight-truffle",
      sku: "SC-TRF-001",
      name: { en: "Midnight Truffle", es: "Trufa Medianoche" },
      caption: { en: "Ecuador, 70% ganache", es: "Ecuador, 70% de ganache" },
      tastingSummary: { en: "espresso, dark earth, peat smoke", es: "espresso, tierra oscura, humo de turba" },
      imageAlt: {
        en: "A cut chocolate truffle with a nut filling on a dark background",
        es: "Una trufa de chocolate cortada con relleno de frutos secos sobre un fondo oscuro",
      },
      farm: { en: "Finca La Perla, Esmeraldas Province", es: "Finca La Perla, provincia de Esmeraldas" },
      description: {
        en: "Made from Esmeraldas cacao, this ganache-filled truffle is rolled in cocoa powder and finished with hand-scraped espresso dust. Dense and unctuous: earth, smoke and a long bitter coffee finish.",
        es: "Hecha con cacao de Esmeraldas, esta trufa rellena de ganache se reboza en cacao en polvo y se termina con polvo de espresso raspado a mano. Densa y untuosa: tierra, humo y un largo final amargo de café.",
      },
      origin: "ecuador",
      originName: { en: "Ecuador", es: "Ecuador" },
      percentage: 70,
      category: "truffle",
      price: 1800,
      notes: ["earthy", "smoky"],
      ...photo("photo-1744136943096-adae60aff987"),
      batchCode: "SC-2024-TRF-001",
      harvestMonth: "2024-03",
      roastMonth: "2024-06",
      featured: true,
      active: true,
      sortOrder: 6,
    },
  },
  {
    quantity: 0,
    product: {
      slug: "fleur-de-sel-bar",
      sku: "SC-SEA-001",
      name: { en: "Fleur de Sel Bar", es: "Barra Flor de Sal" },
      caption: { en: "Ecuador, 68% cacao", es: "Ecuador, 68% de cacao" },
      tastingSummary: { en: "sea salt, caramel, citrus bloom", es: "sal marina, caramelo, flor de cítricos" },
      imageAlt: { en: "A display box of colorful chocolate bars", es: "Una caja de exhibición con barras de chocolate de colores" },
      farm: { en: "Finca La Perla, Esmeraldas Province", es: "Finca La Perla, provincia de Esmeraldas" },
      description: {
        en: "Our seasonal expression for summer: the Ecuador 68% base finished with hand-harvested fleur de sel from the Yucatan coast. The salt lifts the citrus notes and extends the finish across the palate.",
        es: "Nuestra expresión de temporada para el verano: la base de Ecuador 68% terminada con flor de sal cosechada a mano en la costa de Yucatán. La sal realza las notas cítricas y alarga el final en el paladar.",
      },
      origin: "ecuador",
      originName: { en: "Ecuador", es: "Ecuador" },
      percentage: 68,
      category: "seasonal",
      price: 1300,
      notes: ["fruity", "floral"],
      ...photo("photo-1760307207865-c49d6670e572"),
      batchCode: "SC-2024-SEA-001",
      harvestMonth: "2024-03",
      roastMonth: "2024-06",
      featured: false,
      active: true,
      sortOrder: 7,
    },
  },
];

export const fixtureRecords: FixtureRecord[] = records;

// the id of a product in the tests: ecuador-72 is the first
export const fixtureId = (slug: string): string => {
  const index = records.findIndex((record) => record.product.slug === slug);
  if (index < 0) throw new Error(`no fixture product ${slug}`);
  return `64b7f0c2a1b2c3d4e5f60a0${index + 1}`;
};

export const LOW_STOCK = 10;

// a product as the API sends it, in a language, with the stock it has now
export function wireProduct(record: FixtureRecord, lang: Lang, stock = record.quantity) {
  const { product } = record;
  return {
    id: fixtureId(product.slug),
    slug: product.slug,
    sku: product.sku,
    name: product.name[lang],
    caption: product.caption[lang],
    tastingSummary: product.tastingSummary[lang],
    imageAlt: product.imageAlt[lang],
    farm: product.farm[lang],
    description: product.description[lang],
    origin: product.origin,
    originName: product.originName[lang],
    percentage: product.percentage,
    category: product.category,
    price: product.price,
    notes: product.notes,
    thumbnail: product.thumbnail,
    images: product.images,
    batchCode: product.batchCode,
    harvestMonth: product.harvestMonth,
    roastMonth: product.roastMonth,
    featured: product.featured,
    stock,
    availability: stock <= 0 ? "out" : stock <= LOW_STOCK ? "low" : "in_stock",
  };
}

// what the pages hold after reading the API, in a language
export function productsFor(lang: Lang): Product[] {
  return records.map((record) => toProduct(wireProduct(record, lang))).filter((product): product is Product => product !== null);
}
