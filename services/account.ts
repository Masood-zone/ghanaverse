import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
export type AccountSummary = {
  id: string;
  name: string;
  email: string;
  role: "VIEWER" | "ADMIN";
};
export const getAccount = () => api<AccountSummary>("/account");
export const useAccount = () =>
  useQuery({ queryKey: ["account"], queryFn: getAccount });
