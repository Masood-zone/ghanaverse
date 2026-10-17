import { RecoveryForm } from "@/components/auth/recovery-form"
export const metadata = {
  title: "Account recovery | GhanaVerse",
  robots: { index: false, follow: false },
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const query = await searchParams
  return <RecoveryForm token={query.token} invalid={Boolean(query.error)} />
}
