# VibeQueue Design System — "Soft Warm" (v2, legacy)

> ⚠️ **Legacy (Soft Warm).** For any route you are **redesigning**, follow the canonical
> [`design-system-v3.md`](./design-system-v3.md) ("Operator Console") instead. The client's
> preference moved to that flatter, higher-contrast, light system after iterating on the
> Order counter. This document now only describes surfaces still running v2: **Billing**
> and **Kitchen**. Do not start new redesign work from this file — migrate those two to v3
> when they're next touched, per [`design-system-v3.md`](./design-system-v3.md) §8.
>
> The reusable primitives for v2 live in [`components/counter/shell.tsx`](../components/counter/shell.tsx)
> (see §4 below); the reference implementation is [`components/counter/BillingCounter.tsx`](../components/counter/BillingCounter.tsx).

---

## 0. What this is

A warm, premium, tactile UI language for staff-facing terminals: warm cream canvas,
big floating rounded cards with soft shadows, a coral→peach **gradient hero** for the
"thing being acted on," **dark charcoal pill** primary buttons, soft tinted tag-pills.
It was designed for the **Honor Pad X7** counter tablet (CSS viewport ≈ **893×533**
landscape / **533×893** portrait) but the foundations apply to any route.

It intentionally **diverges from the old teal brand.** On this system, coral is the
"active/now" accent, charcoal is the primary action, everything else is warm neutral.

---

## 1. Principles (the non-negotiables)

1. **One focus per screen.** The single most important thing (the order being served, the
   number to call) is huge and unmistakable. Everything else recedes.
2. **One dominant action per state.** Never make staff choose between five equal buttons.
   There is always exactly one obvious primary action; secondary actions are visibly lesser.
3. **Never make anyone guess.** Every actionable control carries a **word** — no icon-only
   buttons. Staff are non-technical; a bell or an ✕ alone is not acceptable. Icons only ever
   *accompany* a label. (See [[feedback-labeled-buttons-workers]].)
4. **Meaning, not decoration.** Coral = active/now, amber = attention, red = destructive,
   green = done, everything else warm-neutral. State is **never conveyed by color alone** —
   always pair it with a label, dot, or text marker.
5. **No clutter.** If an element doesn't help someone serve the next customer faster, cut it.
   Whitespace is fine; noise is not.
6. **Both orientations are first-class.** Portrait and landscape are equally polished, and
   the layout + muscle memory stay consistent across a rotation. Handled with CSS only
   (Tailwind `portrait:` / `landscape:` variants) — no JS orientation logic.
7. **The frame never scrolls.** The app is `h-dvh overflow-hidden`; only inner lists scroll.
   The primary action can never slide off-screen.
8. **Big, tactile targets.** Minimum tap target **56px** (`h-14` / `size-14`). Buttons give
   physical feedback (`active:scale`).

---

## 2. Foundations (tokens)

### 2.1 Color

**Surfaces**

| Role | Value | Class |
|---|---|---|
| Canvas (app bg) | `#F4EFEA` warm cream | `bg-[#F4EFEA]` |
| Canvas blush overlay | coral radial, ~18% | `bg-[radial-gradient(120%_90%_at_100%_0%,rgba(255,138,92,0.20),transparent_58%),radial-gradient(90%_70%_at_0%_100%,rgba(255,170,120,0.12),transparent_60%)]` |
| Card surface | white | `bg-white` |
| Soft/empty surface | translucent white | `bg-white/70` |

**Accents**

| Role | Value | Class |
|---|---|---|
| Active hero gradient | `#FF6A3D → #FF875A → #FFB184` | `bg-gradient-to-br from-[#FF6A3D] via-[#FF875A] to-[#FFB184]` |
| Hero gloss overlay | white radial, top-left | `bg-[radial-gradient(85%_60%_at_12%_0%,rgba(255,255,255,0.38),transparent_55%)]` |
| Accent (coral, on light) | `orange-100 / orange-700` | tag pills, highlighted number tile |
| Primary action | charcoal `#2A2724` | `bg-[#2A2724] text-white` |
| Icon accent | coral | `text-[#FF6A3D]` |

**Text**

| Role | Class |
|---|---|
| Primary text | `text-stone-800` |
| Muted text | `text-stone-500` |
| Faint / captions | `text-stone-400` |
| On coral / on charcoal | `text-white` (+ `text-white/85` for secondary) |

**Semantic (status)** — always paired with a label, never color-only:

| State | Class (pill) |
|---|---|
| Neutral / waiting-ok | `bg-stone-100 text-stone-500` |
| Accent / now / next | `bg-orange-100 text-orange-700` |
| Attention (paused, warn) | `bg-amber-100 text-amber-700` |
| Destructive | `bg-red-100 text-red-600` (armed: `bg-red-500 text-white`) |
| On dark (on hero) | `bg-white/20 text-white` |

**Waiting-time escalation** (used on queue cards / elapsed pills):
`< 8 min` neutral → `≥ 8 min` amber → `≥ 15 min` red. Numbers use `tabular-nums`.

### 2.2 Typography

Font: **Geist** (`--font-geist-sans`), already loaded app-wide. Numbers are **sans**
`font-black tabular-nums` (not mono) to match the reference.

| Role | Recipe |
|---|---|
| Hero number | `font-black tabular-nums leading-[0.82] text-[clamp(4.5rem,20vh,9rem)]` |
| Card / tile number | `font-black tabular-nums text-2xl` |
| Section / bill title | `text-2xl font-bold` (hero) · `font-bold` (cards) |
| Counter name (header) | `text-[15px] font-bold text-stone-800` |
| Caps label | `text-[10px]/[11px] font-bold uppercase tracking-[0.2em] text-stone-400` |
| Body / meta | `text-sm text-stone-500` / `text-stone-400` |

> Size the hero number with a **viewport-height `clamp()`** so it fills the short (≈533px)
> landscape and the tall portrait without overflowing. Never let it wrap.

### 2.3 Radius

| Element | Radius |
|---|---|
| Hero card | `rounded-[28px]` |
| Cards, buttons, number tiles | `rounded-2xl` (16px) |
| Pills, chips, circular controls | `rounded-full` |

### 2.4 Elevation (shadows)

Exported from the kit as constants — **use these, don't hand-roll shadows**:

```ts
SOFT_SHADOW     = 'shadow-[0_16px_40px_-18px_rgba(90,50,25,0.30)]'  // cards, hero (white)
SOFT_SHADOW_SM  = 'shadow-[0_10px_26px_-14px_rgba(90,50,25,0.28)]'  // queue cards, icon tiles
```
Special cases: the **gradient hero** uses a coral glow
`shadow-[0_22px_50px_-18px_rgba(255,106,61,0.55)]`; the **charcoal pill** uses
`shadow-[0_12px_26px_-12px_rgba(42,39,36,0.75)]`. Shadows are warm (brown-tinted), never gray.

### 2.5 Spacing, targets, safe areas

- Layout padding `p-3`, gaps `gap-2`–`gap-3`, card padding `p-5` (hero) / `p-2.5`–`p-3` (list).
- **Min tap target 56px** (`h-14` / `size-14`).
- The page sets `viewportFit:'cover'`; consume insets: `pt-[env(safe-area-inset-top)]` on the
  header, `pb-[calc(0.75rem+env(safe-area-inset-bottom))]` on the bottom-most content.

### 2.6 Motion (restrained)

| What | Recipe |
|---|---|
| Hero swap (call/done) | `AnimatePresence mode="wait"`, `initial y:12 → 0`, `exit y:-12`, `0.22s ease-out`, keyed by focus id |
| List row enter/exit | `motion.div layout`, `y:-8 scale:.98 → 0/1`, `exit scale:.98`, `0.25s ease-out` |
| Tap feedback | CSS only: `active:scale-[0.98]` (buttons) / `active:scale-95` (icons) — no Framer, for latency |

Keep everything ≤ 0.25s. This is a busy terminal, not a showcase — no long or looping motion.

### 2.7 Icons

`lucide-react`, `size-5` on buttons, `size-3.5` in pills. **On any actionable control an icon
must sit next to a text label**, never alone.

---

## 3. Layout patterns

### 3.1 The frame
`CounterCanvas` = `h-dvh overflow-hidden overscroll-none touch-manipulation select-none`,
warm bg + blush, a clean floating header (soft white icon tile · name over caps type-label ·
right-aligned status pills), an optional full-width `banner` slot, then the content area.

### 3.2 Hero + list (`HeroSplit`)
The core terminal layout: a **hero** card + a scrolling **list**.
- **Landscape:** hero left (`minmax(360px,45%)`), list right. `grid-cols-[minmax(360px,45%)_1fr]`
- **Portrait:** hero top (auto height), list below (fills). `grid-rows-[auto_1fr]`
- `gap-3 p-3`, safe-area bottom padding. Actions live **inside** the hero card.

### 3.3 The three-state model (generalize this to every route)
Every terminal screen resolves to one of three hero states:

| State | Hero | Actions |
|---|---|---|
| **Active** (something is being acted on) | **coral gradient card** — huge number, details, on-card actions | one primary (charcoal pill) + labeled secondaries |
| **Idle** (nothing active, but work is queued) | **white featured card** — accent "next" tag, big number, single CTA | one primary (charcoal pill) e.g. `Call #N` |
| **Empty** (nothing to do) | **calm empty card** — soft icon tile + short message | none |

The list beside/below shows what's queued as **floating cards**; highlight the "next" one
(accent number tile + `ring-1 ring-orange-200`).

---

## 4. The kit (components in `shell.tsx`)

All exported from [`components/counter/shell.tsx`](../components/counter/shell.tsx). The
generic ones (pills, buttons, tiles, cards, shadows) are route-agnostic; promote them to
`components/ui/` when adoption spreads beyond counters.

| Component | Purpose | Key props |
|---|---|---|
| `CounterCanvas` | Warm frame + header + banner slot | `icon, typeLabel, name, chips, banner, children` |
| `HeroSplit` | Orientation-adaptive hero + list | `hero, list` |
| `SoftPill` | Tinted tag/status pill | `tone` (`neutral\|accent\|amber\|red\|onDark`), `icon` |
| `DarkPill` | **Primary CTA** — charcoal pill | button props (`onClick`, `disabled`, `className`) |
| `SoftButton` | **Labeled secondary** button | `icon`, `onDark`, button props |
| `ConfirmSoftButton` | **Destructive, labeled, two-tap guard** | `onConfirm, idle, armed, icon, onDark` |
| `NumberTile` | Rounded-square number "thumbnail" | `n`, `accent` |
| `QueueCard` | A queued order as a floating card | `entry, now, highlight` |
| `LoadingState` | Loading placeholder | `icon` |
| `SOFT_SHADOW`, `SOFT_SHADOW_SM` | Shadow constants | — |

**Reference hero/idle/empty cards** (`ServingHero`, `UpNextHero`, `EmptyHero`) live in
`BillingCounter.tsx` — copy their structure per route (the *content* differs, the *shell* doesn't).

---

## 5. Action rules (read this before adding any button)

- **Primary** = `DarkPill`, full-width or dominant, one per state. Label = the outcome
  (`Billing Done`, `Call #14`, `Add`, `Order Ready`).
- **Secondary** = `SoftButton` (labeled, white). Never icon-only.
- **Destructive** = `ConfirmSoftButton` — first tap arms (turns red, shows `Tap to confirm`),
  second tap within 3s fires. Stays labeled while armed.
- **Fixed positions.** The same action lives in the same spot across states so muscle memory
  holds. Don't reflow buttons between states.
- Disabled states use `disabled:opacity-40`; explain *why* in a caption when useful
  (`Queue is paused`).

---

## 6. Accessibility & worker-clarity checklist

- [ ] Every actionable control has a visible text label.
- [ ] Exactly one dominant primary action is obvious at a glance.
- [ ] No state is signalled by color alone (label / dot / text marker present).
- [ ] Tap targets ≥ 56px.
- [ ] Primary text is `stone-800` on light / `white` on coral/charcoal (sufficient contrast).
- [ ] The big number never wraps or clips in either orientation at 893×533 / 533×893.
- [ ] Frame doesn't scroll; only the list scrolls.

---

## 7. How to redesign a route with this system

1. **Wrap it in `CounterCanvas`** — pass the route's icon, a caps `typeLabel`, its name, the
   status `chips` (as `SoftPill`s), and any `banner`.
2. **Pick the layout.** Most terminals → `HeroSplit`. If the route isn't "one focus + a
   queue" (e.g. Kitchen's two prep lanes, Order's number pad), keep the *foundations*
   (canvas, cards, `SOFT_SHADOW`, pills, labeled `DarkPill`/`SoftButton`, type scale) and lay
   out cards to fit — don't force `HeroSplit`.
3. **Model the three states** (active / idle / empty). Active → coral gradient hero with the
   primary `DarkPill` + labeled secondaries. Idle → white featured card + single CTA. Empty →
   calm empty card.
4. **Render the queue** as floating `QueueCard`s; highlight the next one.
5. **Wire actions** to the existing server actions unchanged — this is presentation only.
   Primary = `DarkPill`, destructive = `ConfirmSoftButton`, secondary = `SoftButton`.
6. **Add restrained motion** (§2.6).
7. **Verify** both orientations at 893×533 and 533×893 and run the §6 checklist. Screenshot
   with headless Chrome (`--window-size`, `--force-device-scale-factor=1`) or the `run` skill.

---

## 8. Rollout status

- ✅ **Billing** (`BillingCounter.tsx`) — reference implementation, done.
- ⬜ **Order** — POS number pad as the "hero," recent-orders list; keep the pad but restyle to
  warm cards + `DarkPill` "Add"; preserve the hidden print DOM + `.no-print` receipt untouched.
- ⬜ **Kitchen** — two prep lanes (New / Cooking); apply foundations, not `HeroSplit`.
- ⬜ **Delivery** — like Billing + tap-to-call phone block + "recently delivered" list.
- ⬜ Promote generic primitives from `shell.tsx` → `components/ui/`; retire the legacy teal
  `CounterShell`/`CounterSplit` once all four counters are migrated.
- ⬜ Suppress the global `InstallPrompt` on `/counter` routes (it overlays the primary button
  on a kiosk).
- ◻️ Decide whether admin / branch / public surfaces adopt this warm language or the app
  keeps a deliberate split (staff terminals = warm, back-office = neutral).

---

## 9. Quick reference (copy-paste)

```txt
Canvas ......... bg-[#F4EFEA] text-stone-800
Hero gradient .. bg-gradient-to-br from-[#FF6A3D] via-[#FF875A] to-[#FFB184]
Primary CTA .... <DarkPill> (bg-[#2A2724] text-white, h-14, rounded-2xl)
Secondary ...... <SoftButton icon={Icon}>Label</SoftButton>   (always labeled)
Destructive .... <ConfirmSoftButton idle="Cancel" armed="Tap to confirm" />
Tag/status ..... <SoftPill tone="accent|amber|red|neutral|onDark">…</SoftPill>
Card ........... rounded-2xl bg-white ${SOFT_SHADOW_SM}
Hero card ...... rounded-[28px] … shadow-[0_22px_50px_-18px_rgba(255,106,61,0.55)]
Number ......... font-black tabular-nums text-[clamp(4.5rem,20vh,9rem)]
Caps label ..... text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400
Min tap target . 56px (h-14 / size-14)
```
