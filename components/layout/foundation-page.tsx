import { Card } from "@/components/ui/card";
export function FoundationPage({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <section className="mx-auto max-w-5xl px-4 py-16 md:px-6 md:py-24"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p><h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-5xl">{title}</h1><Card className="mt-8 max-w-2xl p-6"><p className="leading-7 text-muted-foreground">{description}</p><p className="mt-4 text-sm font-semibold text-secondary">Foundation route ready</p></Card></section>;
}
