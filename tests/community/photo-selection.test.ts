import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { releasePhotoPreviews, selectPostFiles, updatePhotoPreviews } from "../../components/community/photo-selection";
import { assertValidPostPhoto } from "../../src/features/community/images";
import { MAX_FILE_BYTES, parsePostInput } from "../../src/features/community/policy";

const photo = (name = "synthetic-photo.jpg") => new File(["synthetic bytes"], name, { type: "image/jpeg" });
const document = () => new File(["synthetic document"], "synthetic-notes.txt", { type: "text/plain" });

function objectUrls() {
  let index = 0;
  return {
    createObjectURL: vi.fn(() => `blob:synthetic-${++index}`),
    revokeObjectURL: vi.fn(),
  };
}

describe("post attachment selection", () => {
  it("accepts photos and rejects documents through every picker path", () => {
    const selectedPhoto = photo();
    const selectedDocument = document();
    expect(selectPostFiles([], [], [selectedPhoto])).toEqual([selectedPhoto]);
    expect(() => selectPostFiles([], [selectedPhoto], [selectedDocument])).toThrow("UNSUPPORTED_POST_PHOTO");
    expect(() => selectPostFiles([], [], [selectedDocument])).toThrow("UNSUPPORTED_POST_PHOTO");
  });

  it("rejects oversize or excess files without mutating the accepted selection", () => {
    const accepted = [photo()];
    const oversize = new File([new Uint8Array(MAX_FILE_BYTES + 1)], "too-large.jpg", { type: "image/jpeg" });
    expect(() => selectPostFiles([], accepted, [oversize])).toThrow("FILE_TOO_LARGE");
    expect(accepted).toHaveLength(1);
    expect(() => selectPostFiles([], accepted, Array.from({length:10},(_,i)=>photo(`photo-${i}.jpg`)))).toThrow("TOO_MANY_FILES");
    expect(accepted).toHaveLength(1);
  });

  it("counts retained published attachments together with newly selected files", () => {
    const retained = [{ name: "saved-photo.jpg", size: 10, sha256: "a".repeat(64) }];
    expect(selectPostFiles(retained, [], Array.from({length:9},()=>photo()))).toHaveLength(9);
    expect(() => selectPostFiles(retained, Array.from({length:9},()=>photo()), [photo("eleventh.jpg")])).toThrow("TOO_MANY_FILES");
  });
});

describe("selected photo preview URL lifecycle", () => {
  it("previews only photos and preserves their URLs while the selection is unchanged", () => {
    const urls = objectUrls();
    const selectedPhoto = photo();
    const first = updatePhotoPreviews([], [selectedPhoto, document()], urls);
    expect(first).toEqual([{ file: selectedPhoto, url: "blob:synthetic-1" }]);
    const next = updatePhotoPreviews(first, [selectedPhoto], urls);
    expect(next[0]).toBe(first[0]);
    expect(urls.createObjectURL).toHaveBeenCalledTimes(1);
    expect(urls.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("revokes removed/replaced previews and releases the final selection on unmount", () => {
    const urls = objectUrls();
    const firstPhoto = photo("first.jpg");
    const secondPhoto = photo("second.jpg");
    const first = updatePhotoPreviews([], [firstPhoto, secondPhoto], urls);
    const next = updatePhotoPreviews(first, [secondPhoto], urls);
    expect(urls.revokeObjectURL).toHaveBeenCalledWith("blob:synthetic-1");
    expect(next).toEqual([first[1]]);
    releasePhotoPreviews(next, urls);
    expect(urls.revokeObjectURL).toHaveBeenLastCalledWith("blob:synthetic-2");
  });

  it("cleans up partially created URLs if a replacement fails while keeping existing previews valid", () => {
    const urls = objectUrls();
    const previous = updatePhotoPreviews([], [photo("saved.jpg")], urls);
    urls.createObjectURL
      .mockReturnValueOnce("blob:replacement")
      .mockImplementationOnce(() => { throw new Error("Synthetic URL creation failure"); });
    expect(() => updatePhotoPreviews(previous, [photo("first.jpg"), photo("second.jpg")], urls)).toThrow();
    expect(urls.revokeObjectURL).toHaveBeenCalledWith("blob:replacement");
    expect(urls.revokeObjectURL).not.toHaveBeenCalledWith(previous[0].url);
  });
});

describe("JPEG photo filename variants", () => {
  it.each(["jfif", "jpe"])("accepts and decodes normal JPEG bytes named .%s", async extension => {
    const jpeg = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#b4cad8" } }).jpeg().toBuffer();
    const files = [{ name: `synthetic-photo.${extension}`, size: jpeg.length, sha256: "a".repeat(64) }];
    expect(parsePostInput({
      id: "10000000-0000-4000-8000-000000000001",
      folderId: "10000000-0000-4000-8000-000000000002",
      title: "가상 사진 게시글",
      body: "",
      files,
    }).files).toHaveLength(1);
    await expect(assertValidPostPhoto("", files, () => jpeg)).resolves.toBeUndefined();
  });

  it("rejects a non-image body renamed to the newly supported JPEG extension", async () => {
    await expect(assertValidPostPhoto("", [{ name: "not-a-photo.jfif" }], () => Buffer.from("<html>not a photo</html>"))).rejects.toMatchObject({ code: "INVALID_POST_PHOTO" });
  });
});
