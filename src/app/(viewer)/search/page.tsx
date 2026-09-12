import { CataloguePage } from "@/components/catalogue/catalogue-page";
export default function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <CataloguePage searchParams={searchParams} route="/search" />; }
