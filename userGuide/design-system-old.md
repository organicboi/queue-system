# Queue System — Design System Guide

> ⚠️ **Legacy (teal system).** For any route you are **redesigning**, follow the canonical
> [`design-system-v2.md`](./design-system-v2.md) ("Soft Warm") instead. This document now only
> describes surfaces that have **not yet been migrated** to v2 (admin, branch, and the counters
> other than Billing). Do not start new redesign work from this file.

This guide defines the visual language for every route in this app (excluding `/display`). Follow it for all future UI work. No exceptions.

---

## Core Principle

Colors carry meaning, not decoration. Teal is the brand. Amber/green/red are semantic. Everything else is neutral gray. If you're reaching for a color and asking "does this convey something meaningful?" — it should, or don't use it.

---

## Color System

### Brand Primary — Teal

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| Brand | `#0D9488` | `teal-600` | Buttons, active nav items, focus rings, key CTAs |
| Brand hover | `#0F766E` | `teal-700` | Hover state on primary buttons |
| Brand tint | `#F0FDFA` | `teal-50` | Icon containers, row highlights (in-progress state) |
| Brand light | `#CCFBF1` | `teal-100` | Borders on tinted backgrounds |

### Semantic Colors — Status Only

Only use these where the color communicates a specific queue status or alert type.

| State | Text | Background | Border | Dot |
|-------|------|-----------|--------|-----|
| Waiting | `amber-600` | `amber-50` | `amber-200` | `amber-500` |
| In Progress | `teal-700` | `teal-50` | `teal-200` | `teal-500` |
| Completed | `green-700` | `green-50` | `green-200` | `green-500` (emerald-500) |
| Cancelled | `red-600` | `red-50` | `red-200` | `red-400` |
| No Show | `orange-600` | `orange-50` | `orange-200` | `orange-400` |
| Active badge | `teal-700` | `teal-50` | `teal-100` | — |
| Inactive badge | `gray-500` | `gray-100` | `gray-200` | — |

### Neutral Palette

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| Page background | `#F7F7F5` | `bg-background` | All page backgrounds |
| Surface | `#FFFFFF` | `bg-white` | Cards, inputs, sidebar |
| Sidebar bg | `#FAFAF9` | `bg-sidebar` | Sidebar background |
| Border | `#E5E7EB` | `gray-200` / `border-border` | Card borders, input borders |
| Inner divider | `#F3F4F6` | `gray-100` | Dividers inside cards |
| Text primary | `#111827` | `gray-900` | Headlines, important values |
| Text secondary | `#6B7280` | `gray-500` | Subtitles, helper text |
| Text tertiary | `#9CA3AF` | `gray-400` | Placeholders, captions, fine print |

---

## Typography

Never use `font-black` for decorative purposes. Reserve it for queue numbers and large metric values — it signals "this number matters most."

| Role | Classes | Example |
|------|---------|---------|
| Page title | `text-xl font-semibold text-gray-900` | "Dashboard", "Branches" |
| Section title | `text-sm font-semibold text-gray-900` | Card headers |
| Label (caps) | `text-[11px] font-semibold uppercase tracking-wider text-gray-500` | "NOW SERVING", "TOTAL TODAY" |
| Body | `text-sm text-gray-700` | Descriptions, list items |
| Caption | `text-xs text-gray-500` | Timestamps, helper text |
| Queue number | `font-mono font-black text-gray-900` | `#42` |
| Large metric | `text-3xl font-black tabular-nums text-gray-900` | Dashboard stat values |
| Placeholder | `text-gray-400` | Input placeholders |
| Link | `text-teal-600 hover:underline` | In-body links |

---

## Shape & Spacing

### Border Radius

| Context | Class | Pixels |
|---------|-------|--------|
| Cards, panels, tables | `rounded-xl` | 12px |
| Auth forms | `rounded-2xl` | 16px |
| Buttons, inputs, icon containers | `rounded-lg` | 8px |
| Status dots, avatar circles | `rounded-full` | — |
| Tags/badges | `rounded-full` | — |

### Card Patterns

```
Standard card:     bg-white border border-gray-200 rounded-xl p-5
Table card:        bg-white border border-gray-200 rounded-xl overflow-hidden
Auth form card:    bg-white border border-gray-200 rounded-2xl p-8
Empty state:       border border-dashed border-gray-300 rounded-xl p-12 text-center
Section gap:       space-y-6
Card grid gap:     gap-4
```

---

## Buttons

Never invent button colors outside this table. Match the action to the semantic meaning.

| Type | Classes |
|------|---------|
| Primary | `bg-teal-600 hover:bg-teal-700 text-white rounded-lg h-10` |
| Primary compact | same + `h-9 text-sm` |
| Outline | `border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 rounded-lg` |
| Ghost | `hover:bg-gray-100 text-gray-700 rounded-lg` |
| Action: Call | `text-teal-600 hover:text-teal-700 hover:bg-teal-50` ghost |
| Action: Complete | `text-green-600 hover:text-green-700 hover:bg-green-50` ghost |
| Action: Cancel | `text-red-500 hover:text-red-600 hover:bg-red-50` ghost |
| Action: No Show | `text-orange-500 hover:text-orange-600 hover:bg-orange-50` ghost |
| Danger (inline) | `text-red-600 hover:bg-red-50` ghost |

---

## Inputs

```
Standard:   h-10 rounded-lg border-gray-200 bg-white text-gray-900
            placeholder:text-gray-400
            focus-visible:border-teal-500 focus-visible:ring-0 focus-visible:shadow-none

Compact:    h-9 text-xs (used in table toolbars/search)

Large (join form):  rounded-lg border border-gray-200 bg-white px-4 py-4
                    text-center text-2xl font-black tracking-widest text-gray-900
                    focus:outline-none focus:border-teal-500
```

No input should have a colored background. No glassmorphism. No dark inputs.

---

## Icon Containers

Small square boxes that hold a Lucide icon. Size: `size-8` or `size-9`. Always `rounded-lg`.

| Context | Classes |
|---------|---------|
| Primary brand | `bg-teal-50 text-teal-600 rounded-lg` |
| Waiting | `bg-amber-50 text-amber-600 rounded-lg` |
| In Progress | `bg-teal-50 text-teal-600 rounded-lg` |
| Completed | `bg-green-50 text-green-600 rounded-lg` |
| Error / Cancelled | `bg-red-50 text-red-600 rounded-lg` |
| Neutral | `bg-gray-100 text-gray-500 rounded-lg` |
| Key / Alert | `bg-amber-50 text-amber-600 rounded-lg` |

Do not put decorative gradients or opacity-based colors (`bg-primary/10`) on icon containers unless you're using it within the admin sidebar brand mark (where the CSS variable cascade handles it correctly).

---

## Status Badges

Use `StatusBadge` component from `components/shared/StatusBadge.tsx`. It reads from `getStatusBg()` and `getStatusColor()` in `lib/queueUtils.ts`. Do not recreate inline badge styling — update the utility functions if a color needs changing.

```
waiting      → amber-50 bg / amber-700 text / amber-500 dot
in-progress  → teal-50 bg  / teal-700 text  / teal-500 dot (+ animate-pulse when active)
completed    → green-50 bg  / green-700 text  / green-500 dot
cancelled    → red-50 bg    / red-600 text    / red-400 dot
no-show      → orange-50 bg / orange-600 text / orange-400 dot
```

For small status indicators (dots only, no text): `size-1.5 rounded-full` with the matching dot color above.

---

## Charts

These colors are hardcoded in `components/admin/AnalyticsView.tsx`. Match any new chart work to this palette.

| Series | Hex | Meaning |
|--------|-----|---------|
| Primary / In-progress | `#0D9488` | Teal (brand) |
| Waiting | `#D97706` | Amber (attention) |
| Completed | `#16A34A` | Green (success) |
| Cancelled | `#DC2626` | Red (failure) |
| Secondary neutral | `#6B7280` | Gray |
| Tooltip border | `#E5E7EB` | gray-200 |
| Cursor fill | `#F9FAFB` | gray-50 |

---

## Route-by-Route Reference

### Auth Routes (`/login`, `/onboard`, `/distributor/login`)

- **Layout:** Centered single column, `max-w-sm` or `max-w-85`
- **Page bg:** `bg-background` (warm off-white via CSS var)
- **Card:** `bg-white border border-gray-200 rounded-2xl p-8`
- **Icon:** Plain Lucide icon, no decorative container, `text-gray-900`
- **Heading:** `text-[22px] font-semibold text-gray-900 tracking-tight`
- **Subtext:** `text-sm text-gray-500`
- **Footer:** `text-[12px] text-gray-400`
- **Portals are differentiated by icon + copy, not by color.** No amber for distributor, no indigo for onboard.

### Admin Dashboard (`/dashboard`, `/branches`, `/users`, `/analytics`, `/settings`)

- **Layout:** Sidebar (260px) + content area with `py-6 px-4 md:px-6`
- **Page bg:** `bg-background` (from CSS var, auto warm off-white)
- **Page title:** `text-xl font-semibold text-gray-900`
- **Subtitle:** `text-sm text-muted-foreground mt-0.5`
- **Cards:** `bg-white border border-border rounded-xl`
- **Primary button (top of page):** Standard primary button pattern
- **Stat card icon containers:** Teal for total/in-progress counts. Amber for waiting. Green for completed. Red for errors/inactive.

### Admin Sidebar

- Active nav: `bg-primary text-primary-foreground` (auto-teal via CSS vars)
- Hover nav: `hover:bg-sidebar-accent`
- Logo icon: `bg-primary/10 border border-primary/20 text-primary`
- No manual color overrides needed — CSS cascade handles it

### Queue Management (`/branches/[branchId]`)

- **Now Serving section:** `bg-teal-50/50` background, `text-teal-700` queue number
- **Call button:** `text-teal-600 hover:bg-teal-50`
- **In-progress table row:** `bg-teal-50/50`
- **Complete action:** green, **Cancel:** red, **No-Show:** orange

### Public Join (`/join/[branchId]`)

- **Page bg:** `bg-background` — **no dark gradient**
- **Card:** `bg-white border border-gray-200 rounded-2xl p-6`
- **Success state queue number:** `text-8xl font-black text-teal-600`
- **Success info box:** `bg-teal-50 border border-teal-100 rounded-xl`

### Distributor Portal (`/distributor`, `/distributor/customers`, `/distributor/keys`)

- Same system as admin. No amber branding.
- Sidebar uses identical pattern to admin sidebar (primary CSS vars)
- Stat card icons: Teal for total counts, green for active, red for inactive, amber for license keys

---

## What Not To Do

**Never:**
- Dark gradients (`from-slate-950`, `from-slate-900`) on any app route
- Glassmorphism (`backdrop-blur`, `bg-white/5`, `border-white/10`) outside of `/display`
- Indigo as a primary color (it was the old system, now replaced by teal)
- Random color per portal (e.g. amber distributor, indigo onboard) — portals share the same brand
- `font-black` on titles, labels, or subtitles — only queue numbers and large stat values
- Colored text for page titles (`text-indigo-700` headings, etc.)
- Shadow-heavy cards (`shadow-lg`, `shadow-xl`) — use `shadow-sm` at most, prefer borderless
- Color-coded decorative icon boxes with no semantic meaning

**Always:**
- `bg-background` for page backgrounds (uses CSS var, auto warm off-white)
- `border-border` or `border-gray-200` for card/container borders
- `rounded-xl` for cards, `rounded-lg` for inputs/buttons
- `focus-visible:border-teal-500 focus-visible:ring-0` for input focus states
- Teal for the primary action, semantic colors for status

---

## CSS Variables (globals.css)

These drive the whole system. Update here, not in component files.

```css
--primary: 175 84% 32%;               /* #0D9488 teal-600 */
--primary-foreground: 0 0% 100%;
--background: 40 14% 97%;             /* #F7F7F5 warm off-white */
--ring: 175 84% 32%;
--border: 220 13% 91%;                /* gray-200 equivalent */
--sidebar-background: 30 10% 98%;     /* #FAFAF9 */
--sidebar-primary: 175 84% 32%;
--sidebar-primary-foreground: 0 0% 100%;
--radius: 0.5rem;                      /* base radius — rounded-lg = 8px */
```

All `bg-primary`, `text-primary`, `border-primary`, `ring-primary`, active sidebar states pull from these automatically.
