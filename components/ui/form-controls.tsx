"use client"

import { useId, type ComponentProps } from "react"
import {
  useController,
  type FieldValues,
  type UseControllerProps,
} from "react-hook-form"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  DateTimePicker,
  type DateTimePickerProps,
} from "@/components/ui/date-time-picker"
import {
  SelectField,
  type SelectFieldProps,
} from "@/components/ui/select-field"

type Binding<T extends FieldValues> = Pick<
  UseControllerProps<T>,
  "control" | "name"
>

export function FormDateTimePicker<T extends FieldValues>({
  control,
  name,
  required,
  ...props
}: Binding<T> & Omit<DateTimePickerProps, "value" | "onValueChange">) {
  const errorId = useId()
  const { field, fieldState } = useController({
    control,
    name,
    rules: { required: required ? "Choose a date and time." : false },
  })
  return (
    <div className="space-y-1.5">
      <DateTimePicker
        {...props}
        ref={field.ref}
        required={required}
        value={field.value ?? ""}
        onValueChange={field.onChange}
        onBlur={field.onBlur}
        aria-invalid={fieldState.invalid || undefined}
        aria-describedby={
          [props["aria-describedby"], fieldState.error ? errorId : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
      />
      {fieldState.error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {fieldState.error.message}
        </p>
      ) : null}
    </div>
  )
}

export function FormSelect<T extends FieldValues>({
  control,
  name,
  onValueChange,
  ...props
}: Binding<T> & Omit<SelectFieldProps, "name" | "value" | "defaultValue">) {
  const {
    field: { ref, value, onChange, onBlur },
    fieldState,
  } = useController({ control, name })
  return (
    <SelectField
      {...props}
      name={name}
      ref={ref}
      value={value ?? ""}
      onValueChange={(value) => {
        onChange(value)
        onValueChange?.(value)
      }}
      onBlur={onBlur}
      aria-invalid={fieldState.invalid || undefined}
    />
  )
}

export function FormSwitch<T extends FieldValues>({
  control,
  name,
  ...props
}: Binding<T> &
  Omit<
    ComponentProps<typeof Switch>,
    "name" | "checked" | "defaultChecked" | "onCheckedChange"
  >) {
  const { field, fieldState } = useController({ control, name })
  return (
    <Switch
      {...props}
      name={field.name}
      inputRef={field.ref}
      checked={Boolean(field.value)}
      onCheckedChange={field.onChange}
      onBlur={field.onBlur}
      aria-invalid={fieldState.invalid || undefined}
    />
  )
}

export function FormCheckbox<T extends FieldValues>({
  control,
  name,
  value,
  ...props
}: Binding<T> &
  Omit<
    ComponentProps<typeof Checkbox>,
    "name" | "value" | "checked" | "defaultChecked" | "onCheckedChange"
  > & { value?: string }) {
  const { field, fieldState } = useController({ control, name })
  const selected: string[] = Array.isArray(field.value) ? field.value : []
  return (
    <Checkbox
      {...props}
      name={field.name}
      inputRef={field.ref}
      value={value}
      checked={
        value === undefined ? Boolean(field.value) : selected.includes(value)
      }
      onCheckedChange={(checked) =>
        field.onChange(
          value === undefined
            ? checked
            : checked
              ? [...selected, value]
              : selected.filter((item) => item !== value)
        )
      }
      onBlur={field.onBlur}
      aria-invalid={fieldState.invalid || undefined}
    />
  )
}
