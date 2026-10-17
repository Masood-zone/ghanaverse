import Link from "@/components/common/app-link"

const steps = ["Choose your pass", "Payment details", "Welcome to Premium"]
export function CheckoutSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav
      aria-label="Premium checkout progress"
      className="gv-checkout-progress"
    >
      <ol>
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={current === index + 1 ? "step" : undefined}
          >
            <span className="gv-checkout-number" aria-hidden="true">
              {index + 1 < current ? "✓" : index + 1}
            </span>
            {index + 1 < current ? (
              <Link href={index === 0 ? "/plans" : "/plans?step=payment"}>
                {label}
              </Link>
            ) : (
              <span>{label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
