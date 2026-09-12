import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ mode?: string; callbackUrl?: string }> }) {
  const query = await searchParams;
  const callbackUrl = query.callbackUrl?.startsWith("/") && !query.callbackUrl.startsWith("//") ? query.callbackUrl : "/";
  return <main className="relative grid min-h-screen overflow-hidden bg-background md:grid-cols-[.9fr_1.1fr]">
    <div className="pointer-events-none absolute left-1/2 top-10 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,#fef3c7_0%,rgba(254,243,199,0)_68%)]" />
    <aside className="relative hidden overflow-hidden bg-muted p-10 md:flex md:flex-col md:justify-between">
      <div className="absolute inset-y-0 right-0 w-1.5 bg-[linear-gradient(#d97706,#dc2626,#15803d)]" />
      <div className="relative"><Link href="/" className="text-2xl font-extrabold">Ghana<span className="text-primary">Verse</span></Link><p className="mt-2 text-sm text-muted-foreground">The home of Ghanaian entertainment</p></div>
      <div className="relative"><span className="inline-flex rounded-full bg-card px-3 py-1 text-xs font-bold uppercase tracking-[.14em] text-secondary shadow-sm">Viewer access</span><p className="mt-8 text-sm font-bold uppercase tracking-[.18em] text-primary">Warm Heritage Stream</p><h2 className="mt-4 text-4xl font-extrabold tracking-tight">A home for Ghanaian stories.</h2><p className="mt-4 max-w-sm leading-7 text-muted-foreground">A calm, editorial viewing experience built for cinema, culture, and memory.</p></div>
      <p className="relative text-sm text-muted-foreground">Foundation access · Viewer accounts only</p>
    </aside>
    <section className="relative z-10 flex items-center justify-center p-6 md:p-12"><AuthForm initialMode={query.mode === "register" ? "register" : "sign-in"} callbackUrl={callbackUrl} /></section>
  </main>;
}
