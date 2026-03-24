

# UI Overhaul: "MakeMyAd" Rebrand

## Summary

Transform the entire application from "BrandTonic Studio" to **MakeMyAd** with a premium, clean UI inspired by the reference images. The design direction: soft rounded cards, glassmorphism accents, yellow-blue-white palette, clean modern typography, generous spacing, and a light airy feel. Not typical SaaS — more like the Intelly/Influency references with personality.

## Design Language (from references)

- **Cards**: Large border-radius (16-20px), subtle shadows, some with colored tint backgrounds (soft yellow, soft blue)
- **Sidebar**: Clean white or light background (not dark navy), with rounded nav items and subtle active states
- **Glassmorphism**: Selective use — backdrop-blur on certain cards/overlays, not everywhere
- **Colors**: Primary blue (#2563EB), accent yellow/lime (#E5B800 / #D4E157), white backgrounds, soft gray borders
- **Typography**: Clean sans-serif body, bold display headings, generous line-height
- **Spacing**: Very generous padding (24-32px in cards), breathing room between elements
- **Icons**: Subtle, muted, not dominant

## Files to Change

| File | What Changes |
|---|---|
| `src/index.css` | New CSS variables: softer palette, larger radius, glass utility classes, new font import |
| `tailwind.config.ts` | Updated color tokens, larger border-radius defaults, new font family |
| `src/components/AppSidebar.tsx` | Light sidebar theme, "MakeMyAd" branding, rounded pill-style nav items |
| `src/components/DashboardLayout.tsx` | Softer header with glassmorphism, cleaner layout |
| `src/pages/Login.tsx` | Premium login with gradient background, glass card, "MakeMyAd" name |
| `src/pages/Dashboard.tsx` | Colored stat cards (yellow/blue tints), welcome greeting, better card styling |
| `src/pages/BrandHub.tsx` | Softer brand cards with hover lift, cleaner group headers |
| `src/pages/Studio.tsx` | Cleaner step cards, better drop zone, refined output area |
| `src/pages/History.tsx` | Cleaner filter bar, softer cards |
| `src/pages/AdminDashboard.tsx` | Colored stat cards, cleaner tables |
| `src/pages/AdminUsers.tsx` | Better user cards with avatar styling |
| `src/pages/AdminBrands.tsx` | Cleaner brand list |
| `src/pages/AdminLogs.tsx` | Cleaner log entries |
| `src/pages/BrandForm.tsx` | Cleaner form sections |
| `index.html` | Update title to "MakeMyAd" |

## Design Token Changes

```text
Current → New:
--radius: 0.625rem → 1rem (larger, rounder)
--background: pure white stays
--primary: blue stays but slightly adjusted
--secondary: gold/yellow stays but softer
--sidebar-background: dark navy → white/light gray
--sidebar-foreground: gray → dark text
New additions:
  --glass: backdrop-blur + semi-transparent bg utility
  Colored card variants: bg-yellow-50/60, bg-blue-50/60
  Font: Inter or Outfit (cleaner than DM Sans for this aesthetic)
```

## Key Visual Patterns

1. **Stat cards** — Each gets a subtle color tint (yellow card for credits, blue for generations, green for success rate) like the Influency reference
2. **Sidebar** — White background, rounded pill active states with yellow/blue accent, "MakeMyAd" logo text at top
3. **Welcome greeting** — "Welcome back, [name]" like the reference dashboards
4. **Glass header** — Subtle backdrop-blur on the top bar
5. **Buttons** — Rounded-full for primary CTAs, rounded-xl for secondary
6. **Drop zone** — Cleaner with dotted border and soft background

## Implementation Order

1. Design tokens (CSS + Tailwind config + HTML title)
2. Sidebar + Layout (structural foundation)
3. Login page
4. Dashboard
5. All other pages (BrandHub, Studio, History, Admin pages, BrandForm)

All changes are purely visual — no logic, data, or routing changes.

