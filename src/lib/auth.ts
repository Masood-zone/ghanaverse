import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { getPrisma } from "@/lib/prisma";
import { DEFAULT_REGISTRATION_ROLE } from "@/lib/auth/policy";

function createAuth(secret: string, baseURL: string) {
  return betterAuth({
    baseURL,
    secret,
    database: prismaAdapter(getPrisma(), { provider: "postgresql" }),
    emailAndPassword: { enabled: true },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: DEFAULT_REGISTRATION_ROLE,
          input: false,
        },
      },
    },
  });
}

let authInstance: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  if (authInstance) return authInstance;
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || !baseURL)
    throw new Error("BETTER_AUTH_SECRET and BETTER_AUTH_URL are required.");
  const configured = createAuth(secret, baseURL);
  authInstance = configured;
  return configured;
}
