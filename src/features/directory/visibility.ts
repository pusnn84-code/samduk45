export const visibleDirectoryVillage = (village: string | null | undefined) => !!village?.trim() && !/^0?6(?:마을)?$/.test(village.replace(/\s+/g, ""));
