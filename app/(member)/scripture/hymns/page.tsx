import Link from "next/link";
import { HymnCatalog } from "../../../../components/scripture/HymnCatalog";

export const metadata = { title: "찬송가" };

export default function HymnCatalogPage() {
  return <>
    <Link className="scripture-back" href="/scripture">‹ 성경 찬송가</Link>
    <HymnCatalog />
  </>;
}
