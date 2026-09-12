import Link from "next/link";

export function Brand({ admin = false }: { admin?: boolean }) {
  return <Link href={admin ? "/admin" : "/"} className="text-xl font-extrabold tracking-tight text-foreground">Ghana<span className="text-primary">Verse</span>{admin && <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</span>}</Link>;
}
