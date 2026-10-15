import axios from "axios"
import { toApiClientError } from "@/lib/api-client-error"
const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 30000,
})
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const parsed = toApiClientError(error)
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/auth")
    ) {
      if (parsed.status === 401 || parsed.status === 403)
        window.dispatchEvent(
          new CustomEvent("ghanaverse:access-error", {
            detail: { status: parsed.status },
          })
        )
    }
    return Promise.reject(parsed)
  }
)
export default api
