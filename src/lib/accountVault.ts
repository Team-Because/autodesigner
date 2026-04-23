import { Session } from "@supabase/supabase-js";

/**
 * Multi-account session vault.
 *
 * Stores a snapshot of every Supabase session the user has signed into on this
 * device, so we can switch between accounts without forcing a sign-out / sign-in
 * round trip. The Supabase client only ever holds ONE active session at a time
 * (in localStorage under the default key); the vault is a separate parallel
 * store that lets us swap the active session in/out via `supabase.auth.setSession`.
 */

const VAULT_KEY = "mma-account-vault-v1";

export interface VaultedAccount {
  userId: string;
  username: string;
  displayName?: string;
  email?: string;
  accessToken: string;
  refreshToken: string;
  /** Epoch seconds — used to know if we should pre-refresh before swap */
  expiresAt?: number;
  /** Last time this account was active in the UI */
  lastActiveAt: number;
}

function readVault(): VaultedAccount[] {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeVault(list: VaultedAccount[]) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(list));
}

export function listAccounts(): VaultedAccount[] {
  // Most-recently-active first
  return readVault().sort((a, b) => b.lastActiveAt - a.lastActiveAt);
}

export function getAccount(userId: string): VaultedAccount | undefined {
  return readVault().find((a) => a.userId === userId);
}

export function upsertAccount(
  session: Session,
  meta: { username: string; displayName?: string }
) {
  const list = readVault().filter((a) => a.userId !== session.user.id);
  list.push({
    userId: session.user.id,
    username: meta.username,
    displayName: meta.displayName,
    email: session.user.email ?? undefined,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? undefined,
    lastActiveAt: Date.now(),
  });
  writeVault(list);
}

/** Refresh tokens for the currently active session in the vault. */
export function refreshActiveTokens(session: Session) {
  const list = readVault();
  const idx = list.findIndex((a) => a.userId === session.user.id);
  if (idx === -1) return;
  list[idx] = {
    ...list[idx],
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? undefined,
    lastActiveAt: Date.now(),
    email: session.user.email ?? list[idx].email,
  };
  writeVault(list);
}

export function removeAccount(userId: string) {
  writeVault(readVault().filter((a) => a.userId !== userId));
}

export function markActive(userId: string) {
  const list = readVault();
  const idx = list.findIndex((a) => a.userId === userId);
  if (idx === -1) return;
  list[idx] = { ...list[idx], lastActiveAt: Date.now() };
  writeVault(list);
}

/**
 * Activate a vaulted account on the live Supabase client.
 *
 * Strategy:
 *   1. If the access token is near/past expiry, try to refresh BEFORE setSession
 *      (using the refresh token directly via the auth REST endpoint). Refresh
 *      tokens are long-lived (default 30 days+) so this usually works even when
 *      the access token has been expired for a while.
 *   2. Call supabase.auth.setSession with whichever tokens we now hold.
 *   3. If setSession still rejects them, try one more refresh-then-set as a
 *      last resort (covers edge cases where step 1 was skipped).
 *
 * Returns the new session on success, or null if the vaulted credentials are
 * unrecoverable (refresh token revoked / user deleted / etc.) — in which case
 * the caller should fall back to the login flow.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Session as SupabaseSession } from "@supabase/supabase-js";

const ACCESS_TOKEN_SAFETY_WINDOW_SEC = 60; // refresh if <60s left

async function refreshTokenPair(refreshToken: string) {
  // Use supabase.auth.refreshSession — when called with an explicit refresh
  // token it will exchange it without needing the access token to still be valid.
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return null;
  return data.session;
}

export async function activateVaultedAccount(
  account: VaultedAccount
): Promise<SupabaseSession | null> {
  const nowSec = Math.floor(Date.now() / 1000);
  const isExpiredOrNearExpiry =
    !account.expiresAt || account.expiresAt - nowSec <= ACCESS_TOKEN_SAFETY_WINDOW_SEC;

  // Step 1: pre-emptive refresh if we know the token is stale
  if (isExpiredOrNearExpiry) {
    const refreshed = await refreshTokenPair(account.refreshToken);
    if (refreshed) {
      refreshActiveTokens(refreshed);
      markActive(account.userId);
      return refreshed;
    }
    // Refresh failed outright — refresh token is invalid, no point trying setSession
    return null;
  }

  // Step 2: tokens look fresh, try setSession directly
  const { data, error } = await supabase.auth.setSession({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });
  if (!error && data.session) {
    refreshActiveTokens(data.session);
    markActive(account.userId);
    return data.session;
  }

  // Step 3: setSession rejected — try one refresh-and-retry
  const refreshed = await refreshTokenPair(account.refreshToken);
  if (refreshed) {
    refreshActiveTokens(refreshed);
    markActive(account.userId);
    return refreshed;
  }
  return null;
}
