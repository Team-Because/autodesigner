import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { refreshActiveTokens, removeAccount, listAccounts, activateVaultedAccount } from "@/lib/accountVault";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Sign out the currently active account; auto-switches to the next vaulted account if any. */
  signOut: () => Promise<{ switchedTo?: string } | void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  // Tracks the last user.id we observed so we can detect actual account swaps
  // (vs. token refreshes for the same account, which must NOT clear the cache).
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let initialized = false;

    // Set up listener FIRST (per Supabase best practices)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Keep the vault in sync whenever Supabase rotates tokens for the active session
      if (session && (event === "TOKEN_REFRESHED" || event === "SIGNED_IN" || event === "USER_UPDATED")) {
        refreshActiveTokens(session);
      }

      // Detect a real account change and wipe the per-user query cache so we
      // never render brands/history from the previous account, even briefly.
      const newUserId = session?.user.id ?? null;
      if (lastUserIdRef.current !== null && newUserId !== lastUserIdRef.current) {
        queryClient.clear();
      }
      lastUserIdRef.current = newUserId;

      if (initialized) {
        setSession(session);
        setLoading(false);
      }
    });

    // Then get the persisted session
    supabase.auth.getSession().then(({ data: { session } }) => {
      initialized = true;
      lastUserIdRef.current = session?.user.id ?? null;
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const signOut = async () => {
    const currentUserId = session?.user.id;
    // Remove this account from the vault first
    if (currentUserId) removeAccount(currentUserId);

    // If another account is vaulted, swap to it without bouncing through /login.
    // Walk the list so an expired/revoked entry doesn't block the next valid one.
    const remaining = listAccounts().filter((a) => a.userId !== currentUserId);
    for (const next of remaining) {
      const swapped = await activateVaultedAccount(next);
      if (swapped) {
        return { switchedTo: next.username };
      }
      // This vaulted entry is unrecoverable — drop it and try the next
      removeAccount(next.userId);
    }

    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
