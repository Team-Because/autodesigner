

## Plan: Structured Brand Profile + Multi-Campaign System

### What we're building

Two connected features:

1. **Structured Brand Profile Form** — Replace the free-text Brand Brief textarea with guided sections (8 sections from the guideline template), serialized into existing DB columns (no schema change needed).

2. **Campaigns System** — New `campaigns` table so each brand can have multiple campaigns, each with its own brief, audience, and rules. Studio picks a campaign optionally, and its rules layer on top of brand-level rules during generation.

---

### Database Changes

**New table: `campaigns`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| brand_id | uuid FK → brands | not null |
| user_id | uuid | not null, for RLS |
| name | text | not null, e.g. "Admissions Open" |
| campaign_brief | text | Campaign-specific instructions |
| target_audience | text | Audience override |
| mandatory_elements | text | Required copy/CTAs |
| negative_prompts | text | Campaign exclusions |
| status | text | default 'active' (active/archived) |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS policies: Users CRUD their own campaigns (match `user_id = auth.uid()`).
Trigger: `update_updated_at_column` on update.

---

### File Changes

| File | Change |
|------|--------|
| **Migration** | Create `campaigns` table + RLS + trigger |
| `src/lib/types.ts` | Add `Campaign` interface |
| `src/components/BrandProfileSections.tsx` | **New** — 8-section accordion form (Identity, Mandatory Elements, Voice & Messaging, Target Audience, Visual Style, Do's & Don'ts, Color Palette notes, Asset Usage Rules). Each section has a title, helper text, and example placeholders |
| `src/lib/brandProfileSerializer.ts` | **New** — `serialize()`: structured data → `brand_brief` + `brand_voice_rules` + `negative_prompts` text. `parse()`: detect `_structured` JSON envelope in brand_brief → populate form, else show raw text for legacy brands |
| `src/pages/BrandForm.tsx` | Replace Brand Brief / Communication Rules cards with `<BrandProfileSections>`. Add a "Campaigns" section at the bottom showing campaign list with add/edit/archive |
| `src/pages/CampaignForm.tsx` | **New** — Create/edit campaign form (name, brief, audience, mandatory elements, negatives) |
| `src/pages/BrandHub.tsx` | Show campaign count badge on brand cards |
| `src/pages/Studio.tsx` | After brand selector, add optional campaign dropdown. Pass `campaignId` to edge function |
| `src/App.tsx` | Add routes: `/brands/:brandId/campaigns/new`, `/brands/:brandId/campaigns/:campaignId/edit` |
| `supabase/functions/generate-creative/index.ts` | Accept `campaignId`, fetch campaign data, merge campaign context on top of brand context (campaign fields override brand fields where present) |

---

### How Campaign Merging Works in the Edge Function

When a campaign is selected:
- Campaign `campaign_brief` appends to brand brief under `## CAMPAIGN-SPECIFIC RULES`
- Campaign `target_audience` replaces brand audience if present
- Campaign `mandatory_elements` appends to brand mandatory elements
- Campaign `negative_prompts` appends to brand negatives

This ensures brand-level rules are always the baseline, with campaign rules adding specificity.

---

### Structured Profile Serialization

On save, the structured sections serialize into:
- `brand_brief` → JSON envelope: `{ "_structured": true, "sections": {...}, "_rendered": "## BRAND IDENTITY\n..." }`
- `brand_voice_rules` → voice traits joined from section 4
- `negative_prompts` → don'ts from section 7

The `_rendered` key contains the markdown text the edge function already reads. Legacy brands without `_structured` key display their raw text in a fallback textarea.

