# Admin Dashboard: Distributor-Branch-Screen Architecture

> Logic-only documentation. No code. Reusable pattern for SaaS display/kiosk platforms.

---

## Context

This documents the logical architecture of the forex-live-app admin dashboard. The system is a **multi-tenant SaaS** platform where a single operator (Distributor) manages multiple businesses (Customers), each of whom manages physical display screens across multiple locations (Branches). The goal of this doc is to capture the logic so it can be reused as a template for other projects with the same "operator → tenant → branch → device" pattern.

---

## Core Hierarchy

```
Distributor (platform operator)
 └── Plans (subscription tiers)
      └── Customers (tenants / forex businesses)
           ├── Users (admin + staff)
           ├── Branches (physical locations)
           │    └── Screens (individual display devices)
           ├── Ads (media assets — customer-wide or branch-scoped)
           ├── Rates (exchange rates with branch overrides)
           └── Templates (column/display configurations)
```

Every resource in the system traces back to one of these four levels: Distributor, Customer, Branch, or Screen.

---

## Level 1: Distributor

The Distributor is the **platform operator** — not stored as a database user. Authenticated via a shared secret key (environment variable), not email/password. This is intentional: there is only one distributor per deployment.

**What the Distributor owns:**
- Subscription Plans (each plan defines feature gates + limits)
- Customer accounts (creates, activates, deactivates)
- License Keys (one-time redemption tokens for customer onboarding)

**Plan properties that gate features:**
- `max_branches` — how many branches a customer can have
- `storage_mb` — total ad file storage quota
- `allow_live_rates` — whether rates can auto-update from a live feed
- `allow_excel_import` — whether bulk rate import is allowed
- `allow_layout_config` — whether the customer can change screen layouts
- `allow_branch_rate_edit` — whether branch staff can override rates

**Reuse principle:** This level is the "super-admin" or "platform owner" layer. Any SaaS with a B2B2C model needs this. The secret-key auth (no DB user) keeps it simple and prevents accidental exposure.

---

## Level 2: Customer (Tenant)

A Customer is a **business** using the platform. Each customer is isolated (multi-tenant RLS). The Customer is the admin of their own world.

**Customer properties:**
- `name`, `business_name`, `logo_url` — branding displayed on screens
- `primary_color` — hex color used in UI and on TV displays
- `base_currency` — the home currency (e.g., AED)
- `plan_id`, `plan_expires_at`, `is_active` — subscription state
- `branch_ad_mode` — controls how customer-wide vs. branch ads merge: `replace`, `prepend`, or `append`
- `rate_reset_enabled` + `rate_reset_time` — scheduled reset of rates to zero at a set time daily

**What the Customer Admin controls:**
- All branches and screens
- All users (admin + branch staff)
- Customer-wide rates and currencies
- Customer-wide ads, ticker messages, display templates

**Reuse principle:** The Customer level is the "account" or "organization" in typical SaaS. Properties like `branch_ad_mode` and `rate_reset_time` show how tenant-level global defaults should override or compose with lower-level settings.

---

## Level 3: Branches

A Branch is a **physical location** (e.g., "Dubai Marina Office"). Branches belong to one customer. The number of branches is capped by the customer's plan (`max_branches`).

**Branch properties:**
- `name` — display name (e.g., "Main Branch", "Airport Counter")
- `location_note` — optional free text for internal reference
- `branch_token` — auth token used by all screens at this branch to identify which branch they belong to
- `layout` — default layout for all screens in this branch (can be overridden per screen)
- `allow_user_rate_edit` — toggle: can branch-level staff override rates at this branch?
- `is_active` — inactive branches hide from staff assignment

**What branches add:**
- **Rate overrides:** Branches can have different exchange rates than the customer-wide rates. These are stored in `branch_rate_overrides`. The resolution rule is: branch override wins → fall back to customer rate.
- **Ad scoping:** Ads can be uploaded at the branch level (only plays on screens in that branch) vs. customer level (plays everywhere). The `branch_ad_mode` on the customer controls how these two pools merge.
- **Staff assignment:** Each branch user is assigned to one or more specific branches. They can only manage what they're assigned to.

**Reuse principle:** The Branch level is the "location" or "workspace" in other platforms. Key patterns: (1) inheritance of defaults from parent with local override, (2) scoped resource ownership (branch-specific ads), (3) per-branch permissions (rate editing).

---

## Level 4: Screens

A Screen is an **individual TV or display device** at a branch. One branch can have many screens. Each screen is uniquely addressable by its own token.

**Screen properties:**
- `name` — internal label (e.g., "Counter 1", "Lobby Screen")
- `screen_token` — long-lived URL credential; the TV loads `/live?token=XXX`
- `branch_id`, `customer_id` — foreign keys (customer_id is denormalized for RLS efficiency)
- `template_id` — which column configuration to use (null = inherit customer default)
- `orientation` — `landscape` or `portrait`
- `layout` — one of 5 layout types (null = inherit from branch)
- `rates_per_page` — how many currency rows per page before auto-cycling (null = auto-calculate based on screen height)
- `is_active` — can disable without deletion

**Layout types (5 options):**
| Layout | Split | Purpose |
|--------|-------|---------|
| `split-standard` | 64% rates / 36% ads | Default — balanced view |
| `rates-wide` | 75% rates / 25% ads | Emphasize rates |
| `rates-full` | 100% rates | No ads shown |
| `ads-full` | 100% ads | Promotional / lobby screen |
| `portrait` | Top: rates / Bottom: ads | Vertical displays |

**Inheritance chain for each setting:**
- **Layout:** screen override → branch default → `split-standard`
- **Template:** screen override → customer default template → hardcoded defaults (buy/sell/transfer)
- **Ads:** screen-specific ad assignments → branch-level ads + customer-level ads (merged via `branch_ad_mode`) 
- **Rates:** branch override for currency → customer rate for currency

**Reuse principle:** Screens are the "leaf node device" layer. The pattern of cascading inheritance (screen → branch → customer → system default) is the core design rule that makes each level useful without forcing admins to configure everything at the lowest level.

---

## Ads System

Ads are **media assets** (images or videos) shown in the ads panel of a screen.

**Ad scoping (two levels):**
- **Customer-wide:** `branch_id = null` — plays on all branches/screens
- **Branch-specific:** `branch_id = <id>` — plays only on screens in that branch

**Ad merge modes** (set on the customer, `branch_ad_mode`):
- `replace` — branch ads completely replace customer-wide ads for that branch
- `prepend` — branch ads play first, then customer-wide
- `append` — customer-wide play first, then branch ads

**Screen-level override:** Each screen can have a custom ad assignment (`screen_ads` junction table). If a screen has explicit assignments, those override the branch/customer resolution entirely.

**Ad properties:**
- `file_type` — `image` or `video`
- `duration_seconds` — how long an image shows (videos auto-advance on `onEnded`)
- `display_order` — playback sequence
- `is_active` — show/hide without deleting
- `file_size_bytes` — counted against the plan's `storage_mb` quota

**Reuse principle:** This 3-tier scoping (platform default → customer → branch → screen) with a configurable merge mode is a clean, generalizable pattern for any system where content needs to be globally shared but locally customizable.

---

## Rates System

Rates are **exchange rate values** (buy/sell/transfer) per currency.

**Two-tier rate storage:**
- **Customer rates** (`rates` table) — the base rates for all currencies
- **Branch rate overrides** (`branch_rate_overrides` table) — per-branch overrides for specific currencies

**Resolution rule:** When a TV fetches data, for each currency it checks if the branch has an override → use it; otherwise use the customer rate.

**Rate update modes:**
- `manual` — admin or branch user types a value
- `live` — auto-fetched from a live API feed on schedule
- `excel` — bulk imported from `.xlsx` file
- `api` — external system pushes via API

**Who can edit rates:**
- Customer admin: always can edit customer-wide rates
- Branch user: can edit branch overrides only if `branch.allow_user_rate_edit = true`

**Rate history:** Every change is logged immutably (who changed, what source, old/new values). This is a separate insert-only table — never updated.

**Reuse principle:** The two-tier override pattern (customer base → branch override) with an audit log is reusable anywhere you need localized pricing or configuration that can diverge from a shared baseline.

---

## Display Templates (Column Configuration)

Templates define **which columns** appear in the rates table on screen and how they're formatted.

- Built-in columns: `buy`, `sell`, `transfer`
- Custom columns: stored as `extra_values` JSON on each rate row, referenced by key in the template
- Each column has: key, label, color, visible flag, display order

**Template resolution:** screen template → customer default template → hardcoded fallback

Admins can have multiple templates (e.g., "Compact — 2 columns", "Full — 5 columns") and assign different templates to different screens within the same branch.

---

## Users & Permissions

Two roles: `admin` and `branch_user`.

| Capability | Admin | Branch User |
|---|:---:|:---:|
| Manage branches | ✓ | ✗ |
| Manage users | ✓ | ✗ |
| Upload customer-wide ads | ✓ | ✗ |
| Upload branch-specific ads | ✓ | ✓ (own branch) |
| Edit customer rates | ✓ | ✗ |
| Edit branch rate overrides | ✓ | ✓ (if branch allows) |
| Configure screens | ✓ | ✗ |
| View branch reports | ✓ | ✓ (own branch) |

Branch users are assigned to specific branches via a junction table. They can only see and manage what they're assigned to.

---

## TV Display Data Flow (Logic)

When a TV loads `GET /api/tv/data?token=XXX`:

1. Resolve screen from token → get screen_id, branch_id, customer_id
2. Check customer subscription: active? not expired? → else return `status: expired`
3. Fetch all currencies enabled for this customer (ordered by display_order)
4. For each currency: apply branch rate override if exists, else use customer rate
5. Fetch ads: customer-wide + branch-specific, merge by `branch_ad_mode`; if screen has custom assignments, use those instead
6. Resolve template: screen → customer default → hardcode
7. Fetch ticker messages, customer branding (logo, colors)
8. Return complete data packet to TV

**Real-time updates:** All TVs subscribe to a Supabase Realtime channel keyed to the customer. Any rate or content change broadcasts a signal → TVs re-fetch without page reload.

---

## Common Reusable Pattern (Template for Other Projects)

This architecture can be applied to any "operator → tenant → location → device" SaaS:

| This App | Generic Pattern | Example Projects |
|---|---|---|
| Distributor | Platform Operator | SaaS super-admin |
| Plans | Subscription Tiers | Feature gating |
| Customer | Tenant / Account | Restaurant chain, hotel group |
| Branch | Location / Site | Restaurant outlet, hotel property |
| Screen | Device / Terminal | Menu board, kiosk, info display |
| Ads | Media Content | Promotions, announcements |
| Rates | Dynamic Data | Menu prices, inventory, events |
| Template | Display Config | Column/layout configuration |

**Core design rules that make this scalable:**
1. **Cascade inheritance**: every setting resolves from specific → general (screen → branch → customer → system)
2. **Merge modes over hard rules**: let the tenant choose how sub-level content composes with parent content (replace / prepend / append)
3. **Token-based device auth**: devices authenticate with long-lived tokens (not user sessions) — stateless and revocable
4. **Quota enforcement at creation**: check plan limits before creating (branches, storage) not retroactively
5. **Denormalize for RLS**: store `customer_id` on every table for efficient row-level security
6. **Audit log = insert-only**: rate/price history never updates, only inserts
7. **Scoped permissions**: branch staff see only their assigned locations, not all branches of the customer

---

## Files of Record

- [app/admin/AdminSidebar.tsx](app/admin/AdminSidebar.tsx) — admin nav structure
- [app/distributor/](app/distributor/) — distributor dashboard pages
- [app/live/LiveDisplay.tsx](app/live/LiveDisplay.tsx) — TV display logic (layout, ads, rates cycling)
- [app/api/tv/data/route.ts](app/api/tv/data/route.ts) — main TV data fetch
- [app/api/branches/](app/api/branches/) — branch + screen API routes
- [types/database.types.ts](types/database.types.ts) — all table type definitions
- Database RPC `get_tv_data(branch_id)` — core data aggregation (schema.sql)
