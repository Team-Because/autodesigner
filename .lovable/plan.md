

# Generation History Page

## New file: `src/pages/History.tsx`
- Query `generations` table joined with `brands` (fetch brands separately, map by id)
- Three filter controls at the top:
  - **Brand filter**: Select dropdown populated from user's brands, with "All Brands" default
  - **Date range**: Two date picker inputs (from/to) using the existing Calendar + Popover components
  - **Status filter**: Toggle group or select with options: All, Processing, Completed, Failed
- Results displayed as a table with columns: thumbnail (output image), brand name, campaign message, status badge, date created
- Status badges use existing Badge component with color variants (default=completed, destructive=failed, secondary=processing)
- Empty state when no results match filters
- Click a row to expand/view the output image, copywriting, and layout guide in a dialog

## Updates

### `src/App.tsx`
- Import and add route: `<Route path="/history" element={<History />} />`

### `src/components/AppSidebar.tsx`
- Add "History" nav item with `Clock` icon from lucide, url `/history`

