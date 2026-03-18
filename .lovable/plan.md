

## Phase 1: Multi-User Auth + Credit System + Admin Panel

### Overview

Replace Google OAuth with username/password authentication where **only the admin can create accounts**. Add a credit system (1 generation = 1 credit, admin assigns credits manually). Admin gets a panel to manage users, view usage, and transfer brands.

---

### Database Changes

**1. New enum: `app_role`**
```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
```

**2. New table: `user_roles`** (per security guidelines)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid | FK → auth.users, not null |
| role | app_role | not null |
| unique(user_id, role) | | |

RLS enabled. Security definer function `has_role(user_id, role)` to avoid recursion.

**3. New table: `user_credits`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid | unique, not null |
| credits_remaining | integer | default 0 |
| credits_used | integer | default 0 |
| updated_at | timestamptz | |

RLS: users can SELECT their own row. Admin can SELECT/UPDATE all rows (via `has_role`).

**4. Update `profiles` table** — add `username` column (text, unique, not null default '').

**5. Edge function: `admin-create-user`** — creates a user via Supabase Admin API (service role key), sets username in profile, assigns 'user' role, initializes credits.

**6. Edge function: `admin-manage-credits`** — admin can add/subtract credits for any user.

**7. Edge function: `admin-transfer-brand`** — transfers a brand (and its assets) from one user to another.

**8. Update `generate-creative` edge function** — before generating, check `user_credits.credits_remaining > 0`. After successful generation, decrement credits_remaining and increment credits_used.

---

### Login Changes

| File | Change |
|------|--------|
| `src/pages/Login.tsx` | Replace Google OAuth with username/password form. Username field + password field + "Sign In" button. No signup — only admin creates accounts. |
| `src/hooks/useAuth.tsx` | Add `isAdmin` boolean derived from `user_roles` table query. Expose `isAdmin` in context. |

**How login works:** Username is stored in `profiles.username`. On login, user enters username → we look up the email (or use username as email with a convention like `username@brandtonic.local`) → call `signInWithPassword`. Simpler approach: store username in profiles, but auth uses email internally. The admin-create-user edge function sets email as `{username}@internal.brandtonic` and the login form accepts username, appends the domain suffix, and calls `signInWithPassword`.

---

### Admin Panel

| File | Change |
|------|--------|
| `src/pages/AdminPanel.tsx` | **New** — Tabs: Users, Credits, Transfer. Users tab: list all users with username, credits remaining, credits used, generation count. Credits tab: select user, enter amount, add/subtract. Transfer tab: pick source user → pick brand → pick destination user → transfer. |
| `src/components/AppSidebar.tsx` | Show "Admin" nav item only when `isAdmin` is true. |
| `src/App.tsx` | Add `/admin` route, protected by admin role check. |

---

### Credit Enforcement in Studio

| File | Change |
|------|--------|
| `src/pages/Studio.tsx` | Show credits remaining badge in header. Before generation, check credits > 0 client-side (edge function also enforces server-side). After generation, refetch credits. |

---

### Seeding the first admin

A migration will insert the first admin role for the currently authenticated user (you). Or, we create an edge function `seed-admin` that runs once to mark a specific user as admin.

---

### File changes summary

| File | Change |
|------|--------|
| **Migration SQL** | Create `app_role` enum, `user_roles` table, `user_credits` table, `has_role()` function, add `username` to profiles, RLS policies |
| `src/pages/Login.tsx` | Username + password form (no Google, no signup) |
| `src/hooks/useAuth.tsx` | Add `isAdmin` from `user_roles` lookup |
| `src/pages/AdminPanel.tsx` | **New** — user management, credit management, brand transfer |
| `src/components/AppSidebar.tsx` | Admin nav link (conditional) |
| `src/App.tsx` | Add `/admin` route |
| `supabase/functions/admin-create-user/index.ts` | **New** — create user with username/password, assign role + credits |
| `supabase/functions/admin-manage-credits/index.ts` | **New** — add/subtract credits |
| `supabase/functions/admin-transfer-brand/index.ts` | **New** — transfer brand ownership |
| `supabase/functions/generate-creative/index.ts` | Add credit check + deduction |
| `src/pages/Studio.tsx` | Show credit balance, block if 0 |

---

### App Name Suggestions

Here are a few futuristic name options (we'll apply the chosen one across the app in Phase 2 with the UI overhaul):

1. **BrandTonic** — matches your current domain, clean and memorable
2. **Neura Studio** — AI-forward, futuristic feel
3. **Synthos** — synthetic + creative synthesis
4. **Pixelforge** — creative production engine vibe
5. **Brandium** — premium, element-inspired

Let me know which name resonates and we'll apply it alongside the UI overhaul in Phase 2.

