import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"
export function MaterialSymbol({icon, filled, className, ...props}: HTMLAttributes<HTMLSpanElement> & {icon:string; filled?:boolean}) {
 return <span aria-hidden="true" className={cn("material-symbols-outlined select-none leading-none",filled && "filled",className)} {...props}>{icon}</span>
}
