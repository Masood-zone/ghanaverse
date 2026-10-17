import { requireUserPage } from "@/lib/auth/access"
import { ReceiptContent } from "@/components/billing/receipt-content"
export default async function Page({
  params,
}: {
  params: Promise<{ reference: string }>
}) {
  const { reference } = await params
  await requireUserPage(`/plans/receipt/${encodeURIComponent(reference)}`)
  return <ReceiptContent reference={reference} />
}
