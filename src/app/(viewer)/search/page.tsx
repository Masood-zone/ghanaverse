import { redirect } from "next/navigation";
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) { const { q } = await searchParams; redirect(q ? `/browse?q=${encodeURIComponent(q)}` : "/browse"); }
