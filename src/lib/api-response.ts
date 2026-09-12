export function apiSuccess<T>(data: T, message?: string) {
  return Response.json({ success: true, data, message });
}
export function apiError(message: string, status: number, code?: string) {
  return Response.json({ success: false, message, code }, { status });
}
