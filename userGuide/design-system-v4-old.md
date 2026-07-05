# VibeQueue Design System — "Operator Console, Quiet" (v4, canonical)

> **This is the current, canonical color system for every route being (re)designed.**
> It supersedes the color rules in [`design-system-v3.md`](./design-system-v3.md) — v3's
> **layout, structure, and principles remain valid and unchanged** (the flat frame, the
> two-panel task layout, the keypad pattern, the labeled-button rules); only the **palette**
> is corrected here, because the real implementation drifted into too many competing
> saturated colors. Read v3 for layout/structure, this document for color.

---

## 0. What went wrong, and what this fixes

Two routes were already built on v3 (`OrderCounter.tsx`, `KitchenCounter.tsx`, sharing
`components/counter/console.tsx`). Auditing the actual code turned up **six distinct
saturated hues** doing work that should have been one or two:

| Hue in use | Where |
|---|---|
| Custom navy `#2E4A79` | Keypad digit/backspace keys, Kitchen's "Start Prep" |
| Custom red `#DC4C4C` | Keypad "Clear" key (a large solid block, not a small pill) |
| Custom green `#2F9E4A` | "Generate Ticket", "Order Ready" primary buttons |
| Tailwind `emerald-600` | Header icon tile, "Serving" status pill — **a different green from the CTA green above** |
| Tailwind `green-50/700` | "Completed/Done" status pill — **a third, separate green** |
| Tailwind `amber` | "Waiting" pill, elapsed-time warning |
| Tailwind `orange` | "No-show" pill |

That's navy + red + **three different greens** + amber + orange all visible at once on a
single screen (see the Kitchen and Order screenshots that prompted this doc — a whole
column of repeated navy buttons next to green ones next to red time-badges next to amber
tags). Client feedback: *"we can't have so many primary colors, it's too poky to the eyes."*

**The fix, confirmed with the client:** *single accent, neutral keypad*. Large surfaces
(keypad keys, secondary buttons, cards, the frame) go fully neutral. Exactly **one accent
color** exists in the whole system, reserved for the primary "go" action and the positive
status. Red and amber survive only as small, infrequent pills — never as big color blocks.
Total functional hues, system-wide: **three** (accent, amber, red) plus neutrals.

---

## 1. The palette

### 1.1 Neutrals (do almost all the work)

| Role | Class |
|---|---|
| Canvas | `bg-slate-100` |
| Card / panel surface | `bg-white border border-slate-200` |
| Recessed field (display/inputs) | `bg-slate-50 border-slate-200` |
| **Keypad keys — ALL of them** (digits, 0, backspace, **and Clear**) | `bg-slate-700 text-white` (active `bg-slate-800`) — same solid neutral, differentiated only by label/icon, never by color |
| **Secondary action buttons** (Recall, Start Prep, Reprint, any non-primary action) | `bg-white border border-slate-200 text-slate-700` (active `bg-slate-50`) — bordered, quiet, never a solid color fill |
| Primary text | `text-slate-800` |
| Muted text | `text-slate-500` |
| Faint / captions | `text-slate-400` |

> **Rule:** if a control isn't *the one* dominant action on screen, it does not get a solid
> color fill. Digits, backspace, Clear, and every "secondary" button are visually quiet —
> same neutral slate, distinguished by their label, not their hue.

### 1.2 The one accent — used in exactly three places, nowhere else

Standardize on **Tailwind's `emerald` family only** — delete the custom green hexes
(`#2F9E4A`/`#278A41`) and the separate `green-50/700` "completed" pill; both become the
same `emerald` token so there is truly one green in the entire app.

| Role | Class |
|---|---|
| Primary CTA (the one dominant action: Generate Ticket / Call #N / Billing Done / Order Ready) | `bg-emerald-600 text-white` (active `bg-emerald-700`) |
| Header icon tile (brand mark) | `bg-emerald-600` — same token, reinforces "this is the brand color," not a second green |
| Positive status pill (Serving **and** Completed/Done — merge these, don't use two greens) | `bg-emerald-50 text-emerald-700 border border-emerald-200` |

The accent appears **only** on: the header icon, the one primary button per screen, and the
"positive" status pill. It never appears on a secondary button, a keypad key, or as a large
surface fill anywhere else.

### 1.3 Amber — attention, small pills only

| Role | Class |
|---|---|
| Waiting status pill | `bg-amber-50 text-amber-700 border border-amber-200` |
| Elapsed-time warning (8–15 min) | same recipe |
| Paused / needs-attention note | `text-amber-600` (text only, not a filled surface) |

### 1.4 Red — destructive, idle-quiet / armed-loud

Red is the one color allowed a *brief* full-strength moment, and only for the one
irreversible action (cancel), never for a neutral utility key like Clear:

| State | Class |
|---|---|
| Idle (Cancel button, at rest) | `bg-white border border-red-200 text-red-600` — quiet, bordered, not a filled block |
| Armed (after first tap, awaiting confirm — 3s window) | `bg-red-500 text-white` — a deliberate, momentary, small-surface escalation |
| Elapsed-time urgent (≥15 min) | `bg-red-50 text-red-600 border border-red-200` — small pill only |

### 1.5 Retired from the system

- ❌ Custom navy `#2E4A79` / `#25406B` — replaced by neutral `slate-700`/`slate-800`.
- ❌ Custom red `#DC4C4C` / `#C63D3D` as a **key fill** — Clear is now a neutral key like
  any other; red is reserved for the Cancel/destructive pattern only (§1.4).
- ❌ Custom green `#2F9E4A` / `#278A41` — replaced by Tailwind `emerald-600`/`emerald-700`.
- ❌ `green-50/600/700` as a second "completed" green — merged into `emerald` (§1.2).
- ❌ `orange` for "no-show" — merged into the same neutral treatment as "cancelled"
  (`bg-slate-100 text-slate-500 border-slate-200`); the two states are still distinguished
  by their **label text** ("Cancelled" vs. "No-show"), not by inventing a fourth hue.

### 1.6 Status pill map (final, 4 buckets instead of 5 colors)

| State | Class |
|---|---|
| Waiting | `bg-amber-50 text-amber-700 border-amber-200` |
| In Progress / Serving / Completed / Done | `bg-emerald-50 text-emerald-700 border-emerald-200` |
| Cancelled / No-show | `bg-slate-100 text-slate-500 border-slate-200` (label text distinguishes which) |

---

## 2. Shadows

Unchanged in spirit from v3 (one flat, color-matched shadow per surface, never stacked
gradients/glows), but since only slate and emerald are ever solid-filled now, there are
only two shadow recipes in practice:

```txt
Neutral surface (cards, keypad keys, secondary buttons)
  shadow-[0_4px_10px_-4px_rgba(15,23,42,0.35)]   (keys)
  shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)]  (cards/panels)
  shadow-sm                                       (small chips/tiles)

The one accent surface (primary CTA only)
  shadow-[0_6px_16px_-6px_rgba(5,150,105,0.5)]    (emerald-tinted)
```

No more navy-tinted or custom-green-tinted shadows — removing the extra hexes removes the
need for extra shadow tints too.

---

## 3. Everything else is unchanged from v3

This document only corrects color. Keep following [`design-system-v3.md`](./design-system-v3.md)
for: the flat frame + live-clock header, the two-panel task/list layout, the keypad
structural pattern (3×4 digit grid + tall primary CTA column), mono numbers, radius scale,
motion, the labeled-button non-negotiables, the worker-clarity checklist, and the
step-by-step redesign recipe. Wherever v3 names a color, use §1 of **this** document instead.

---

## 4. Migration checklist (apply to `console.tsx`, `OrderCounter.tsx`, `KitchenCounter.tsx`)

- [ ] `KeypadKey`: collapse `digit`/`muted`/`danger` variants to a **single** neutral skin
      (`bg-slate-700` / active `bg-slate-800`) — Clear no longer gets a red fill, just its
      label.
- [ ] Replace every `bg-[#2E4A79]` / `bg-[#25406B]` with `bg-slate-700` / `bg-slate-800`.
- [ ] Replace every `bg-[#2F9E4A]` / `bg-[#278A41]` with `bg-emerald-600` / `bg-emerald-700`.
- [ ] Replace the `green-50/600/700` "Completed" pill with `emerald-50/700` (same as
      "Serving") in `STATUS_PILL`.
- [ ] Replace the `orange` "No-show" pill with the same neutral `slate-100/500` class used
      for "Cancelled."
- [ ] Kitchen's "Start Prep" and any other secondary button loses its navy fill and becomes
      the neutral bordered secondary style (§1.1) — only "Order Ready" keeps the accent.
- [ ] Re-verify both orientations after the palette swap — this is a class-value change
      only, layout/structure should be untouched.

---

## 5. Quick reference (copy-paste)

```txt
Canvas ................ bg-slate-100 text-slate-800
Card / panel ........... bg-white border-slate-200  shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)]
Keypad key (ALL types) . bg-slate-700 text-white  shadow-[0_4px_10px_-4px_rgba(15,23,42,0.35)]  active:bg-slate-800
Secondary button ....... bg-white border-slate-200 text-slate-700  active:bg-slate-50
Primary CTA (the ONE) .. bg-emerald-600 text-white  shadow-[0_6px_16px_-6px_rgba(5,150,105,0.5)]  active:bg-emerald-700
Header icon tile ....... bg-emerald-600            (same token as the primary CTA — one green, not two)
Destructive, idle ...... bg-white border-red-200 text-red-600
Destructive, armed ..... bg-red-500 text-white      (momentary, 3s window)
Status: waiting ........ bg-amber-50 text-amber-700 border-amber-200
Status: serving/done ... bg-emerald-50 text-emerald-700 border-emerald-200
Status: cancelled/no-show bg-slate-100 text-slate-500 border-slate-200

Total saturated hues anywhere in the system: 3 (emerald, amber, red). Everything else neutral.
```
