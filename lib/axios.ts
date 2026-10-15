import axios from "axios"
import { toApiClientError } from "@/lib/api-client-error"
const api = axios.create({ baseURL: "/api", withCredentials: true, timeout: 30000 })
api.interceptors.response.use(response => response, error => Promise.reject(toApiClientError(error)))
export default api
