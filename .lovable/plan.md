

# Add Video/GIF Walkthrough Placeholder to Brand Setup Guide

## What We're Building

A visual walkthrough section inserted between the "How It Works" overview and Step 1, showing an animated placeholder that illustrates the Claude workflow. Since we don't have an actual video/GIF yet, we'll create a polished placeholder with an animated step-by-step visual that mimics the workflow.

## Implementation

### File: `src/pages/BrandGuide.tsx`

Insert a new section after the "How It Works" card (after line ~367) and before Step 1:

- **Animated walkthrough card** with a mock browser/Claude interface illustration built in CSS/HTML:
  - Frame 1: "Paste prompt into Claude" — shows a chat bubble with prompt text
  - Frame 2: "Upload your brand files" — shows file attachment icons
  - Frame 3: "Hit Enter — get your brand profile" — shows structured output
- Uses a simple CSS animation (fade between 3 states on a loop) to simulate a slideshow
- Styled as a dark card (mimicking a Claude-like dark UI) with subtle transitions
- Includes a "Watch Walkthrough" label and a Play icon overlay
- Below the animation, a note: "Replace with your own video — drop a .mp4 or .gif into the public folder"

### Technical Details

- Pure CSS animation with `@keyframes` — no external dependencies
- Three animated "slides" cycling every 4 seconds using opacity transitions
- Responsive — scales with the container width
- Uses existing design tokens (colors, fonts, border-radius) from the app

