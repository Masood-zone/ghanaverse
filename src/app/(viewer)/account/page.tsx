import { SignOutButton } from "@/components/auth/sign-out-button";
import { Card } from "@/components/ui/card";
import { requireUserPage } from "@/lib/auth/access";

export default async function AccountPage() {
  const { user } = await requireUserPage("/account");
  return <section className="mx-auto max-w-3xl px-4 py-16 md:px-6 md:py-24"><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Account</p><h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-5xl">Your GhanaVerse account</h1><p className="mt-3 max-w-xl leading-7 text-muted-foreground">This server-rendered overview is connected to your active Better Auth session.</p><Card className="mt-8 divide-y overflow-hidden"><dl><div className="grid gap-1 p-5 sm:grid-cols-[10rem_1fr] sm:gap-6"><dt className="text-sm font-semibold text-muted-foreground">Name</dt><dd className="font-semibold">{user.name}</dd></div><div className="grid gap-1 p-5 sm:grid-cols-[10rem_1fr] sm:gap-6"><dt className="text-sm font-semibold text-muted-foreground">Email</dt><dd className="font-semibold">{user.email}</dd></div><div className="grid gap-1 p-5 sm:grid-cols-[10rem_1fr] sm:gap-6"><dt className="text-sm font-semibold text-muted-foreground">Role</dt><dd><span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-bold tracking-wide text-primary">{user.role}</span></dd></div></dl><div className="p-3"><SignOutButton /></div></Card></section>;
}
