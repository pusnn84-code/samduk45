import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { MAX_SOURCE_PHOTO_BYTES, preparePostPhoto, type PhotoRaster } from "../../components/community/photo-compression";
import { MAX_PHOTO_UPLOAD_BYTES, parsePostInput } from "../../src/features/community/policy";
import { assertValidPostPhoto } from "../../src/features/community/images";

const file = (bytes: number, name = "가상사진.jpg") => new File([new Uint8Array(bytes)], name, { type: "image/jpeg", lastModified: 123 });
function raster(patch: Partial<PhotoRaster> = {}): PhotoRaster {
  return { width: 4000, height: 6000, encode: vi.fn(async () => new Blob([new Uint8Array(200_000)], { type: "image/webp" })), close: vi.fn(), ...patch };
}
describe("photo optimization before transfer", () => {
  it("reduces a large portrait while keeping its aspect ratio, and transfers the encoded bytes", async () => {
    const original = file(8 * 1024 * 1024), image = raster();
    const prepared = await preparePostPhoto(original, async () => image);
    expect(image.encode).toHaveBeenCalledWith(1280, 1920, 0.82);
    expect(prepared.file.name).toBe("가상사진.webp");
    expect(prepared.file.type).toBe("image/webp");
    expect(prepared.file.size).toBe(200_000);
    expect(prepared.originalBytes).toBe(original.size);
    expect(original.size).toBe(8 * 1024 * 1024);
    expect(image.close).toHaveBeenCalledTimes(1);
  });
  it("never enlarges an already small photo or replaces it with a larger encoding", async () => {
    const original = file(30_000), image = raster({ width: 600, height: 400 });
    expect((await preparePostPhoto(original, async () => image)).file).toBe(original);
    expect(image.encode).toHaveBeenCalledWith(600, 400, 0.82);
    expect(image.close).toHaveBeenCalledTimes(1);
  });
  it("lowers quality and then resolution when the first output still exceeds one MB", async () => {
    const encode = vi.fn().mockResolvedValue(new Blob([new Uint8Array(MAX_PHOTO_UPLOAD_BYTES + 1)], { type: "image/webp" }))
      .mockResolvedValueOnce(new Blob([new Uint8Array(MAX_PHOTO_UPLOAD_BYTES + 1)], { type: "image/webp" }))
      .mockResolvedValueOnce(new Blob([new Uint8Array(MAX_PHOTO_UPLOAD_BYTES + 1)], { type: "image/webp" }))
      .mockResolvedValueOnce(new Blob([new Uint8Array(MAX_PHOTO_UPLOAD_BYTES + 1)], { type: "image/webp" }))
      .mockResolvedValueOnce(new Blob([new Uint8Array(800_000)], { type: "image/webp" }));
    const image = raster({ width: 6000, height: 4000, encode });
    const prepared = await preparePostPhoto(file(7_000_000), async () => image);
    expect(prepared.file.size).toBeLessThanOrEqual(MAX_PHOTO_UPLOAD_BYTES);
    expect(encode).toHaveBeenNthCalledWith(1, 1920, 1280, 0.82);
    expect(encode).toHaveBeenNthCalledWith(4, 1536, 1024, 0.62);
    expect(image.close).toHaveBeenCalledTimes(1);
  });
  it("uses the actual JPEG fallback type and extension", async () => {
    const image = raster({ encode: vi.fn(async () => new Blob([new Uint8Array(1000)], { type: "image/jpeg" })) });
    const prepared = await preparePostPhoto(file(5_000_000, "여행.PNG"), async () => image);
    expect(prepared.file.name).toBe("여행.jpg"); expect(prepared.file.type).toBe("image/jpeg");
  });
  it("does not fall back to uploading a large original when compression fails", async () => {
    const image = raster({ encode: vi.fn(async () => new Blob([new Uint8Array(1_100_000)], { type: "image/webp" })) });
    await expect(preparePostPhoto(file(8_000_000), async () => image)).rejects.toMatchObject({ code: "PHOTO_COMPRESSION_FAILED" });
    expect(image.encode).toHaveBeenCalledTimes(6); expect(image.close).toHaveBeenCalledTimes(1);
  });
  it("bounds source file size before decoding and rejects a document even with an image MIME type", async () => {
    const open = vi.fn();
    await expect(preparePostPhoto(file(MAX_SOURCE_PHOTO_BYTES + 1), open)).rejects.toMatchObject({ code: "PHOTO_SOURCE_TOO_LARGE" });
    await expect(preparePostPhoto(file(100, "자료.pdf"), open)).rejects.toMatchObject({ code: "UNSUPPORTED_POST_PHOTO" });
    expect(open).not.toHaveBeenCalled();
  });
  it("closes oversized decoded images without trying to encode them", async () => {
    const image = raster({ width: 10000, height: 10000 });
    await expect(preparePostPhoto(file(1000), async () => image)).rejects.toMatchObject({ code: "PHOTO_DIMENSIONS_TOO_LARGE" });
    expect(image.encode).not.toHaveBeenCalled(); expect(image.close).toHaveBeenCalledTimes(1);
  });
  it("reports unreadable images and encoding failures without silently discarding the photo", async () => {
    await expect(preparePostPhoto(file(1000), async () => { throw new Error("decode failed"); })).rejects.toMatchObject({ code: "PHOTO_PROCESSING_FAILED" });
    const image = raster({ encode: async () => { throw new Error("encode failed"); } });
    await expect(preparePostPhoto(file(1000), async () => image)).rejects.toMatchObject({ code: "PHOTO_PROCESSING_FAILED" });
    expect(image.close).toHaveBeenCalledTimes(1);
  });
});

describe("server photos-only validation", () => {
  const post = { id: "10000000-0000-4000-8000-000000000001", folderId: "10000000-0000-4000-8000-000000000002", title: "가상 이야기", body: "본문" };
  it("rejects documents on creation and oversized photo metadata instead of trusting the picker", () => {
    expect(() => parsePostInput({ ...post, files: [{ name: "자료.pdf", size: 100, sha256: "a".repeat(64) }] })).toThrow("UNSUPPORTED_POST_PHOTO");
    expect(() => parsePostInput({ ...post, files: [{ name: "사진.jpg", size: MAX_PHOTO_UPLOAD_BYTES + 1, sha256: "a".repeat(64) }] })).toThrow("FILE_TOO_LARGE");
  });
  it("checks all image bytes even when a caption or a valid first photo exists", async () => {
    const valid = await sharp({ create: { width: 8, height: 6, channels: 3, background: "#eef2f7" } }).webp().toBuffer();
    await expect(assertValidPostPhoto("글이 있습니다", [{ name: "사진.webp" }], () => valid)).resolves.toBeUndefined();
    await expect(assertValidPostPhoto("글이 있습니다", [{ name: "사진.webp" }, { name: "가짜.jpg" }], index => index ? Buffer.from("not an image") : valid)).rejects.toMatchObject({ code: "INVALID_POST_PHOTO" });
    await expect(assertValidPostPhoto("", [{ name: "사진.webp" }, { name: "가짜.jpg" }], index => index ? Buffer.from("not an image") : valid)).rejects.toMatchObject({ code: "INVALID_POST_PHOTO" });
  });
});
