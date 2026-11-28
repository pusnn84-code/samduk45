import { MAX_POST_PHOTOS, CommunityError, isPhotoName, validateFiles } from "../../src/features/community/policy";

export type SelectedPhotoPreview = { file: File; url: string };
type ObjectUrls = Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;

export function selectPostFiles(
  retained: readonly { name: string; size: number; sha256: string }[],
  current: File[],
  incoming: File[],
): File[] {
  if (incoming.some(file => !isPhotoName(file.name))) {
    throw new CommunityError("UNSUPPORTED_POST_PHOTO");
  }
  const selected = [...current, ...incoming];
  if (retained.length + selected.length > MAX_POST_PHOTOS) throw new CommunityError("TOO_MANY_FILES");
  validateFiles(selected.map(file => ({
    name: file.name,
    size: file.size,
    sha256: "0".repeat(64),
  })));
  return selected;
}

/** Create previews only after validation; retain existing URLs until replacement succeeds. */
export function updatePhotoPreviews(
  previous: SelectedPhotoPreview[],
  files: File[],
  urls: ObjectUrls = URL,
): SelectedPhotoPreview[] {
  const created: SelectedPhotoPreview[] = [];
  let next: SelectedPhotoPreview[];
  try {
    next = files.filter(file => isPhotoName(file.name)).map(file => {
      const existing = previous.find(preview => preview.file === file);
      if (existing) return existing;
      const preview = { file, url: urls.createObjectURL(file) };
      created.push(preview);
      return preview;
    });
  } catch (error) {
    created.forEach(preview => urls.revokeObjectURL(preview.url));
    throw error;
  }
  previous.filter(preview => !next.includes(preview)).forEach(preview => urls.revokeObjectURL(preview.url));
  return next;
}

export function releasePhotoPreviews(previews: SelectedPhotoPreview[], urls: ObjectUrls = URL) {
  previews.forEach(preview => urls.revokeObjectURL(preview.url));
}
