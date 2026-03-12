

## Problem Analysis

I queried the database and found that **every single generation** (all 20+) has `status: "processing"` and an empty `output_image_url`, even though the user saw results in the Studio. This means:

1. **The edge function returns the image to the Studio** (so you see it on screen), but **fails to persist the update back to the database** — the final `UPDATE` on the generations table either errors silently or the function times out before reaching it.
2. **The outer catch block** (line 518) does NOT mark the generation as `"failed"`, so crashed/timed-out generations stay as `"processing"` forever.
3. **History shows reference images** as a fallback because `output_image_url` is always empty.

## Plan

### 1. Fix edge function error handling
- Add `generationId` tracking to the outer catch block so it marks the generation as `"failed"` if any unhandled error occurs.
- Add error checking on the final database update (lines 500-508) and log if it fails.
- Add a `try/catch` around the final update to ensure it doesn't silently fail.

### 2. Clean up stale database records
- Run a migration to mark all generations older than 10 minutes that are still `"processing"` as `"failed"`, since their output is lost.

### 3. Fix History page display
- Remove reference image fallback — only show the actual output image. If there's no output, show a clear "Generation failed" placeholder instead of the misleading reference image.
- Simplify stale detection since the DB cleanup will handle old records.

### 4. Auto-save output URL from Studio
- As a safety net, when the Studio receives a successful response with `imageUrl`, update the generation record from the client side too, so even if the edge function's DB update fails, the URL is captured.

