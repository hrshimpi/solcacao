// The choices in the studio wizard and the rules for uploaded brand files.
export const profileIds = ["ecu", "per", "ven", "col", "mad", "custom"] as const;
export const packagingIds = ["foil", "rigid", "specimen", "sleeve"] as const;

export type ProfileId = (typeof profileIds)[number];
export type PackagingId = (typeof packagingIds)[number];

export const profileColors: Record<ProfileId, string> = {
  ecu: "#6B1F2E",
  per: "#2B4531",
  ven: "#1C1310",
  col: "#4A2A1A",
  mad: "#7A3B25",
  custom: "#EFA836",
};

export const allowedExtensions = ["pdf", "ai", "eps", "png"];
export const MAX_FILE_MB = 50;
export const MAX_FILES = 5;
export const MIN_UNITS = 500;

export function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
