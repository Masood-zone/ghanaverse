import { PlansContent } from "@/components/billing/plans-content"
import { PaymentDetails } from "@/components/billing/payment-details"
import { requireUserPage } from "@/lib/auth/access"
export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; reference?: string }>
}) {
  const { step, reference } = await searchParams
  if (step === "payment") {
    const ownedReference =
      typeof reference === "string" && reference.length <= 100 ? reference : ""
    await requireUserPage(
      `/plans?step=payment${ownedReference ? `&reference=${encodeURIComponent(ownedReference)}` : ""}`
    )
    return <PaymentDetails reference={ownedReference} />
  }
  return <PlansContent />
}
