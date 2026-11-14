import { CommunityError, isPhotoName, MAX_PHOTO_UPLOAD_BYTES } from "../../src/features/community/policy";

export const MAX_SOURCE_PHOTO_BYTES = 30 * 1024 * 1024;
export const MAX_PHOTO_EDGE = 1920;
const MAX_PHOTO_PIXELS = 64_000_000;
export type PreparedPhoto = { file: File; originalBytes: number };
export type PhotoRaster = {
  width: number; height: number;
  encode(width: number, height: number, quality: number): Promise<Blob>;
  close(): void;
};

/** Decode locally: full-resolution originals never leave the device. Image respects EXIF orientation. */
async function openBrowserPhoto(file: File): Promise<PhotoRaster> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error("PHOTO_DECODE_TIMEOUT")); }, 20_000);
      function cleanup() { clearTimeout(timer); image.onload = null; image.onerror = null; }
      image.onload = () => { cleanup(); resolve(); };
      image.onerror = () => { cleanup(); reject(new Error("PHOTO_DECODE_FAILED")); };
      image.src = url;
    });
    return {
      width: image.naturalWidth, height: image.naturalHeight,
      async encode(width, height, quality) {
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        try {
          const context = canvas.getContext("2d");
          if (!context) throw new Error("CANVAS_UNAVAILABLE");
          context.drawImage(image, 0, 0, width, height);
          const encode = (type: string) => new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PHOTO_ENCODE_FAILED")), type, quality);
          });
          const webp = await encode("image/webp");
          if (webp.type === "image/webp") return webp;
          // Browsers without WebP encoding silently return PNG. Use JPEG instead.
          context.globalCompositeOperation = "destination-over";
          context.fillStyle = "#ffffff"; context.fillRect(0, 0, width, height);
          return await encode("image/jpeg");
        } finally { canvas.width = 0; canvas.height = 0; }
      },
      close() { image.src = ""; URL.revokeObjectURL(url); },
    };
  } catch (error) { image.src = ""; URL.revokeObjectURL(url); throw error; }
}

export async function preparePostPhoto(file: File, open = openBrowserPhoto): Promise<PreparedPhoto> {
  if (!isPhotoName(file.name)) throw new CommunityError("UNSUPPORTED_POST_PHOTO");
  if (!file.size) throw new CommunityError("INVALID_FILE_SIZE");
  if (file.size > MAX_SOURCE_PHOTO_BYTES) throw new CommunityError("PHOTO_SOURCE_TOO_LARGE");
  let raster: PhotoRaster | undefined;
  try {
    raster = await open(file);
    if (!Number.isFinite(raster.width) || !Number.isFinite(raster.height) || raster.width < 1 || raster.height < 1
      || raster.width * raster.height > MAX_PHOTO_PIXELS) throw new CommunityError("PHOTO_DIMENSIONS_TOO_LARGE");
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(raster.width, raster.height));
    let width = Math.max(1, Math.round(raster.width * scale));
    let height = Math.max(1, Math.round(raster.height * scale));
    for (let attempt = 0; attempt < 6; attempt++) {
      const quality = [0.82, 0.72, 0.62, 0.62, 0.58, 0.55][attempt];
      const blob = await raster.encode(width, height, quality);
      if (blob.size > 0 && blob.size <= MAX_PHOTO_UPLOAD_BYTES && ["image/webp", "image/jpeg"].includes(blob.type)) {
        // Do not inflate a small, already optimized photo. Large photos always use the reduced output.
        if (file.size <= MAX_PHOTO_UPLOAD_BYTES && file.size < blob.size && scale === 1) return { file, originalBytes: file.size };
        const extension = blob.type === "image/webp" ? ".webp" : ".jpg";
        const name = file.name.replace(/\.[^.]+$/, "").slice(0, 150) + extension;
        return { file: new File([blob], name, { type: blob.type, lastModified: file.lastModified }), originalBytes: file.size };
      }
      if (attempt >= 2) { width = Math.max(1, Math.round(width * 0.8)); height = Math.max(1, Math.round(height * 0.8)); }
    }
    throw new CommunityError("PHOTO_COMPRESSION_FAILED");
  } catch (error) {
    if (error instanceof CommunityError) throw error;
    throw new CommunityError("PHOTO_PROCESSING_FAILED");
  } finally { raster?.close(); }
}

export function photoSize(bytes: number) {
  return bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(2) + "MB" : Math.max(1, Math.round(bytes / 1024)) + "KB";
}
