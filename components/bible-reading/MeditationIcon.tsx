export function MeditationIcon({name}:{name:"comment"|"edit"|"delete"|"send"}) {
 const paths={comment:"M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.9L3 21l1.4-4.7A9 9 0 1 1 21 11.5Z",edit:"m16 3 5 5M3 21l5-1L21 7a3.5 3.5 0 0 0-5-5L3 16z",delete:"M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",send:"m3 3 19 9-19 9 4-9zM7 12h15"};
 return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
