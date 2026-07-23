import * as client from "openid-client";
import { randomUUID } from "crypto";
import { getMicrosoftAuthConfig } from "@/lib/auth/auth-config";
import type { MicrosoftIdTokenClaims } from "@/lib/auth/auth-types";
import type { OAuthPendingPayload } from "@/lib/auth/oauth-state";
import type { MicrosoftCallbackResult } from "@/lib/auth/providers/auth-types";
import { provisionMicrosoftUser } from "@/lib/auth/user-provisioning";
import { establishSession } from "@/lib/auth/session-bridge";
import { AuthProvider } from "@/generated/prisma/enums";

let cachedConfig: client.Configuration | null = null;

export async function getMicrosoftOpenIdConfig(): Promise<client.Configuration> {
  const cfg = getMicrosoftAuthConfig();
  if (!cfg) throw new Error("Microsoft SSO is not configured");

  if (!cachedConfig) {
    cachedConfig = await client.discovery(
      cfg.issuerUrl,
      cfg.clientId,
      cfg.clientSecret
    );
  }
  return cachedConfig;
}

export async function buildMicrosoftAuthorizationUrl(
  pending: OAuthPendingPayload
): Promise<URL> {
  const cfg = getMicrosoftAuthConfig();
  if (!cfg) throw new Error("Microsoft SSO is not configured");

  const openId = await getMicrosoftOpenIdConfig();
  const codeChallenge = await client.calculatePKCECodeChallenge(pending.codeVerifier);

  return client.buildAuthorizationUrl(openId, {
    redirect_uri: cfg.redirectUri,
    scope: "openid profile email offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state: pending.state,
    nonce: pending.nonce,
    response_mode: "query",
  });
}

export function createOAuthPendingState(returnTo: string): OAuthPendingPayload {
  return {
    state: client.randomState(),
    nonce: client.randomNonce(),
    codeVerifier: client.randomPKCECodeVerifier(),
    returnTo,
  };
}

export async function handleMicrosoftCallback(
  request: Request,
  pending: OAuthPendingPayload
): Promise<MicrosoftCallbackResult> {
  const cfg = getMicrosoftAuthConfig();
  if (!cfg) {
    return { ok: false, redirectError: "sso_disabled", redirectDescription: "Microsoft SSO is not configured." };
  }

  const correlationId = randomUUID();

  try {
    const openId = await getMicrosoftOpenIdConfig();
    const tokens = await client.authorizationCodeGrant(openId, request, {
      pkceCodeVerifier: pending.codeVerifier,
      expectedState: pending.state,
      expectedNonce: pending.nonce,
      idTokenExpected: true,
    });

    const claims = tokens.claims() as MicrosoftIdTokenClaims | undefined;
    if (!claims) {
      return {
        ok: false,
        redirectError: "invalid_token",
        redirectDescription: "Microsoft did not return identity claims.",
      };
    }

    const provision = await provisionMicrosoftUser({
      claims,
      tenantId: cfg.tenantId,
      correlationId,
    });

    if (!provision.ok) {
      return {
        ok: false,
        redirectError: provision.code,
        redirectDescription: provision.message,
      };
    }

    const sessionUser = await establishSession({
      userId: provision.userId,
      authProvider: AuthProvider.microsoft,
    });

    if (!sessionUser) {
      return {
        ok: false,
        redirectError: "sso_denied",
        redirectDescription: "Unable to create session.",
      };
    }

    return { ok: true, user: sessionUser, correlationId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Microsoft sign-in failed.";
    return { ok: false, redirectError: "sso_denied", redirectDescription: message };
  }
}
