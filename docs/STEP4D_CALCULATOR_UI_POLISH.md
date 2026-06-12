# Step 4D: Calculator Page UI/UX Polish

## Summary

Unified the visual language and interaction patterns across all three calculators (MDD, Conversion, Dividend Capture) on the `/calculator` page. No calculation logic, API routes, or data fetching was changed.

## Files Read Before Work

- `docs/AUDIT.md`
- `docs/STEP4A_MDD_LIVE_DATA.md`, `STEP4B_CONVERSION_LIVE_DATA.md`, `STEP4C_DIVIDEND_CAPTURE_LIVE_DATA.md`
- `app/calculator/page.tsx`
- `components/calculator/CalculatorPage.tsx`
- `components/calculator/MddCalculator.tsx`
- `components/calculator/ConversionCalculator.tsx`
- `components/calculator/DividendCaptureSimulator.tsx`
- `components/calculator/PreviewNotice.tsx`
- `components/common/StorageModeBadge.tsx`
- `components/MetricCard.tsx`
- `lib/calculator-types.ts`
- `lib/quote-types.ts`

## Design Direction

- Maintain existing dark theme, card layout, and Tailwind approach
- Extract repeated UI patterns into small shared components
- Unify spacing, font sizes, badge appearance, and grid behavior
- Improve mobile responsiveness without visual redesign

## New Shared Components

| Component | Path | Purpose |
|-----------|------|---------|
| `CalculatorDataStatus` | `components/calculator/CalculatorDataStatus.tsx` | Source badge + loading spinner + updated timestamp in one row |
| `CalculatorWarningPanel` | `components/calculator/CalculatorWarningPanel.tsx` | Error + warnings display with consistent styling |
| `CalculatorInputField` | `components/calculator/CalculatorInputField.tsx` | `TextInput`, `NumberInput`, `DateInput`, `SelectInput` — shared form field wrappers |

## Source / Loading / Warnings Display Rules

### Source Badge
- **LIVE** (green tint): source is `yahoo` or `stooq`
- **SAMPLE** (amber tint): source is `sample`
- **loading** (gray tint): source not yet resolved

### Loading
- Spinner appears inline next to badge; button gets `disabled:opacity-50`
- Existing results remain visible while loading (no layout collapse)

### Warnings
- Compact amber panel below the form; shows only when warnings exist
- Errors display in a separate red panel above warnings
- Both use `rounded-xl` with reduced padding vs. prior `rounded-2xl`

### Updated Timestamp
- Shown as `text-slate-500` after badge; formatted via `toLocaleString()`

## Per-Calculator Changes

### MDD Calculator
- Replaced inline source badge, loading, warnings with shared components
- Replaced inline `TextInput/NumberInput/DateInput` local helpers with shared `CalculatorInputField`
- Metric grid: `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6` for smooth breakpoints
- Chart height: `h-[300px] sm:h-[340px]` (smaller on mobile)
- Tables: `overflow-x-auto -mx-5 px-5` for edge-to-edge scroll on mobile
- Reduced table min-width (860→700, 760→600) so content fits sooner
- All font sizes harmonized to 12.5px for tables, 11px for chart ticks

### Conversion Calculator
- Same shared component adoption
- Input grid: `sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5`
- Chart: dot removed from ratio line for cleaner look at scale
- Table: same overflow pattern as MDD

### Dividend Capture Simulator
- Same shared component adoption
- Added `extra` prop to `CalculatorDataStatus` for date range display
- Metric grid: `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`
- Detail table font reduced to 12px (15 columns); min-width reduced from 980 to 900
- Same overflow scroll pattern

### PreviewNotice
- Updated from "Free quote API foundation is enabled" to "Live quote data enabled"
- Korean text clarifies: all three calculators use live data, with sample fallback on failure
- Toned down blue border/background for less visual weight

### Tab Bar
- Smaller padding on mobile (`px-3`/`p-1.5`), scales up at `sm:`
- Font: `12.5px` mobile, `13px` desktop

## Mobile Confirmation

- Tab bar: no horizontal overflow; all 3 tabs visible at 320px+
- Cards: collapse to 1-column at mobile, 2-col at `sm`, full grid at `xl`
- Charts: `min-w-0` prevents flex blowout; reduced height on small screens
- Tables: horizontal scroll with negative margin trick keeps panel padding intact
- Warning/error panels: compact enough not to push content off screen
- No `overflow-x: hidden` on body — individual scroll containers handle wide content

## Build / Lint / Typecheck Results

```
✓ tsc --noEmit — no errors
✓ next lint — no warnings or errors  
✓ next build — compiled successfully, all 14 pages generated
```

## Files Modified

- `components/calculator/CalculatorPage.tsx` — tab bar responsive tweaks
- `components/calculator/MddCalculator.tsx` — full rewrite using shared components
- `components/calculator/ConversionCalculator.tsx` — full rewrite using shared components
- `components/calculator/DividendCaptureSimulator.tsx` — full rewrite using shared components
- `components/calculator/PreviewNotice.tsx` — updated copy

## Files Created

- `components/calculator/CalculatorDataStatus.tsx`
- `components/calculator/CalculatorWarningPanel.tsx`
- `components/calculator/CalculatorInputField.tsx`
- `docs/STEP4D_CALCULATOR_UI_POLISH.md`

## Not Touched

- `lib/mdd-calculator.ts`, `lib/conversion-calculator.ts`, `lib/dividend-capture-calculator.ts` — calculation logic unchanged
- `lib/calculator-data-provider.ts` — data fetching unchanged
- `app/api/quote/*` — API routes unchanged
- `lib/firebase/*` — Firestore unchanged
- `components/calculator/CalculatorPresetControls.tsx` — preset UI unchanged
- `components/MetricCard.tsx` — card component unchanged
- `original/` — read-only reference untouched

## Next Steps

- **Step 5A**: Connect portfolio page to live quote data
- **Step 5B**: Connect watchlist to live last-price quotes
- Consider: add a small "collapse" toggle for warning panels if they grow large with many mixed-source warnings
