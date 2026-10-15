// Empty optional number fields must stay null, including their initial RHF value.
export function toOptionalNumber(value: unknown): number | null {
  return value === null || value === undefined || value === ""
    ? null
    : Number(value)
}
