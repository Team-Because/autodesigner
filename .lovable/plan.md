

# Fix: Credits, Validation, and Asset Label Robustness

## Problems to Fix

1. **No credit check or deduction** — edge function never touches `user_credits`
2. **Failed generations not handled** — credits should only deduct on success
3. **Logo label matching too rigid** — only `/logo/i` regex; misses "Brand Mark", "Logomark", etc.
4. **No pre-generation validation** — can generate with 0 assets, no brief
5. **Studio doesn't check credits before starting** — user with 0 credits can still trigger generation

## Changes

### 1. Edge Function: Credit check + deduction (`supabase/functions/generate-creative/index.ts`)

**Before fetching brand data** (after creating supabase client, ~line 1031):
- Extract `user_id` from the generation record (query generations table by `generationId`)
- Query `user_credits` for that user
- If `credits_remaining <= 0`, return 402 error: "No credits remaining"
- **After successful generation** (after status is set to "completed", ~line 1229): deduct 1 credit — `credits_remaining - 1`, `credits_used + 1`
- On failure: no deduction (already handled — function returns error before reaching the success block)

### 2. Edge Function: Broaden logo label matching

Replace all instances of `/logo/i` regex with a broader pattern:
```
/\b(logo|logomark|brand\s*mark|brand\s*logo|symbol|monogram|emblem)\b/i
```

This affects 3 locations:
- Line 595: force-include logo check in `adaptDirective`
- Line 626: `hasLogo` in `buildDirectivePrompt`
- Line 903: fallback logo detection in `generateCreative`

### 3. Studio: Pre-flight validation (`src/pages/Studio.tsx`)

In `handleGenerate` (line 127), before uploading the reference image:
- Fetch user's credits: `supabase.from("user_credits").select("credits_remaining").eq("user_id", user.id).single()`
- If `credits_remaining <= 0`, show toast error "No credits remaining" and return
- Fetch brand assets count: `supabase.from("brand_assets").select("id", { count: "exact" }).eq("brand_id", selectedBrandId)`
- If asset count is 0, show toast warning "This brand has no assets — results may be limited" (warn, not block)
- Check if selected brand has `brand_brief` — if empty, show similar warning

### 4. Studio: Handle 402 from edge function

In the error handling block (~line 238), detect 402 status and show specific "No credits remaining" message instead of generic error. Also invalidate the credits query so the header updates.

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/generate-creative/index.ts` | Add credit check before generation, deduct on success, broaden logo regex |
| `src/pages/Studio.tsx` | Add pre-flight credit + brand validation, handle 402 response |

## What This Does NOT Change

- No schema changes needed — `user_credits` table already has the right columns
- No RLS changes — edge function uses service role key
- No changes to the 3-step pipeline logic
- Dashboard credit display continues to work (reads same table)

