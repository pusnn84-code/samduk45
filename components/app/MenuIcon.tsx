import * as React from "react";

export type MenuIconName = "compass" | "people" | "bell" | "book" | "reading" | "calendar" | "heart" | "messages" | "journal" | "home" | "menu" | "birthday" | "install" | "leaf";

const shapes: Record<MenuIconName, React.ReactNode> = {
  leaf: <><path d="M20 3C9 2 3 7 4 14c1 5 8 7 12 3s4-9 4-14Z"/><path d="M3 22 16 9M8 17l-1-6M11 14h5"/></>,
  birthday: <><path d="M5 11h14a2 2 0 0 1 2 2v7H3v-7a2 2 0 0 1 2-2ZM3 15c2 2 4 2 6 0 2 2 4 2 6 0 2 2 4 2 6 0M8 7v4M12 7v4M16 7v4M8 3v1M12 2v2M16 3v1" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5.2" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path d="M10 21h4" /></>,
  book: <><path d="M12 5v15M12 5C9 3 5 3 2.5 4v15c3-1 6.5-1 9.5 1 3-2 6.5-2 9.5-1V4C19 3 15 3 12 5Z" /><path d="M6 8h2M16 8h2" /></>,
  reading: <><path d="M20 8V4H7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h5M4 19a2 2 0 0 0 2 2h12M9 8h6M9 12h3" /><path d="m14 14 2.5 2.5L21 12" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 11h18M8 15h2M14 15h2" /></>,
  heart: <path d="M20.5 5.5a5.1 5.1 0 0 0-7.2 0L12 6.8l-1.3-1.3a5.1 5.1 0 0 0-7.2 7.2L12 21l8.5-8.3a5.1 5.1 0 0 0 0-7.2Z" />,
  messages: <><path d="M14 15H7l-4 4V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v6" /><path d="M12 9h7a2 2 0 0 1 2 2v10l-4-3h-5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z" /></>,
  journal: <><rect x="5" y="3" width="15" height="18" rx="2" /><path d="M3 7h4M3 12h4M3 17h4M10 8h6M10 12h6M10 16h3" /></>,
  home: <path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  install: <path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4" />,
};

export function MenuIcon({ name }: { name: MenuIconName }) {
  return <svg className="menu-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shapes[name]}</svg>;
}
