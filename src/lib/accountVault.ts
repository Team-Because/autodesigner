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
