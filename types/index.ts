export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  code?: string
  errors?: Record<string, string[]>
}
