import { handleAnalytics } from "@/services/analytics/handler"
export const GET = (request: Request) => handleAnalytics(request, true)
