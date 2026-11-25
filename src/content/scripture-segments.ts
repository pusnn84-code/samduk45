export type ScriptureSegment = { kind: "heading" | "text"; text: string };

/** Editorial headings remain readable, but are never part of a selectable verse. */
export function scriptureSegments(source: string): ScriptureSegment[] {
  return source.split(/(<[^>]+>)/g).flatMap(value => {
    const heading = value.startsWith("<") && value.endsWith(">");
    const text = (heading ? value.slice(1, -1) : value).trim();
    return text ? [{ kind: heading ? "heading" as const : "text" as const, text }] : [];
  });
}

export function scriptureVerseText(source: string): string {
  return scriptureSegments(source).filter(segment => segment.kind === "text")
    .map(segment => segment.text).join(" ").replace(/\s+/g, " ").trim();
}
