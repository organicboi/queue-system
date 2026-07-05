# VibeQueue Design System — "Operator Console" (v3, layout canonical / color superseded)

> ⚠️ **Color superseded by [`design-system-v4.md`](./design-system-v4.md).** The real
> implementation of this system drifted into six competing saturated hues (navy keys, red
> Clear key, three different greens, amber, orange) — client feedback was *"too many
> primary colors, too poky to the eyes."* **v4 corrects the palette only**; everything below
> (frame, two-panel layout, keypad pattern, motion, labeled-button rules, the redesign
> recipe) is still the current standard. Read this document for structure, v4 for color.
>
> It supersedes [`design-system-v2.md`](./design-system-v2.md) ("Soft Warm" — coral/cream/
> charcoal), which now only describes surfaces not yet migrated. The reference
> implementation is [`components/counter/OrderCounter.tsx`](../components/counter/OrderCounter.tsx)
> and [`components/counter/console.tsx`](../components/counter/console.tsx) (the shared kit,
> extracted once Kitchen became the second v3 route).

---

## 0. What this is, and why it replaced v2

v2 ("Soft Warm") was a coral-gradient, cream-canvas, consumer-app-inspired look. It was
approved for Billing and Kitchen, but when the same energy was tried on the Order counter,
client feedback moved the direction twice in a row:

1. *"the graphical representation is looking very simple"* — flat wasn't enough on its own;
   the surfaces needed real dimension (shadows, tactile keys), not just flat color.
2. *"make it like this for keypad and generate ticket button"* — pointing at a real
   ticket-dispenser reference: solid navy keys, a solid red Clear, a bold solid green
   action button, on a light neutral background.
3. *"remove unnecessary stuff and fix ugly things"* — once colors were right, the excess
   decoration (gradients, gloss-stripe seams, colored background blobs, redundant caption
   text) had to come back out.

The destination those three rounds converged on is **light, flat, high-contrast, and
functional** — the opposite instinct from v2's soft/warm/decorative approach, but built on
the exact same non-negotiables (one focus, one action, labeled buttons, no clutter). Think
**Square/Clover POS terminal or an airport ticket kiosk**, not a lifestyle app.

---

## 1. Principles (the non-negotiables — unchanged from v2, restated here so this doc is self-contained)

1. **One focus per screen.** The single most important task (enter this number, serve this
   order) is big and unmistakable. Everything else recedes.
2. **One dominant action per state.** Never make staff choose between several equal-weight
   buttons. There is always exactly one obvious primary action; secondary actions are
   visibly smaller/lighter.
3. **Never make anyone guess.** Every actionable control carries a **word** — no icon-only
   buttons. Staff are non-technical. Icons only ever *accompany* a label.
   (See [[feedback-labeled-buttons-workers]].)
4. **Meaning, not decoration.** Color signals status/role, never mood. State is **never**
   conveyed by color alone — pair it with a label or text marker.
5. **No clutter — and no unearned decoration.** If an element doesn't help someone finish
   the task faster, cut it. This includes text that repeats itself (a heading + a subtitle
   + a field label all saying the same thing) and visual effects that don't carry meaning
   (gradients, glows, gloss stripes, colored background blobs). **New in v3:** flat, solid
   surfaces are the default; add depth with exactly one correctly-toned drop shadow, never
   by stacking gradients/highlights/insets on top of each other.
6. **Both orientations are first-class.** Portrait and landscape are equally polished and
   the layout stays consistent across a rotation, via Tailwind `portrait:`/`landscape:`
   variants — no JS orientation logic.
7. **The frame never scrolls.** `h-dvh overflow-hidden`; only inner lists scroll. The
   primary action can never slide off-screen.
8. **Big, tactile targets.** Minimum tap target ~48–56px. Buttons give physical feedback on
   press (`active:translate-y-px` or `active:scale-*`), not hover states (there is no mouse).

---

## 2. Foundations (tokens)

### 2.1 Color

**Surfaces** — flat, no gradients, no color washes:

| Role | Value | Class |
|---|---|---|
| Canvas (app bg) | `slate-100` | `bg-slate-100` |
| Card surface | white | `bg-white` |
| Recessed field (display/inputs) | `slate-50` | `bg-slate-50` |
| Borders | `slate-200` | `border-slate-200` |

**Action colors** — solid, single-tone (no gradients):

| Role | Value | Class |
|---|---|---|
| Primary action (go / confirm / generate) | green `#2F9E4A` | `bg-[#2F9E4A]` (active `#278A41`) |
| Keypad digit / neutral key | navy `#2E4A79` | `bg-[#2E4A79]` (active `#25406B`) |
| Destructive key (Clear) | red `#DC4C4C` | `bg-[#DC4C4C]` (active `#C63D3D`) |
| Accent (header icon, highlight states, badges) | `emerald-600` | Tailwind token, solid |

> Each colored control gets **one** matching drop shadow (e.g. a green button gets a
> green-tinted shadow), never a white gloss overlay or an inset highlight line — those read
> as seams/artifacts at this button size, not polish.

**Text**

| Role | Class |
|---|---|
| Primary text | `text-slate-800` |
| Muted text | `text-slate-500` |
| Faint / captions | `text-slate-400` |
| On solid color (green/navy/red/emerald) | `text-white` |

**Semantic status pills** — same 5-state model as v2 (this is a data-model classification,
not a visual-theme choice, so it doesn't change between design systems), re-skinned flat:

| State | Class |
|---|---|
| Waiting | `bg-amber-50 text-amber-700 border border-amber-200` |
| In Progress / Serving | `bg-emerald-50 text-emerald-700 border border-emerald-200` |
| Completed / Done | `bg-green-50 text-green-700 border border-green-200` |
| Cancelled | `bg-slate-100 text-slate-500 border border-slate-200` |
| No-show | `bg-orange-50 text-orange-600 border border-orange-200` |

### 2.2 Typography

Font: **Geist** (`--font-geist-sans`) for UI text. **Numbers use monospace**
(`font-mono font-black tabular-nums`) — a deliberate departure from v2 (which used sans
numbers). Mono gives the ticket/register-readout feel the reference asked for.

| Role | Recipe |
|---|---|
| Primary display number (bill entry) | `text-5xl font-mono font-black tracking-wider tabular-nums` in a `h-[4.5rem]` recessed field |
| List/tile number | `font-mono font-black text-lg` |
| Panel heading | `text-lg font-bold text-slate-800`, centered |
| Caps label | `text-[10px]/[11px] font-bold uppercase tracking-[0.18em]–[0.2em] text-slate-400/500` |
| Body / meta | `text-sm text-slate-800` / `text-xs text-slate-400` |

Don't stack redundant copy: one heading **or** one subtitle **or** one field label — never
two or three all restating the same instruction (this was an actual bug fixed in v3: a
"BILL #" corner tag + an "Enter Bill Number" heading + a "Type the bill number, then tap…"
subtitle were all present at once and got trimmed to just the heading).

### 2.3 Radius

| Element | Radius |
|---|---|
| Panel / card | `rounded-3xl` |
| Buttons, keys, tiles | `rounded-2xl` (small tiles `rounded-xl`) |
| Pills, badges | `rounded-full` |

### 2.4 Elevation (shadows) — light, single, color-matched

No blurred backdrop glows, no `inset` highlight lines, no gloss-stripe overlays. One soft
shadow per surface, tinted to match the surface's own color at ~40–50% opacity:

```txt
Card / panel  shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)]      (neutral, slate-tinted)
Primary CTA   shadow-[0_6px_16px_-6px_rgba(47,158,74,0.5)]        (green-tinted)
Keypad key    shadow-[0_4px_10px_-4px_rgba(30,50,90,0.5)]         (navy-tinted)
Danger key    shadow-[0_4px_10px_-4px_rgba(220,76,76,0.5)]        (red-tinted)
Small chip    shadow-sm
```

### 2.5 Spacing, targets, safe areas

- Layout padding `p-3`–`p-4`, gaps `gap-2`–`gap-3`.
- Tap targets: keypad keys fill a `grid-rows-4` cell (~48–56px effective); primary actions
  are visually the tallest element on screen.
- The page sets `viewportFit:'cover'`; consume insets: `pt-[env(safe-area-inset-top)]` on
  the header, `pb-[calc(0.75rem+env(safe-area-inset-bottom))]` on the bottom-most content.

### 2.6 Motion (restrained)

| What | Recipe |
|---|---|
| List row enter/exit | `motion.div layout`, `y:-8 scale:.98 → 0/1`, `exit scale:.98`, `0.25s ease-out` |
| Tap feedback | CSS only: `active:translate-y-px` (buttons/keys) or `active:scale-95` (small icon buttons) — no Framer, for input latency |
| Live clock | plain `setInterval` re-render, not animated |

Keep everything ≤ 0.25s. This is a busy terminal, not a showcase.

### 2.7 Icons

`lucide-react`, `size-5`–`size-8` depending on button size. **On any actionable control an
icon must sit next to a text label**, never alone.

---

## 3. Layout patterns

### 3.1 The frame
Full-screen, flat: `h-dvh overflow-hidden overscroll-none touch-manipulation select-none`,
`bg-slate-100`. A flat white header (`bg-white border-b border-slate-200`, no gradient): a
solid-color icon tile, counter name + caps type/subtitle line, and — where useful — a
**live date/time readout** (`HeaderClock` pattern: mount-guarded `useState<Date|null>` +
1s `setInterval`, right-aligned) instead of decorative status chips.

### 3.2 Two-panel task layout
The core layout for a task-entry terminal: a **task panel** (the thing staff actively do)
beside a **list panel** (recent/queued items).
- **Landscape:** task panel left (`~1.3fr`), list right (`1fr`), single row.
- **Portrait:** task panel top (`~1.55fr`), list below (`1fr`).
- `grid gap-3 p-3`, safe-area bottom padding. This is the same *shape* as v2's `HeroSplit`
  but the task panel is a plain white card, not a colored "hero."

### 3.3 The keypad pattern (reference: bill/ticket entry)
A recessed display field (`bg-slate-50`, `rounded-2xl`, `border-2 border-slate-200`,
emerald focus ring) showing the live value in mono, above a **3-column × 4-row digit grid**
of solid navy keys plus a solid red **Clear** key and a navy backspace key, with a tall
**solid-color primary action** button (icon over a 2-line label) occupying a 4th column
spanning the full grid height. This generalizes beyond bill entry to any "type a value,
then commit" task.

### 3.4 List rows and status
Queued/recent items render as flat white cards (`rounded-2xl border border-slate-200
shadow-sm`) with a solid-tint number tile, primary text + meta line, a semantic status pill
(§2.1), and — for actionable rows — **labeled** buttons stacked or inline (never icon-only).
A "just added" row gets a solid accent-tinted highlight (`bg-emerald-50 border-emerald-300`)
and a small solid badge, not a glow or animation loop.

---

## 4. Component patterns (inline in `OrderCounter.tsx` today)

These aren't yet promoted to `shell.tsx` — Order is still the only v3 route. Extract them to
a shared module (e.g. `components/counter/console.tsx`) the moment a second route adopts
this system, mirroring how v2's kit lives in `shell.tsx`.

| Pattern | Purpose | Key details |
|---|---|---|
| `HeaderClock` | Live date + time in the header | Mount-guarded (`useState<Date\|null>` seeded in `useEffect`) to avoid SSR/hydration mismatch; updates every 1s |
| `KeypadKey` | Digit / muted / danger keys | 3 variants, solid color per §2.1, single color-matched shadow, `active:translate-y-px` |
| Primary CTA button | The one dominant action | Solid color, icon above a (optionally 2-line) label, tallest element in its row, `disabled:opacity-40` |
| `RowCancel` | Labeled two-tap destructive guard | First tap arms (turns solid red, label → "Confirm"), second tap within 3s fires, auto-disarms after 3s — same mis-tap protection as v2's `ConfirmSoftButton`, just restyled flat |

---

## 5. Action rules (read this before adding any button)

- **Primary** = solid color (green for "go/create/confirm"), one per screen, visually the
  largest/tallest control. Label = the outcome (`Generate Ticket`, not `Submit`).
- **Secondary** = white bordered button with icon + label (e.g. `Reprint`). Never icon-only.
- **Destructive** = labeled two-tap guard (`RowCancel` pattern): arms red on first tap,
  shows a clear "Confirm"/"Sure?" word, fires on second tap within 3s.
- **Fixed positions.** The same action lives in the same spot across states.
- Disabled = `disabled:opacity-40`; no separate caption needed unless the *reason* isn't
  obvious from context (e.g. "Queue is paused").

---

## 6. Worker-clarity & declutter checklist

- [ ] Every actionable control has a visible text label.
- [ ] Exactly one dominant primary action is obvious at a glance.
- [ ] No state is signalled by color alone.
- [ ] No two pieces of copy say the same thing (heading vs. subtitle vs. field label).
- [ ] No gradients, gloss overlays, or decorative background blobs — flat surfaces + one
      color-matched shadow only.
- [ ] The frame doesn't scroll; only the list scrolls.
- [ ] Verified at both 893×533 (landscape) and 533×893 (portrait) — nothing overflows.

---

## 7. How to redesign a route with this system

1. **Flat frame first.** `bg-slate-100` canvas, flat white header with a live clock if the
   route benefits from a time reference, no background decoration.
2. **Pick the two-panel shape** (§3.2) if the route is "do a task, see recent/queued
   items." If it's a different shape (e.g. Kitchen's two prep lanes), keep the *foundations*
   (flat surfaces, one shadow, solid action colors, mono numbers) and lay out panels to fit.
3. **Build the task panel** as a plain white card: one heading (not heading + subtitle +
   label), the recessed display field if there's a value being entered, then the primary
   action as the single largest control.
4. **Render the list** as flat cards with status pills and labeled row actions.
5. **Wire actions** to the existing server actions unchanged — this is presentation only.
6. **Run the §6 checklist** before calling it done, especially the "no redundant copy" and
   "no unearned decoration" items — these were the two things client feedback caught last.
7. **Verify** both orientations with headless Chrome
   (`--window-size=893,533` / `--window-size=533,893`, `--force-device-scale-factor=1`) or
   the `run` skill, screenshot, and actually look at the render.

---

## 8. Rollout status

- ✅ **Order** (`OrderCounter.tsx`) — reference implementation for v3. Done, verified both
  orientations, print flow preserved untouched.
- 🟡 **Billing**, **Kitchen** — currently on v2 ("Soft Warm", coral/cream/charcoal). Not yet
  migrated to v3. Open decision: migrate them to match the client's now-preferred direction,
  or leave staff terminals visually mixed until there's a reason to touch them again.
- ⬜ **Delivery** — still on the legacy v1 teal kit (`CounterShell`/`CounterSplit` in
  `shell.tsx`). When tackled, build it in **v3**, not v2 — like Order/Billing's queue +
  action pattern, plus its tap-to-call phone block and "recently delivered" list.
  Preserve untouched.
- ⬜ Extract `HeaderClock` / `KeypadKey` / primary-CTA-button / `RowCancel` out of
  `OrderCounter.tsx` into a shared module once a second route needs them.
- ⬜ Suppress the global `InstallPrompt` on `/counter` routes (it overlays the primary
  action on a kiosk) — flagged since v2, still open.
- ◻️ Decide whether admin/branch/public surfaces ever adopt a console-style language, or
  keep a deliberate split (staff terminals = this system, back-office = neutral/legacy).

---

## 9. Quick reference (copy-paste)

```txt
Canvas ......... bg-slate-100 text-slate-800
Card panel ..... rounded-3xl bg-white border border-slate-200 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)]
Primary CTA .... bg-[#2F9E4A] text-white shadow-[0_6px_16px_-6px_rgba(47,158,74,0.5)] active:bg-[#278A41]
Keypad key ..... bg-[#2E4A79] text-white shadow-[0_4px_10px_-4px_rgba(30,50,90,0.5)] active:bg-[#25406B]
Danger key ..... bg-[#DC4C4C] text-white shadow-[0_4px_10px_-4px_rgba(220,76,76,0.5)] active:bg-[#C63D3D]
Recessed field . bg-slate-50 border-2 border-slate-200 focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-500/10
Number ......... font-mono font-black tabular-nums (display: text-5xl · tile: text-lg)
Caps label ..... text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500
Status pill .... bg-{color}-50 text-{color}-700 border border-{color}-200  (see §2.1 table)
Destructive .... two-tap labeled guard: idle "Cancel" → armed solid red "Confirm" (3s window)
No gradients, no gloss overlays, no background blobs. One flat color + one matching shadow.
```
