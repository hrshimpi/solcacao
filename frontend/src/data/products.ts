// All product data lives here. Components only use the functions at the bottom,
// so a real API can replace this file later without touching the screens.
import type { Lang } from "../i18n";

export type Category = "bar" | "truffle" | "seasonal";
export type NoteId = "fruity" | "nutty" | "floral" | "earthy" | "smoky";
export type OriginId = "ecuador" | "peru" | "venezuela" | "colombia" | "madagascar";

export const categoryIds: Category[] = ["bar", "truffle", "seasonal"];
export const noteIds: NoteId[] = ["fruity", "nutty", "floral", "earthy", "smoky"];

export interface Product {
  id: number;
  slug: string;
  name: string;
  origin: OriginId;
  percentage: number;
  category: Category;
  price: number;
  // units left in the warehouse, 0 means sold out
  stock: number;
  notes: NoteId[];
  caption: string;
  tastingSummary: string;
  image: string;
  imageLarge: string;
  images: string[];
  imageAlt: string;
  batchCode: string;
  harvestMonth: string;
  roastMonth: string;
  farm: string;
  description: string;
}

interface ProductText {
  name: string;
  caption: string;
  tastingSummary: string;
  imageAlt: string;
  farm: string;
  description: string;
}

interface ProductRecord {
  id: number;
  slug: string;
  origin: OriginId;
  percentage: number;
  category: Category;
  price: number;
  stock: number;
  notes: NoteId[];
  image: string;
  batchCode: string;
  harvestMonth: string;
  roastMonth: string;
  text: Record<Lang, ProductText>;
}

const unsplash = (id: string) => `https://images.unsplash.com/${id}?w=480&h=600&fit=crop&auto=format`;

const records: ProductRecord[] = [
  {
    id: 1,
    slug: "ecuador-72",
    origin: "ecuador",
    percentage: 72,
    category: "bar",
    price: 12,
    stock: 120,
    notes: ["fruity", "floral"],
    image: unsplash("photo-1575377427642-087cf684f29d"),
    batchCode: "SC-2024-ECU-072",
    harvestMonth: "2024-03",
    roastMonth: "2024-06",
    text: {
      en: {
        name: "Ecuador 72%",
        caption: "Ecuador, 72% cacao",
        tastingSummary: "bright berry, jasmine finish",
        imageAlt: "Stacked squares of dark chocolate with cocoa shavings on a white surface",
        farm: "Finca La Perla, Esmeraldas Province",
        description:
          "From a small cooperative of forty families in coastal Esmeraldas, this bar is fermented under banana leaf for seven days before air-drying on raised beds. The result is a bar of unusual brightness, with fresh raspberry and dried cherry opening into a long jasmine finish.",
      },
      es: {
        name: "Ecuador 72%",
        caption: "Ecuador, 72% de cacao",
        tastingSummary: "bayas brillantes, final de jazmín",
        imageAlt: "Cuadros de chocolate oscuro apilados con virutas de cacao sobre una superficie blanca",
        farm: "Finca La Perla, provincia de Esmeraldas",
        description:
          "De una pequeña cooperativa de cuarenta familias en la costa de Esmeraldas, esta barra se fermenta siete días bajo hoja de plátano y luego se seca al aire sobre camas elevadas. El resultado es una barra de una brillantez poco común, con frambuesa fresca y cereza seca que se abren en un largo final de jazmín.",
      },
    },
  },
  {
    id: 2,
    slug: "peru-68",
    origin: "peru",
    percentage: 68,
    category: "bar",
    price: 11,
    stock: 60,
    notes: ["nutty", "earthy"],
    image: unsplash("photo-1613669146965-507d0e72a688"),
    batchCode: "SC-2024-PER-068",
    harvestMonth: "2024-01",
    roastMonth: "2024-04",
    text: {
      en: {
        name: "Peru 68%",
        caption: "Peru, 68% cacao",
        tastingSummary: "toasted almond, forest floor",
        imageAlt: "Close-up of a dark chocolate bar with fine shavings",
        farm: "Cooperativa Pangoa, Junín Region",
        description:
          "Grown at altitude in the Junín jungle, Pangoa cacao develops a distinctive earthiness: roasted hazelnuts, dried mushroom and a faint tobacco on the finish. A contemplative bar best enjoyed slowly.",
      },
      es: {
        name: "Perú 68%",
        caption: "Perú, 68% de cacao",
        tastingSummary: "almendra tostada, suelo de bosque",
        imageAlt: "Primer plano de una barra de chocolate oscuro con virutas finas",
        farm: "Cooperativa Pangoa, región de Junín",
        description:
          "Cultivado en altura en la selva de Junín, el cacao de Pangoa desarrolla un carácter terroso muy particular: avellanas tostadas, hongo seco y un leve toque de tabaco en el final. Una barra para pensar, ideal para disfrutar sin prisa.",
      },
    },
  },
  {
    id: 3,
    slug: "venezuela-76",
    origin: "venezuela",
    percentage: 76,
    category: "bar",
    price: 15,
    stock: 6,
    notes: ["floral", "smoky"],
    image: unsplash("photo-1646303339019-a57056b180ae"),
    batchCode: "SC-2024-VEN-076",
    harvestMonth: "2024-02",
    roastMonth: "2024-05",
    text: {
      en: {
        name: "Venezuela 76%",
        caption: "Venezuela, 76% cacao",
        tastingSummary: "violet, light smoke, stone fruit",
        imageAlt: "Broken pieces of dark chocolate on a white surface",
        farm: "Hacienda El Rosario, Barlovento",
        description:
          "Barlovento Criollo is the rarest and most delicate of Venezuela's cacao varieties. Light fermentation preserves the flower notes that characterize the finest specimens from this valley. Violet, then plum, then a warm, faint smokiness.",
      },
      es: {
        name: "Venezuela 76%",
        caption: "Venezuela, 76% de cacao",
        tastingSummary: "violeta, humo ligero, fruta de hueso",
        imageAlt: "Trozos rotos de chocolate oscuro sobre una superficie blanca",
        farm: "Hacienda El Rosario, Barlovento",
        description:
          "El criollo de Barlovento es la variedad de cacao más rara y delicada de Venezuela. Una fermentación ligera conserva las notas florales que distinguen a los mejores ejemplares de este valle. Violeta, luego ciruela, y un humo cálido y suave.",
      },
    },
  },
  {
    id: 4,
    slug: "colombia-64",
    origin: "colombia",
    percentage: 64,
    category: "bar",
    price: 10,
    stock: 45,
    notes: ["fruity", "nutty"],
    image: unsplash("photo-1610740655993-3080279a0022"),
    batchCode: "SC-2024-COL-064",
    harvestMonth: "2024-04",
    roastMonth: "2024-07",
    text: {
      en: {
        name: "Colombia 64%",
        caption: "Colombia, 64% cacao",
        tastingSummary: "mango, macadamia, mild acidity",
        imageAlt: "White and dark chocolate pieces with cinnamon sticks on a slate board",
        farm: "Finca El Recreo, Tumaco",
        description:
          "Tumaco on Colombia's Pacific coast produces cacao of tropical exuberance: ripe mango, macadamia cream and a brightness from the coastal humidity. At 64% this bar is accessible without being sweet.",
      },
      es: {
        name: "Colombia 64%",
        caption: "Colombia, 64% de cacao",
        tastingSummary: "mango, macadamia, acidez suave",
        imageAlt: "Trozos de chocolate blanco y oscuro con ramas de canela sobre una tabla de pizarra",
        farm: "Finca El Recreo, Tumaco",
        description:
          "Tumaco, en la costa del Pacífico de Colombia, da un cacao de exuberancia tropical: mango maduro, crema de macadamia y una frescura que viene de la humedad costera. Con 64% es una barra accesible sin ser dulce.",
      },
    },
  },
  {
    id: 5,
    slug: "madagascar-80",
    origin: "madagascar",
    percentage: 80,
    category: "bar",
    price: 14,
    stock: 30,
    notes: ["fruity", "floral"],
    image: unsplash("photo-1573710661345-610f790e1218"),
    batchCode: "SC-2024-MDG-080",
    harvestMonth: "2023-11",
    roastMonth: "2024-02",
    text: {
      en: {
        name: "Madagascar 80%",
        caption: "Madagascar, 80% cacao",
        tastingSummary: "red citrus, raspberry, sharp acidity",
        imageAlt: "Ripe cacao pods hanging on a tree",
        farm: "Sambirano Valley Collective",
        description:
          "The Sambirano Valley produces one of the world's most distinctive cacao profiles: a sharp, almost startling acidity reminiscent of blood orange, then raspberry jam cooling into a clean, dry finish. Bold and unapologetic at 80%.",
      },
      es: {
        name: "Madagascar 80%",
        caption: "Madagascar, 80% de cacao",
        tastingSummary: "cítricos rojos, frambuesa, acidez intensa",
        imageAlt: "Mazorcas de cacao maduras colgando de un árbol",
        farm: "Colectivo del Valle de Sambirano",
        description:
          "El valle de Sambirano produce uno de los perfiles de cacao más distintivos del mundo: una acidez intensa, casi sorprendente, que recuerda a la naranja sanguina, y luego mermelada de frambuesa que se enfría en un final limpio y seco. Atrevida y sin disculpas con 80%.",
      },
    },
  },
  {
    id: 6,
    slug: "midnight-truffle",
    origin: "ecuador",
    percentage: 70,
    category: "truffle",
    price: 18,
    stock: 18,
    notes: ["earthy", "smoky"],
    image: unsplash("photo-1744136943096-adae60aff987"),
    batchCode: "SC-2024-TRF-001",
    harvestMonth: "2024-03",
    roastMonth: "2024-06",
    text: {
      en: {
        name: "Midnight Truffle",
        caption: "Ecuador, 70% ganache",
        tastingSummary: "espresso, dark earth, peat smoke",
        imageAlt: "A cut chocolate truffle with a nut filling on a dark background",
        farm: "Finca La Perla, Esmeraldas Province",
        description:
          "Made from Esmeraldas cacao, this ganache-filled truffle is rolled in cocoa powder and finished with hand-scraped espresso dust. Dense and unctuous: earth, smoke and a long bitter coffee finish.",
      },
      es: {
        name: "Trufa Medianoche",
        caption: "Ecuador, 70% de ganache",
        tastingSummary: "espresso, tierra oscura, humo de turba",
        imageAlt: "Una trufa de chocolate cortada con relleno de frutos secos sobre un fondo oscuro",
        farm: "Finca La Perla, provincia de Esmeraldas",
        description:
          "Hecha con cacao de Esmeraldas, esta trufa rellena de ganache se reboza en cacao en polvo y se termina con polvo de espresso raspado a mano. Densa y untuosa: tierra, humo y un largo final amargo de café.",
      },
    },
  },
  {
    id: 7,
    slug: "fleur-de-sel-bar",
    origin: "ecuador",
    percentage: 68,
    category: "seasonal",
    price: 13,
    stock: 0,
    notes: ["fruity", "floral"],
    image: unsplash("photo-1760307207865-c49d6670e572"),
    batchCode: "SC-2024-SEA-001",
    harvestMonth: "2024-03",
    roastMonth: "2024-06",
    text: {
      en: {
        name: "Fleur de Sel Bar",
        caption: "Ecuador, 68% cacao",
        tastingSummary: "sea salt, caramel, citrus bloom",
        imageAlt: "A display box of colorful chocolate bars",
        farm: "Finca La Perla, Esmeraldas Province",
        description:
          "Our seasonal expression for summer: the Ecuador 68% base finished with hand-harvested fleur de sel from the Yucatan coast. The salt lifts the citrus notes and extends the finish across the palate.",
      },
      es: {
        name: "Barra Flor de Sal",
        caption: "Ecuador, 68% de cacao",
        tastingSummary: "sal marina, caramelo, flor de cítricos",
        imageAlt: "Una caja de exhibición con barras de chocolate de colores",
        farm: "Finca La Perla, provincia de Esmeraldas",
        description:
          "Nuestra expresión de temporada para el verano: la base de Ecuador 68% terminada con flor de sal cosechada a mano en la costa de Yucatán. La sal realza las notas cítricas y alarga el final en el paladar.",
      },
    },
  },
];

function toProduct(record: ProductRecord, lang: Lang): Product {
  const { text, ...rest } = record;
  return {
    ...rest,
    ...text[lang],
    imageLarge: record.image.replace("w=480&h=600", "w=960&h=1200"),
    images: [
      record.image.replace("w=480&h=600", "w=960&h=1200"),
      record.image.replace("w=480&h=600", "w=960&h=1200").replace("fit=crop", "fit=crop&crop=top"),
      record.image.replace("w=480&h=600", "w=960&h=1200").replace("fit=crop", "fit=crop&crop=bottom"),
    ],
  };
}

export function getProducts(lang: Lang): Product[] {
  return records.map((record) => toProduct(record, lang));
}

export function getProductBySlug(slug: string | undefined, lang: Lang): Product | undefined {
  const record = records.find((item) => item.slug === slug);
  return record ? toProduct(record, lang) : undefined;
}

export function getProductById(id: number, lang: Lang): Product | undefined {
  const record = records.find((item) => item.id === id);
  return record ? toProduct(record, lang) : undefined;
}

export function getOriginIds(): OriginId[] {
  return Array.from(new Set(records.map((record) => record.origin)));
}

const countryCodes: Record<OriginId, string> = {
  ecuador: "EC",
  peru: "PE",
  venezuela: "VE",
  colombia: "CO",
  madagascar: "MG",
};

export function originName(origin: OriginId, lang: Lang) {
  return new Intl.DisplayNames([lang], { type: "region" }).of(countryCodes[origin]) ?? origin;
}

// matches a product name or its origin country, ignoring capitals and accents
export function searchProducts(query: string, lang: Lang): Product[] {
  const plain = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const needle = plain(query.trim());
  if (!needle) return [];
  return getProducts(lang).filter(
    (product) => plain(product.name).includes(needle) || plain(originName(product.origin, lang)).includes(needle),
  );
}