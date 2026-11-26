import Link from "next/link";
import type {ScriptureNeighbors} from "../../src/content/scripture-navigation";
export function ScriptureNavigation({neighbors,label}:{neighbors:ScriptureNeighbors;label:string}){
 return <nav className="scripture-page-navigation" aria-label={label}>{([['previous','이전 장','‹'],['next','다음 장','›']] as const).map(([direction,text,arrow])=>{const item=neighbors[direction];return item?<Link key={direction} href={item.href} aria-label={text+' · '+item.label} className={'scripture-page-link is-'+direction}><span>{direction==='previous'&&<span aria-hidden="true">{arrow} </span>}{text}{direction==='next'&&<span aria-hidden="true"> {arrow}</span>}</span><small>{item.label}</small></Link>:<button key={direction} type="button" className="scripture-page-link" disabled>{text}</button>;})}</nav>;
}
