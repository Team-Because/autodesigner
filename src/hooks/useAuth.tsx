import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { refreshActiveTokens, removeAccount, listAccounts } from "@/lib/accountVault";

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

  useEffect(() => {
    let initialized = false;

    // Set up listener FIRST (per Supabase best practices)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Keep the vault in sync whenever Supabase rotates tokens for the active session
      if (session && (event === "TOKEN_REFRESHED" || event === "SIGNED_IN" || event === "USER_UPDATED")) {
        refreshActiveTokens(session);
      }
      if (initialized) {
        setSession(session);
        setLoading(false);
      }
    });

    // Then get the persisted session
    supabase.auth.getSession().then(({ data: { session } }) => {
      initialized = true;
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const currentUserId = session?.user.id;
    // Remove this account from the vault first
    if (currentUserId) removeAccount(currentUserId);

    // If another account is vaulted, swap to it without bouncing through /login
    const remaining = listAccounts().filter((a) => a.userId !== currentUserId);
    if (remaining.length > 0) {
      const next = remaining[0];
      const { data, error } = await supabase.auth.setSession({
        access_token: next.accessToken,
        refresh_token: next.refreshToken,
      });
      if (!error && data.session) {
        return { switchedTo: next.username };
      }
      // Fall through to a hard sign-out if the stored session is no longer valid
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
