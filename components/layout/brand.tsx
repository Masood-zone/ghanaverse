import Link from "@/components/common/app-link"
import Image from "next/image"

export function Brand({ admin = false }: { admin?: boolean }) {
  return (
    <Link
      href={admin ? "/admin" : "/"}
      className="inline-flex shrink-0 items-center gap-2 text-lg font-extrabold tracking-tight text-foreground"
    >
      <Image
        src="/images/brand-mark.svg"
        alt=""
        width={28}
        height={28}
        priority
      />
      <span>
        Ghana<span className="text-primary">Verse</span>
      </span>
      {admin && (
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          Admin
        </span>
      )}
    </Link>
  )
}
