import books from "../../data/scripture-library/books.json";

export function getBibleReadingChapters(passage: string) {
  return passage.split(" · ").flatMap(part => {
    const match = /^([가-힣]+)(?: (\d+)(?:[–-](\d+))?장)?$/.exec(part);
    const book = match && books.find(book => book.name === match[1]);
    if (!match || !book) return [];
    const first = Number(match[2] ?? 1);
    const last = Number(match[3] ?? first);
    if (first < 1 || last < first || last > book.chapters.length) return [];
    return Array.from({ length: last - first + 1 }, (_, index) => {
      const chapter = first + index;
      return { book: book.id, abbreviation: book.short, chapter, label: `${book.name} ${chapter}장`,
        href: `/scripture/bible/${book.id}/${chapter}` };
    });
  });
}

export function getBibleReadingLinks(passage: string) {
  return getBibleReadingChapters(passage).map(({ label, href }) => ({ label, href }));
}
