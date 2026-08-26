import type { SessionUser } from "@/lib/session";
import type { AuthResult } from "@/lib/auth/auth-types";

export interface LocalCredentials {
  email: string;
  password: string;
  clientIp?: string;
}

export interface IdentityProvider {
  readonly id: "local" | "microsoft";
  authenticate?(credentials: LocalCredentials): Promise<AuthResult>;
}

export type MicrosoftCallbackResult =
  | { ok: true; user: SessionUser; correlationId: string }
  | { ok: false; redirectError: string; redirectDescription?: string };
