# VibeQueue Design System — "Operator Console, Hotel Grade" (v5, canonical & self-contained)

> **This document is complete on its own.** It consolidates v3 (layout/structure) and v4
> (single-accent palette) into one canonical spec, then extends the system for the **Dubai
> hotel market**: bilingual EN/AR + RTL, a guest-facing display surface, per-property brand
> theming, and fixes for two real defects visible in the current build (accent repetition
> down a lane, unreadable/over-red elapsed-time badges). You no longer need to cross-read
> v3 and v4 — where they conflict with this doc, this doc wins.

---

## 0. What v5 changes, and why

v4 correctly reduced the system to **one accent + amber + red + neutrals**. But auditing the
live Kitchen screen shows v4's rules were necessary, not sufficient:

| Defect in current build | v5 fix |
|---|---|
| A **column of identical solid CTAs** (four navy "Start Prep", or four full-width emerald "Order Ready") — the wall-of-color problem survives even with one hue | **FIFO emphasis rule (§5.3):** within a lane, only the *first* (oldest) card renders its action as the solid accent CTA; every card below renders the same action in the quiet bordered skin. The accent now literally means "do this one next." |
| Time badges reading **"7160 min"** — unreadable, and a red pill on *every* card, so red signals nothing | **Elapsed-time buckets (§4):** human formatting (`24 min` → `1h 05m` → `2d`), and a **stale** state (neutral slate, not red) for tickets old enough that they're a data-hygiene issue, not an urgency. Red is reserved for the actionable 15 min–4 h window. |
| Two equal-weight buttons per card ("Start Prep" + "Ready") | One primary per card; the shortcut action becomes the quiet secondary skin (§7). |
| Accent hard-coded as `emerald-600` | Accent becomes a **semantic token** (`accent`) defaulting to emerald, so each hotel property can theme with its own single brand hue without touching anything else (§2.2). |
| System assumes one language, one surface | **Bilingual EN/AR + RTL rules (§6)** and a **guest display surface** (dark, distance-legible lobby/restaurant screens, §5.5). |

Everything the client already approved — flat frame, two-panel layout, keypad pattern,
labeled buttons, neutral keypad, single accent — is preserved unchanged.

---

## 1. Principles (the non-negotiables)

1. **One focus per screen.** The single most important task is big and unmistakable;
   everything else recedes.
2. **One dominant action per state — and per lane, one solid CTA.** Never make staff choose
   between equal-weight buttons. When the same action repeats down a list, the solid accent
   appears **once** (on the next item to act on); repeats go quiet (§5.3).
3. **Never make anyone guess.** Every actionable control carries a **word**. No icon-only
   buttons — staff are non-technical and multilingual; icons only *accompany* labels.
4. **Meaning, not decoration.** Color signals status/role, never mood. State is never
   conveyed by color alone — always paired with a label or text marker. (This also carries
   the accessibility load: color-blind staff and sun-glared lobby screens.)
5. **No clutter, no unearned decoration.** No gradients, gloss overlays, background blobs,
   or copy that repeats itself. Flat surfaces + one color-matched shadow, maximum.
6. **Both orientations are first-class.** Portrait and landscape via Tailwind
   `portrait:`/`landscape:` variants — no JS orientation logic.
7. **The frame never scrolls.** `h-dvh overflow-hidden`; only inner lists scroll. The
   primary action can never slide off-screen.
8. **Big, tactile targets.** ≥48–56 px tap targets; press feedback via
   `active:translate-y-px` / `active:scale-95`, never hover states (no mouse on a terminal).
9. **New — Locale is a first-class axis.** Every layout must survive RTL mirroring and
   Arabic label lengths without breaking (§6). Staff terminals default to English; guest
   surfaces default bilingual Arabic-first.
10. **New — Scarcity is what makes the accent work.** If a screen ever shows more than
    ~2 solid-accent surfaces at once (one per lane, plus the header tile), something is
    misclassified. Count them during review.

---

## 2. Color

### 2.1 Neutrals (do almost all the work) — unchanged from v4

| Role | Class |
|---|---|
| Canvas | `bg-slate-100` |
| Card / panel surface | `bg-white border border-slate-200` |
| Recessed field (display/inputs) | `bg-slate-50 border-slate-200` |
| **Keypad keys — ALL of them** (digits, 0, backspace, Clear) | `bg-slate-700 text-white` (active `bg-slate-800`) — one neutral skin, differentiated by label/icon only |
| **Secondary action buttons** (Recall, Reprint, any non-primary, and every *repeated* lane action per §5.3) | `bg-white border border-slate-200 text-slate-700` (active `bg-slate-50`) |
| Primary text | `text-slate-800` |
| Muted text | `text-slate-500` |
| Faint / captions | `text-slate-400` |

> **Rule (unchanged):** if a control isn't *the one* dominant action in its lane, it does
> not get a solid color fill.

### 2.2 The accent — now a themable token, still used in exactly three roles

Define semantic tokens instead of hard-coding emerald, so each hotel property gets its own
single brand hue (white-label requirement for the Dubai market) while the "one accent"
architecture stays intact. **As shipped in `app/globals.css`** — Tailwind v4 is CSS-first,
so tokens live in an `@theme inline` block, need the `--color-` prefix to generate
`bg-`/`text-`/`border-*` utilities, and can reference the palette that `@import
"tailwindcss"` already loads directly as CSS variables (no `theme()` function needed):

```css
@theme inline {
  --color-accent-50:  var(--color-emerald-50);
  --color-accent-200: var(--color-emerald-200);
  --color-accent-400: var(--color-emerald-400);  /* focus ring */
  --color-accent-600: var(--color-emerald-600);  /* default; property-overridable */
  --color-accent-700: var(--color-emerald-700);
}
```

A property override only needs to redefine these five variables to the same names. This
generates `bg-accent-600`, `text-accent-700`, `border-accent-200`, etc. — use only these
classes:

| Role | Class |
|---|---|
| Primary CTA — one per lane, on the next-to-act card or the screen's single task action | `bg-accent-600 text-white` (active `bg-accent-700`) |
| Header icon tile (brand mark) | `bg-accent-600` |
| Positive status pill (Serving / Completed / Done — one bucket) | `bg-accent-50 text-accent-700 border border-accent-200` |

**Theming constraints (hard requirements, checked at onboarding):**
- White text on `accent-600` must hit **≥ 4.5:1** contrast.
- The property may not pick an accent that collides with the fixed semantics: nothing in
  the **amber/orange band** (reads as "waiting") or the **red band** (reads as
  "destructive/urgent"). Amber and red are *not* themable.
- Exactly one accent per property. A hotel with two brand colors picks one.

### 2.3 Amber — attention, small pills only (unchanged)

| Role | Class |
|---|---|
| Waiting status pill | `bg-amber-50 text-amber-700 border border-amber-200` |
| Elapsed-time attention (8–15 min) | same recipe |
| Paused / needs-attention note | `text-amber-600` (text only, never a filled surface) |

### 2.4 Red — destructive & urgent, idle-quiet / armed-loud (unchanged, one clarification)

| State | Class |
|---|---|
| Cancel button, idle | `bg-white border border-red-200 text-red-600` |
| Cancel, armed (first tap, 3 s confirm window) | `bg-red-500 text-white` — momentary, small surface |
| Elapsed-time **urgent** (15 min – 4 h only, §4) | `bg-red-50 text-red-600 border border-red-200` — small pill only |

**Clarification:** red urgency has an *upper* bound now. A ticket that has sat for days is
not urgent — it's stale data, and painting it red trains staff to ignore red (exactly what
the current screenshot shows). See §4.

### 2.5 Status pill map (final)

| State | Class |
|---|---|
| Waiting | `bg-amber-50 text-amber-700 border-amber-200` |
| In Progress / Serving / Completed / Done | `bg-accent-50 text-accent-700 border-accent-200` |
| Cancelled / No-show | `bg-slate-100 text-slate-500 border-slate-200` (label text distinguishes which) |

Total saturated hues anywhere in the staff system: **3** (accent, amber, red). Everything
else neutral. Unchanged from v4 — v5 just makes the accent swappable per property.

---

## 3. Typography

**Latin/UI:** **Geist** (`--font-geist-sans`). **Numbers:** monospace
(`font-mono font-black tabular-nums`) — the ticket/register-readout feel, and tabular
digits keep queue numbers and timers from jittering.

**Arabic (new):** pair with **IBM Plex Sans Arabic** (or Noto Sans Arabic as fallback) —
load it alongside Geist and let the font stack resolve per script:
`font-family: var(--font-geist-sans), 'IBM Plex Sans Arabic', sans-serif;`
Arabic UI text uses the same size scale but **avoid `uppercase` and wide
`tracking-[0.18em]` on Arabic strings** — Arabic has no case, and letter-spacing breaks
cursive joining. The caps-label recipe applies to Latin only; the Arabic line of a
bilingual label renders at normal tracking, medium weight.

**Numerals:** Western Arabic digits (0–9) everywhere, including Arabic-language surfaces —
this is standard UAE practice and keeps `font-mono tabular-nums` working. Wrap numbers in
`dir="ltr"` spans inside RTL text so "Bill 32241" never reorders.

| Role | Recipe |
|---|---|
| Primary display number | `text-5xl font-mono font-black tracking-wider tabular-nums` in an `h-[4.5rem]` recessed field |
| List/tile number | `font-mono font-black text-lg` |
| Panel heading | `text-lg font-bold text-slate-800` |
| Caps label (Latin only) | `text-[10px]/[11px] font-bold uppercase tracking-[0.18em] text-slate-400/500` |
| Bilingual label pair | Arabic line first on guest surfaces (normal tracking, `font-medium`), Latin caps line second; on staff surfaces Latin first |
| Body / meta | `text-sm text-slate-800` / `text-xs text-slate-400` |

One heading **or** one subtitle **or** one field label — never two restating the same thing.

---

## 4. Time & number formatting (new section — fixes the "7160 min" badges)

Elapsed time on a card is a **decision aid**, not a stopwatch. Format and color it in
buckets:

| Elapsed | Display | Pill treatment | Meaning |
|---|---|---|---|
| 0–7 min | `4 min` | `bg-slate-100 text-slate-500 border-slate-200` (quiet) | Normal |
| 8–14 min | `12 min` | amber recipe (§2.3) | Getting long — glanceable |
| 15 min – 4 h | `18 min`, `1h 05m` | red recipe (§2.4) | Actionable urgency |
| > 4 h | `9h`, `2d` | `bg-slate-100 text-slate-400 border-slate-200` + label `stale` | Data hygiene — surface it in an admin "stale tickets" view, don't shout on the ops screen |

Formatting rules: under 60 min → `{n} min`; 1–24 h → `{h}h {mm}m`; over 24 h → `{d}d`.
Never render raw minute counts above 59. Timers update at most once per minute (per-second
updates are visual noise; the header clock is the only per-second element).

The 8/15-minute thresholds and the 4-hour stale boundary are **per-station config**
(a room-service kitchen and a front-desk queue have different tolerances), but the
four-bucket structure and their treatments are fixed.

Clock: staff header clock is **24-hour** (`15:33`), Gulf Standard Time from the property
setting, with the date line above it — unchanged `HeaderClock` pattern (mount-guarded
`useState<Date|null>` + 1 s interval). Guest displays may show 12-hour per property
preference.

---

## 5. Layout patterns

### 5.1 The frame (unchanged)
`h-dvh overflow-hidden overscroll-none touch-manipulation select-none`, `bg-slate-100`.
Flat white header (`bg-white border-b border-slate-200`): accent icon tile, counter name +
caps type line, live clock right-aligned (RTL: end-aligned — use logical utilities, §6).
`viewportFit:'cover'`; consume safe-area insets top and bottom.

### 5.2 Two-panel task layout (unchanged)
Task panel beside list panel. Landscape: task `~1.3fr` at the inline-start, list `1fr`.
Portrait: task `~1.55fr` on top. `grid gap-3 p-3`.

### 5.3 Lanes & the FIFO emphasis rule (new — the core v5 layout fix)

For queue lanes (Kitchen's *New Orders* / *Cooking*, and any list where every card carries
the same action):

- **The first card in the lane** (oldest, next to act on) renders its action as the solid
  accent CTA (`bg-accent-600`), full card width, tallest control on the card.
- **Every card below it** renders the *same* action in the quiet secondary skin
  (`bg-white border border-slate-200 text-slate-700`) — still labeled, still tappable, just
  not shouting.
- When the first card leaves the lane, the next card's action promotes to the accent skin
  (animate the swap with the standard 0.25 s ease-out, no loops).
- Net effect: at most **one solid accent CTA per lane**, and it always marks "do this one
  next" — the accent gains operational meaning instead of being wallpaper.

A card gets **one** primary action. If a shortcut exists (e.g. mark "Ready" directly from
*New Orders*, skipping *Cooking*), it renders as the quiet secondary beside/below the
primary — never two solid buttons of equal weight.

Lane headers keep the caps label + count chip pattern; the count chip is neutral
(`bg-white border-slate-200 text-slate-600`), with the amber dot marker allowed before the
"New Orders" label as a text-adjacent status marker (color + position, not color alone).

### 5.4 The keypad pattern (unchanged from v3/v4)
Recessed display field (`bg-slate-50 rounded-2xl border-2 border-slate-200`,
`focus-within:border-accent-400 focus-within:ring-4 focus-within:ring-accent-600/10`) above
a 3×4 digit grid of `bg-slate-700` keys (Clear included — no red key), with the tall
accent primary CTA spanning the 4th column. Generalizes to any "type a value, then commit"
task.

### 5.5 Guest display surface (new — lobby / restaurant queue screens)

Hotels need wall screens guests read from 3–8 m away. This is a **separate token set**, not
a restyle of the terminal — dark, high-contrast, zero interactivity:

| Role | Class |
|---|---|
| Canvas | `bg-slate-900` |
| "Now serving" tile | `bg-accent-600 text-white` — the one accent surface, huge mono number |
| Queue list rows | `bg-slate-800 border border-slate-700 text-slate-100` |
| Waiting numbers | `text-slate-100`, mono, ≥ `text-6xl` |
| Labels | bilingual, Arabic first (`dir="rtl"` block) over Latin caps line, `text-slate-400` |
| Called-number flash | tile scales `1 → 1.03 → 1` once, 0.25 s — no loops, no marquees |

Rules: numbers are the content — minimum `text-6xl`, mono, tabular. No shadows (they're
invisible at distance on dark), no cards-within-cards, no more than *now serving* + the
next 5–8 numbers. If the property enables an audio chime on call, it pairs with the
one-shot flash. Nothing on this surface is tappable, so no labeled-button rules apply —
but the color-plus-text rule still does (the served number is accent **and** labeled
"Now serving / يتم الخدمة الآن").

### 5.6 List rows and status (unchanged)
Flat white cards (`rounded-2xl border border-slate-200 shadow-sm`), solid-tint number tile
(`bg-slate-100` neutral; the "just added" row may use `bg-accent-50 border-accent-300`),
primary text + meta, status pill (§2.5), labeled actions per §5.3.

---

## 6. RTL & bilingual rules (new)

Dubai properties serve Arabic- and English-reading guests; staff are multilingual with
English as the working language. The split:

- **Staff terminals:** English UI by default, per-property option to switch. One language
  at a time on staff surfaces — bilingual staff labels double every string and violate the
  no-redundant-copy rule.
- **Guest surfaces (display boards, printed tickets):** bilingual by default, Arabic first.

Implementation rules:

1. **Logical properties everywhere.** Use Tailwind logical utilities — `ps-*`/`pe-*`,
   `ms-*`/`me-*`, `start-*`/`end-*`, `text-start`/`text-end`, `rounded-s-*`/`rounded-e-*` —
   never `pl/pr/ml/mr/left/right`. Then `dir="rtl"` on the root mirrors the whole layout
   for free: task panel stays at the inline-start, clock stays at the inline-end.
2. **Directional icons flip; symbolic icons don't.** Backspace, arrows, and "next" chevrons
   mirror under RTL (`rtl:-scale-x-100` or lucide's directional variants). Check marks,
   flame, printer, bell do not.
3. **Numbers never mirror.** Digits, timers, and IDs render LTR (`dir="ltr"` span,
   `tabular-nums`) inside RTL text.
4. **No caps/tracking on Arabic** (§3). The caps-label style has an Arabic counterpart:
   normal tracking, `font-medium`, same size and color.
5. **Length tolerance.** Arabic strings run ±30% vs English. Buttons and pills size from
   content with sensible min-widths; never fixed-width labels. Verify the §9 checklist in
   both `dir` values.
6. **The keypad does not mirror.** Digit order 1-2-3 / 4-5-6 / 7-8-9 / 0 is a physical
   convention (phones, POS) shared across locales — pin it `dir="ltr"`.

---

## 7. Action rules (read before adding any button)

- **Primary** = `bg-accent-600`, one per lane/panel (§5.3), the largest control in its
  context. Label = the outcome: `Generate Ticket`, `Order Ready` — not `Submit`, `OK`.
- **Secondary** = white bordered, icon + label. Includes every repeated lane action below
  the first card, and every shortcut action.
- **Destructive** = the two-tap `RowCancel` guard: idle quiet red-bordered `Cancel` → armed
  solid `bg-red-500` `Confirm` (3 s window, auto-disarm). Never a solid red at rest.
- **Fixed positions.** The same action lives in the same spot across states and cards —
  promotion from quiet to accent (§5.3) changes skin, never position.
- **Disabled** = `disabled:opacity-40`; add a reason caption only when the reason isn't
  obvious ("Queue is paused").
- An action keeps its name through the flow: the button that says `Order Ready` produces a
  status that says `Ready`, not `Fulfilled`.

---

## 8. Elevation, radius, spacing, motion, icons (consolidated, unchanged in substance)

**Radius:** panels `rounded-3xl`; buttons/keys/tiles `rounded-2xl` (small tiles
`rounded-xl`); pills `rounded-full`.

**Shadows** — one flat, color-matched shadow per surface; only two solid-fill families
exist, so only these recipes:

```txt
Keypad key / neutral solid   shadow-[0_4px_10px_-4px_rgba(15,23,42,0.35)]
Card / panel                 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)]
Small chip                   shadow-sm
Primary CTA (accent)         shadow-[0_6px_16px_-6px_rgb(from_var(--accent-600)_r_g_b/0.5)]
                             (or precompute the rgba per property theme)
Guest display surface        no shadows
```

**Spacing/targets:** layout `p-3`–`p-4`, gaps `gap-2`–`gap-3`; targets ≥48–56 px; primary
CTA is the tallest element in its context; safe-area insets consumed at header and footer.

**Motion:** list enter/exit `motion.div layout`, `y:-8 scale:.98 → 0/1`, 0.25 s ease-out;
tap feedback CSS-only; the §5.3 promotion swap uses the same 0.25 s; respect
`prefers-reduced-motion` (skip enter/exit and the guest-display flash; state changes remain
instant). Everything ≤ 0.25 s.

**Icons:** `lucide-react`, `size-5`–`size-8`; always beside a label on actionable
controls; directional icons follow §6.2.

---

## 9. Worker-clarity & quality checklist (run before shipping any route)

- [ ] Every actionable control has a visible text label.
- [ ] At most one solid-accent CTA **per lane**, and it marks the next item to act on.
- [ ] Count solid accent surfaces on screen: header tile + ≤1 per lane. More = misclassified.
- [ ] No state signalled by color alone.
- [ ] No elapsed-time badge shows a raw minute count ≥ 60; stale items are slate, not red.
- [ ] No two pieces of copy say the same thing.
- [ ] No gradients, gloss overlays, background blobs; one color-matched shadow max.
- [ ] The frame doesn't scroll; only lists scroll.
- [ ] White-on-accent contrast ≥ 4.5:1 for the active property theme.
- [ ] Verified at 893×533 and 533×893, in `dir="ltr"` **and** `dir="rtl"`.
- [ ] Guest display verified at TV distance (zoom the screenshot to 25% — can you still read the numbers?).

---

## 10. Migration checklist (from the current v3/v4-era code)

**Status by file** (update this table as each route lands — keep it honest, this is what
"is the app on v5 yet" actually means):

| File | Structure | Color/token | FIFO/time rules | Notes |
|---|---|---|---|---|
| `components/counter/console.tsx` (shared kit) | v3 ✅ | v5 ✅ | n/a | `KeypadKey` one neutral skin, `STATUS_PILL` merged accent bucket |
| `KitchenCounter.tsx` | v3 ✅ | v5 ✅ | v5 ✅ | first migration; reference implementation for §5.3/§4 |
| `OrderCounter.tsx` | v3 ✅ | v5 ✅ | n/a (no repeated-CTA lane) | token/component pass only, no layout change |
| `BillingCounter.tsx` | v2 "Soft Warm" ❌ | v2 ❌ | n/a | **not started** — still on `shell.tsx`'s warm-cream kit |
| `DeliveryCounter.tsx` | v1 legacy teal ❌ | v1 ❌ | n/a | **not started** — furthest behind, skip v2/v3 as waypoints, go straight to v5 |

Checklist (apply per file above as it's migrated):

- [x] Introduce the `accent` token family (default = emerald) in `app/globals.css`'s
      `@theme inline` block (§2.2); replace every `emerald-*` UI class with `accent-*`.
      Amber/red stay literal. — done for `console.tsx` + `OrderCounter.tsx`.
- [x] Complete the v4 sweep: all `#2E4A79`/`#25406B` → `slate-700/800`; all
      `#2F9E4A`/`#278A41` → `accent-600/700`; `KeypadKey` collapses to one neutral skin;
      `green-50/700` "Completed" pill and `orange` "No-show" pill merge per §2.5. — done.
- [x] **Kitchen lanes:** implement §5.3 — first card per lane gets the accent CTA, the rest
      get the quiet skin; demote each card's second action ("Ready" in *New Orders*) to the
      quiet secondary; "Start Prep" is primary only on the first *New Orders* card. — done.
- [x] **Time badges:** replace raw `{minutes} min` with the §4 bucket formatter and pill
      map; move >4 h tickets into the stale treatment; add per-station threshold config.
      — done (`KitchenCounter.tsx`'s `WARN_AFTER_MIN`/`ALERT_AFTER_MIN`/`STALE_AFTER_MIN`).
- [ ] **Billing + Delivery — structure first:** these two never went through v3 at all, so
      this is a bigger lift than Order's token-only pass — adopt the flat frame, two-panel
      layout, and `console.tsx` primitives (`ConsoleFrame`, `KeypadKey`/`RowCancel` where
      applicable) *before* applying color, not as a separate pass.
- [ ] Once Billing + Delivery are off `shell.tsx`, delete its legacy `CounterShell` /
      `CounterSplit` / teal atoms and the "Soft Warm" kit (`CounterCanvas`, `HeroSplit`,
      `DarkPill`, `SoftButton`, etc.) — only `useNow`/`minutesSince` need to survive, and
      can move into `console.tsx` with the rest of the shared kit.
- [ ] Swap physical spacing/positioning utilities for logical ones (§6.1); pin the keypad
      `dir="ltr"`; wrap numbers in LTR spans. — partially done ad hoc on `KitchenCounter.tsx`
      (`ms-auto`, LTR number spans); not yet audited on `OrderCounter.tsx`'s keypad grid or
      Billing/Delivery once they're rebuilt.
- [ ] Add the Arabic font to the stack; audit caps labels for the Arabic counterpart style.
- [ ] Build the guest display route on the §5.5 token set (new surface, don't reuse
      terminal components).
- [ ] Re-verify both orientations × both directions; run the §9 checklist.

---

## 11. Quick reference (copy-paste)

```txt
STAFF TERMINAL (light)
Canvas ................ bg-slate-100 text-slate-800
Card / panel .......... rounded-3xl bg-white border-slate-200 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)]
Keypad key (ALL) ...... bg-slate-700 text-white active:bg-slate-800 shadow-[0_4px_10px_-4px_rgba(15,23,42,0.35)]
Secondary button ...... bg-white border-slate-200 text-slate-700 active:bg-slate-50
Primary CTA ........... bg-accent-600 text-white active:bg-accent-700  (ONE per lane — first card only)
Header icon tile ...... bg-accent-600
Destructive idle ...... bg-white border-red-200 text-red-600
Destructive armed ..... bg-red-500 text-white (3s window)
Recessed field ........ bg-slate-50 border-2 border-slate-200 focus-within:border-accent-400
Number ................ font-mono font-black tabular-nums, always dir="ltr"
Caps label (Latin) .... text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500
Arabic label .......... same size/color, normal tracking, font-medium — never uppercase/tracked

STATUS PILLS
Waiting ............... bg-amber-50 text-amber-700 border-amber-200
Serving / Done ........ bg-accent-50 text-accent-700 border-accent-200
Cancelled / No-show ... bg-slate-100 text-slate-500 border-slate-200

ELAPSED TIME
0–7 min "4 min" quiet slate · 8–14 min amber · 15 min–4 h red ("1h 05m") · >4 h "2d" stale slate
Never a raw minute count ≥ 60. Update 1×/min.

GUEST DISPLAY (dark, non-interactive)
Canvas bg-slate-900 · Now-serving tile bg-accent-600 (huge mono number, labeled bilingually)
Rows bg-slate-800 border-slate-700 · numbers ≥ text-6xl mono · Arabic-first labels · no shadows

Saturated hues in the whole system: 3 (accent — per-property themable, amber, red).
Accent on screen: header tile + at most one CTA per lane. Everything else neutral.
```