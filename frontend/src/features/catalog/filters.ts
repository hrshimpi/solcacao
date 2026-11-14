// Shop filters: reading them from the address (?min=60&origin=peru...), writing them back, and applying them.
import { categoryIds, getOriginIds, noteIds, type Category, type NoteId, type OriginId, type Product } from "../../data/products";

export const PCT_MIN = 55;
export const PCT_MAX = 85;
export const PCT_GAP = 2;

export interface Filters {
  min: number;
  max: number;
  origins: OriginId[];
  category: Category | "all";
  notes: NoteId[];
}

export const defaultFilters: Filters = { min: 60, max: 85, origins: [], category: "all", notes: [] };

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

function readList<T extends string>(value: string | null, allowed: T[]): T[] {
  return (value ?? "").split(",").filter((item): item is T => allowed.includes(item as T));
}

export function filtersFromParams(params: URLSearchParams): Filters {
  const min = Number(params.get("min"));
  const max = Number(params.get("max"));
  const safeMin = params.has("min") && Number.isFinite(min) ? clamp(Math.round(min), PCT_MIN, PCT_MAX - PCT_GAP) : defaultFilters.min;
  const safeMax = params.has("max") && Number.isFinite(max) ? clamp(Math.round(max), safeMin + PCT_GAP, PCT_MAX) : defaultFilters.max;
  const category = params.get("category");

  return {
    min: safeMin,
    max: Math.max(safeMax, safeMin + PCT_GAP),
    origins: readList(params.get("origin"), getOriginIds()),
    category: categoryIds.includes(category as Category) ? (category as Category) : "all",
    notes: readList(params.get("notes"), noteIds),
  };
}

// only values that differ from the defaults go into the address
export function paramsFromFilters(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.min !== defaultFilters.min) params.set("min", String(filters.min));
  if (filters.max !== defaultFilters.max) params.set("max", String(filters.max));
  if (filters.origins.length) params.set("origin", filters.origins.join(","));
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.notes.length) params.set("notes", filters.notes.join(","));
  return params;
}

export function applyFilters(products: Product[], filters: Filters): Product[] {
  return products.filter((product) => {
    if (product.percentage < filters.min || product.percentage > filters.max) return false;
    if (filters.origins.length && !filters.origins.includes(product.origin)) return false;
    if (filters.category !== "all" && product.category !== filters.category) return false;
    if (filters.notes.length && !filters.notes.some((note) => product.notes.includes(note))) return false;
    return true;
  });
}

export function hasActiveFilters(filters: Filters) {
  return paramsFromFilters(filters).toString() !== "";
}
