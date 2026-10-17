import { requireUserPage } from "@/lib/auth/access"
import { PaymentResult } from "@/components/billing/payment-result"
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>
}) {
  const params = await searchParams
  const candidate = params.reference || params.trxref || ""
  const reference =
    typeof candidate === "string" && candidate.length <= 100 ? candidate : ""
  await requireUserPage(
    `/plans/result?reference=${encodeURIComponent(reference)}`
  )
  return <PaymentResult reference={reference} />
}
