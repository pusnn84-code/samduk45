import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CommunityDirectory } from "../../components/directory/CommunityDirectory";
import type { DirectoryMember, DirectorySam } from "../../src/features/directory/service";

vi.stubGlobal("React", React);
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) =>
    React.createElement("a", props, children),
}));

const member: DirectoryMember = {
  id: "synthetic-member",
  name: "가상구성원",
  village: "5마을",
  sam: "5-6샘",
  churchOffice: "성도",
  phone: null,
  phoneUnavailable: false,
  contactStatus: "password_required",
  roles: ["샘원"],
  age: null,
  gender: null,
};

function renderDirectory(members: DirectoryMember[], sams: DirectorySam[]) {
  return renderToStaticMarkup(React.createElement(CommunityDirectory, { members, sams })).replace(/<!--.*?-->/g, "");
}

describe("registered directory groups", () => {
  it("shows the registered leader despite no matching roster profile while retaining actual membership counts", () => {
    const html = renderDirectory([member], [{ name: "5-6샘", village: "5마을", leaderName: "가상미등록리더" }]);
    expect(html).toContain('<span>샘리더</span> <b>가상미등록리더</b>');
    expect(html).not.toContain('class="directory-member-card"');
    expect(html).not.toContain('aria-label="가상미등록리더 ');
    expect(html).toContain('class="directory-sam-count">1명');
  });

  it("shows a registered group with zero members without inventing a profile", () => {
    const html = renderDirectory([], [{ name: "5-6샘", village: "5마을", leaderName: "가상미등록리더" }]);
    expect(html).toContain('<span>샘리더</span> <b>가상미등록리더</b>');
    expect(html).toContain('class="directory-sam-count">0명');
    expect(html).not.toContain('class="directory-member-card"');
  });

  it("keeps numeric village and sam ordering when registered groups supplement roster groups", () => {
    const html = renderDirectory([member], [
      { name: "5-10샘", village: "5마을", leaderName: "가상열리더" },
      { name: "10-1샘", village: "10마을", leaderName: "가상다른리더" },
      { name: "5-2샘", village: "5마을", leaderName: "가상둘리더" },
      { name: "2-1샘", village: "2마을", leaderName: "가상앞리더" },
    ]);
    const positions = ["2마을", "5마을", "10마을"].map(name => html.indexOf(`<strong>${name}</strong>`));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    const samPositions = ["5-2샘", "5-6샘", "5-10샘"].map(name => html.indexOf(`<strong>${name}</strong>`));
    expect(samPositions).toEqual([...samPositions].sort((a, b) => a - b));
  });
});
