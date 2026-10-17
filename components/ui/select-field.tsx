"use client"

import {
  Children,
  isValidElement,
  type ComponentProps,
  type ReactNode,
} from "react"
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ItemProps = { value: string | number; children: ReactNode }

export type SelectFieldProps = Pick<
  ComponentProps<typeof SelectTrigger>,
  | "id"
  | "className"
  | "aria-label"
  | "aria-labelledby"
  | "aria-describedby"
  | "aria-invalid"
  | "onBlur"
  | "ref"
> & {
  children: ReactNode
  name?: string
  value?: string | number | null
  defaultValue?: string | number
  onValueChange?: (value: string) => void
  disabled?: boolean
  required?: boolean
}

// The same composition supports both ordinary filters and registered forms.
// Providing labels up front also renders the selected label before opening.
export function SelectField({
  children,
  name,
  value,
  defaultValue,
  onValueChange,
  disabled,
  required,
  ...props
}: SelectFieldProps) {
  const items = Children.toArray(children).flatMap((child) =>
    isValidElement<ItemProps>(child)
      ? [{ value: String(child.props.value), label: child.props.children }]
      : []
  )
  return (
    <Select
      items={items}
      name={name}
      value={value == null ? undefined : String(value)}
      defaultValue={defaultValue == null ? undefined : String(defaultValue)}
      onValueChange={(next) => onValueChange?.(next ?? "")}
      disabled={disabled}
      required={required}
    >
      <SelectTrigger {...props}>
        <SelectValue data-slot="select-value" />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  )
}
