

# Fix: Content Bleeding, Layout Quality, and Image Size Enforcement

## Three Issues Found

### 1. Reference content bleeding into output
The image model sees the reference image and copies its text (Abu Dhabi, AED, etc.) instead of using brand content. The Adapt step pre-writes correct copy, but the generation prompt doesn't forcefully tell the model to IGNORE all text/content visible in the reference image. The model sees "Abu Dhabi" in the reference photo and renders it.

**Fix**: Add explicit "NEVER copy any text, names, locations, currencies, or content from the reference image" instructions in both the Adapt system prompt and the generation system prompt. Reinforce in the user message that the reference is ONLY for layout/style — all text must come from the Creative Directive.

### 2. Broken asset role mapping + weak layout enforcement
Line 550-555 in `buildDirectivePrompt` has a bug — the `.find()` callback always returns `true`, so asset role descriptions don't map correctly to actual assets. This means the image model gets vague placement instructions.

Additionally, the prompt says "text must NEVER overlap critical imagery" but doesn't emphasize that text should be in CLEAR ZONES separate from hero visuals (not overlaid on buildings).

**Fix**: Fix the asset mapping logic and add stronger layout separation rules — text zones must be on solid/gradient backgrounds, never directly on 3D renders.

### 3. Image size not enforced
Gemini image models don't reliably respect `size` or `image_size` API params. The system prompt mentions dimensions but the model often outputs the reference image's original dimensions instead. Need to make this unavoidable.

**Fix**: 
- Repeat the exact dimensions in the user message (not just system prompt)
- Add the dimensions to the very first line AND very last line of the system prompt
- Add aspect ratio description more aggressively ("TALL vertical", "WIDE horizontal")
- Repeat in the final checklist

## Changes (single file)

**`supabase/functions/generate-creative/index.ts`**:

1. **Adapt prompt** (~line 335): Add to system prompt:
   - "CRITICAL: The reference image is for LAYOUT and STYLE only. IGNORE all text, names, locations, prices, currencies, phone numbers visible in the reference. ALL copy must come from the brand data below."

2. **`buildDirectivePrompt`** (~line 550): Fix broken asset mapping:
   ```
   // Current (broken): .find(() => true)
   // Fixed: use the directive's index to map to the correct asset description
   ```

3. **`buildDirectivePrompt`** format section (~line 592): Strengthen size enforcement:
   - First line: "MANDATORY OUTPUT SIZE: ${width}×${height} pixels. NO OTHER SIZE."
   - Add: "Do NOT match the reference image dimensions. Output MUST be ${width}×${height}."

4. **`buildDirectivePrompt`** composition section (~line 626): Add layout separation rules:
   - "Text MUST be placed on solid color zones or gradient overlays — NEVER directly on 3D renders or photos"
   - "Create clear visual separation: hero imagery zone vs text zone"
   - "If using a full-bleed hero image, text must sit on a color strip, gradient overlay, or dedicated panel"

5. **`buildDirectivePrompt`** user message text (~line 817): Add content isolation + size reminder:
   - "IGNORE all text visible in the reference — use ONLY the text from the Creative Directive."
   - "Output size MUST be exactly ${spec.width}×${spec.height}."

6. **`buildDirectivePrompt`** checklist (~line 663): Add:
   - "✅ NO text, location, currency, or content copied from reference"
   - "✅ Text is on clear backgrounds, not overlaid on imagery"

7. **`buildFallbackPrompt`** (~line 738): Same content isolation + size fixes for the fallback path.

8. **Generation API call** (~line 858): Move `size` param to top-level to match Gemini API expectations more reliably.

