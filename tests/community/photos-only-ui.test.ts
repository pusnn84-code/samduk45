import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.stubGlobal("React", React);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => React.createElement("a", props, children) }));
import { PostEditor } from "../../components/community/PostEditor";
import { PostDetail } from "../../components/community/PostDetail";
import type { Post } from "../../components/community/shared";

describe("Doran photos and text interface", () => {
  it("offers exactly one photo picker and explains optimization before transfer", () => {
    const html = renderToStaticMarkup(React.createElement(PostEditor, { folders: [{ id: "folder", name: "이야기", postCount: 0 }], basePath: "/community", onSaved() {} }));
    expect(html.match(/type="file"/g)).toHaveLength(1);
    expect(html).toContain('accept="image/jpeg,');
    expect(html).toContain("1,920px"); expect(html).toContain("1MB");
    expect(html).not.toContain("첨부파일 (최대"); expect(html).not.toContain("문서와 사진");
  });
  it("shows the photo and caption together without a separate attachment-download section", () => {
    const post: Post = { id: "post", folderId: "folder", folderName: "이야기", title: "가상 제목", body: "사진과 함께 나누는 글", authorId: "author", authorName: "가상작성자", createdAt: "2026-11-05T00:00:00Z", updatedAt: "2026-11-05T00:00:00Z", publishedAt: "2026-11-05T00:00:00Z", version: 1, files: [{ slot: 0, name: "가상사진.webp", size: 50000, sha256: "a".repeat(64) }], liked: false, likeCount: 0 };
    const html = renderToStaticMarkup(React.createElement(PostDetail, { post, user: { id: "reader", role: "member" }, basePath: "/community", reload() {}, onDeleted() {} }));
    expect(html).toContain("가상사진.webp"); expect(html).toContain("사진과 함께 나누는 글");
    expect(html).toContain("좋아요"); expect(html).toContain("댓글");
    expect(html).not.toContain("community-attachments"); expect(html).not.toContain("community-download");
  });
});
