

# Fix Image Output Sizing

## Problem
When users select a format (square, portrait, landscape, story), the generated images come back in random dimensions. The AI models ignore the pixel dimension instructions in the prompt and the non-standard `size`/`image_size` parameters.

## Root Cause
The Gemini image generation models do not respect `size` or `image_size` as API parameters — these are not part of the standard API. The dimension instructions in the prompt text are also frequently ignored by the model, especially when a reference image of a different aspect ratio is provided.

## Solution: Two-Layer Fix

### Layer 1 — Pass `aspect_ratio` parameter
Gemini image generation models support an `aspect_ratio` parameter (e.g., `"1:1"`, `"16:9"`, `"9:16"`, `"4:5"`). This is the standard way to control output dimensions. We already have `aspectRatio` in `FORMAT_SPECS` but never pass it in the API call.

**Change in `generateCreative` function** (~line 1116-1125):
- Add `aspect_ratio: spec.aspectRatio` to the request body alongside `modalities`
- Keep `size` as a fallback hint

### Layer 2 — Post-generation resize using sharp-compatible Wasm
After receiving the base64 image, decode it, check if the aspect ratio matches the target, and if not, resize/crop to the correct dimensions. Use `jsr:@aspect/image` or a lightweight PNG/JPEG decoder+encoder in Deno to:
1. Decode the base64 image
2. Calculate current vs target aspect ratio
3. If mismatch > 5%, center-crop to correct ratio then scale to exact pixel dimensions
4. Re-encode to base64

If Wasm image processing is too complex for edge functions, an alternative is to use a second AI call with the resize model (`google/gemini-2.5-flash-image`) asking it to simply resize the output — but this doubles cost.

### Pragmatic Fallback — Canvas-free resize via re-generation prompt
If the Wasm approach proves infeasible in Deno Deploy, we add a **validation + retry** step:
1. After generation, make a lightweight vision call to check the output dimensions
2. If wrong, retry with an even more forceful prompt that says "The previous output was WxH but MUST be WxH. Resize this image to exactly WxH pixels" with the generated image as input

## Technical Changes

### File: `supabase/functions/generate-creative/index.ts`

1. **API request body** (~line 1116): Add `aspect_ratio` field from `FORMAT_SPECS`
2. **System prompt prefix** (~line 1008): Add an unambiguous first line: `"You MUST output an image with aspect ratio {X:Y}. The image dimensions MUST be {W}x{H} pixels."`
3. **Post-generation resize step** (~line 1170): After extracting `imageBase64`, attempt to validate and resize if needed
4. **Update `spec` type** throughout to include `aspectRatio: string`

### File: `src/pages/Studio.tsx`
No changes needed — the frontend already passes the correct `outputFormat` string.

## Priority Order
1. Add `aspect_ratio` to API call (quick, high impact)
2. Strengthen prompt injection at system level (quick)
3. Add post-generation resize (moderate effort, guarantees correctness)

