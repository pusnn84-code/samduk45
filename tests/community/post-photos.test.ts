import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PostPhotos } from "../../components/community/PostPhotos";

vi.stubGlobal("React", React);
const postId = "10000000-0000-4000-8000-000000000001";
const hash = "a".repeat(64);

describe("private post photo rendering", () => {
  it("renders the photo from its original slot through the authenticated image endpoint", () => {
    const html = renderToStaticMarkup(React.createElement(PostPhotos, {
      postId,
      files: [
        { slot: 0, name: "synthetic-notes.txt", size: 20, sha256: "b".repeat(64) },
        { slot: 1, name: "synthetic-photo.png", size: 1024, sha256: hash },
      ],
    }));
    expect(html).toContain(`src="/api/community/posts/${postId}/files/1/image?sha=${hash}"`);
    expect(html).toContain('alt="synthetic-photo.png"');
    expect(html).not.toContain("synthetic-notes.txt");
    expect(html).not.toContain("/_next/image");
  });

  it.each(["jfif", "JPE"])("renders a JPEG .%s attachment alongside normal post content", extension => {
    const html = renderToStaticMarkup(React.createElement(PostPhotos, {
      postId,
      files: [{ slot: 0, name: `synthetic-photo.${extension}`, size: 1024, sha256: hash }],
    }));
    expect(html).toContain(`src="/api/community/posts/${postId}/files/0/image?sha=${hash}"`);
  });
});
