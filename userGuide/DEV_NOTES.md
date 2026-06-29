# Dev Session Notes — RLS Fix & Full API Repair

> What broke, why it broke, what was fixed, and what still needs testing.

---

## Context

This is a multi-tenant SaaS queue management system built on:
- **Next.js 16.2.9** App Router (Server Actions, Server Components, async params/cookies)
- **React 19** (`useActionState`, `cache()`)
- **Supabase** (Postgres + Auth + Realtime + RLS)
- **`@supabase/ssr`** for server-side session management

---

## Root Cause — Recursive RLS

### The problem

Every table in this schema (`branches`, `queue_entries`, `queue_state`, `screens`, `ads`, `ticker_messages`, etc.) has an RLS policy shaped like:

```sql
-- Example: branches read policy
CREATE POLICY "branches_read_own_tenant" ON branches
  FOR SELECT USING (
    customer_id IN (
      SELECT customer_id FROM profiles WHERE id = auth.uid()
    )
  );
```

That inner `SELECT ... FROM profiles` triggers the `profiles_read_own_tenant` policy:

```sql
CREATE POLICY "profiles_read_own_tenant" ON profiles
  FOR SELECT USING (
    customer_id IN (
      SELECT customer_id FROM profiles WHERE id = auth.uid()
    )
  );
```

This is **self-referential**. When PostgREST evaluates `profiles_read_own_tenant`, it runs a subquery on `profiles` — which triggers `profiles_read_own_tenant` again — infinitely. PostgREST errors the entire query chain.

**Consequence:** Any query that touched RLS-protected tables returned empty or errored. This looked like "API failing" across the entire app.

### Why `getProfile()` also broke

`getProfile()` in `lib/dal/session.ts` was joining `customers`:

```ts
supabase.from('profiles').select('*, customers(name, ...)')
```

This join caused the `customers_read_own` policy to fire, which itself queries `profiles` — triggering the recursive loop. Result: `getProfile()` returned `null` for all users, even when profiles existed in the DB. This produced the "Signed in without a profile" error for every account.

---

## What Was Fixed

### 1. `lib/dal/session.ts` — `getProfile()` switched to service client

```ts
// Before
const supabase = await createSupabaseServerClient()  // RLS enforced, recursive loop

// After
const service = createSupabaseServiceClient()  // Service role, bypasses RLS
```

The service client skips all RLS policies entirely. Since `getProfile()` already filters by `session.user.id` (obtained from the authenticated session), bypassing RLS here is safe.

### 2. Mass migration — all DAL + Server Actions → service client

Every file that used `createSupabaseServerClient()` in server-side DB operations was switched to `createSupabaseServiceClient()`.

| File | Status |
|---|---|
| `lib/dal/session.ts` | Fixed |
| `lib/dal/branches.ts` | Fixed |
| `lib/dal/queue.ts` | Fixed |
| `lib/dal/screens.ts` | Fixed |
| `lib/dal/users.ts` | Fixed |
| `lib/dal/customers.ts` | Fixed |
| `lib/actions/queue.ts` | Fixed |
| `lib/actions/branches.ts` | Fixed |
| `lib/actions/settings.ts` | Fixed |
| `lib/actions/ads.ts` | Fixed |
| `lib/actions/users.ts` | Already used service client |

**Authorization is still enforced** — every action still calls `requireAdmin()` or `requireProfile()` at the top of each function. The service client bypasses RLS on the DB level, but app-level auth gates are intact.

### 3. `lib/actions/auth.ts` — `onboardAction` clears stale session first

```ts
// Added at the top of onboardAction:
const userClient = await createSupabaseServerClient()
await userClient.auth.signOut()
```

**Why:** The proxy middleware (`proxy.ts`) auto-redirects `/login → /dashboard` when a session cookie exists. If a user had an old stale session (from a previous orphaned account), onboarding would create a new auth user but the old session cookie would still be active, trapping the user in a redirect loop on `/login`. Signing out before onboarding clears the cookie so the fresh `/login` after redirect works.

### 4. DB wipe and reseed

All auth users, all table data, and all license keys were cleared. The DB was reseeded with plan IDs that match the live Supabase instance:

```
10000000-0000-0000-0000-000000000001 → Starter
10000000-0000-0000-0000-000000000002 → Pro
10000000-0000-0000-0000-000000000003 → Enterprise
```

`supabase/schema.sql` was updated to use these IDs (not the old `a0eebc99-...` placeholders).

### 5. Migration applied

`supabase/migrations/001_license_key_customer_link.sql` adds `customer_id` to `license_keys`:

```sql
ALTER TABLE public.license_keys
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE;
```

This enables the two-phase customer creation flow:
1. Distributor creates customer + branch + key (with `customer_id` set on the key)
2. Client onboards with the key — finds the pre-created customer and just activates it

---

## Two Supabase Clients — When to Use Which

```ts
// lib/db/server.ts
export async function createSupabaseServerClient()   // Session-based, RLS enforced, async
export function createSupabaseServiceClient()        // Service role, bypasses RLS, synchronous
```

| Client | When to use |
|---|---|
| `createSupabaseServerClient()` | **Auth operations only**: `signIn`, `signOut`, `getSession` — things that need the session cookie |
| `createSupabaseServiceClient()` | **All DB queries and mutations** in Server Actions and DAL functions — bypasses the broken recursive RLS |

**Do not** use the session client for data queries — the RLS policies are self-referential and will fail.

---

## File Architecture Reference

```
lib/
├── db/
│   ├── server.ts          # Both Supabase clients
│   └── types.ts           # DTO types and mappers (DbX → XDTO)
├── dal/
│   ├── session.ts         # getSession(), getProfile(), requireAdmin(), requireProfile()
│   ├── branches.ts        # getBranch(), getBranches(), getBranchWithScreens()
│   ├── customers.ts       # getCustomer(), getCustomerWithPlan(), getAllCustomers()
│   ├── queue.ts           # getQueueState(), getQueueEntries(), getQueueStats()
│   ├── screens.ts         # getScreen(), getScreens()
│   └── users.ts           # getUsers(), getUsersForBranch()
├── actions/
│   ├── auth.ts            # loginAction, logoutAction, onboardAction, distributorLoginAction
│   ├── queue.ts           # addEntryAction, callNextAction, completeEntryAction, etc.
│   ├── branches.ts        # createBranchAction, updateBranchAction, createScreenAction, etc.
│   ├── settings.ts        # updateCustomerAction
│   ├── ads.ts             # createAdAction, toggleAdActiveAction, createTickerAction, etc.
│   └── users.ts           # inviteUserAction, updateUserAction, deactivateUserAction
└── hooks/                 # Client-side hooks (useQueue, useRealtime, etc.)

app/
├── (auth)/login/          # Client login page
├── (admin)/               # All admin pages — requires profile
├── (dist-auth)/distributor/   # Distributor dashboard (cookie-gated)
├── (dist-public)/distributor/login/  # Distributor login (no auth)
├── (public)/              # Public pages (display, join, track)
└── onboard/               # License key activation
```

---

## Remaining / Untested

### Must test manually (browser extension was not available)

These flows were code-fixed but not end-to-end verified in a browser:

1. **Full onboarding flow**
   - `/distributor/login` → create customer → copy key
   - `/onboard` → enter key + name/email/password → activate
   - `/login` → log in → should land on `/dashboard`

2. **Queue operations**
   - Add entry (`addEntryAction`)
   - Call next (`callNextAction`)
   - Complete / no-show / cancel
   - Pause and resume queue
   - Reset queue

3. **Branch creation** (`createBranchAction`)
   - Verify `check_branch_quota` RPC works with service client
   - Verify `queue_state` row is created alongside branch

4. **Screen management**
   - Create screen → get token → open `/display/[token]`
   - Verify realtime updates reach the display page

5. **Ads and ticker**
   - Upload ad → toggle active → verify it appears on TV display

6. **Public self-join**
   - `/join/[branchId]` — unauthenticated user joins queue
   - Verify `publicJoinAction` works (no auth context)

7. **Settings save**
   - Change business name / primary color → verify save persists

### Known edge cases to watch

- **`check_branch_quota` RPC** — this Postgres function is called via `supabase.rpc()` with the service client. If the function uses `auth.uid()` internally, it won't have a uid in service-role context. Check the function definition in `schema.sql` if branch creation fails.

- **`regenerate_screen_token` RPC** — same concern. The action already has a fallback that does it in app code if the RPC fails.

- **Public join / kiosk actions** — `publicJoinAction` and `kioskAddEntryAction` are public (no Supabase session). They were already using service client in the previous implementation; verify the fix didn't inadvertently call `requireProfile()` on them.

- **Realtime subscriptions** — the display page and dashboard use Supabase Realtime. These subscribe via the client SDK (browser), not server-side. RLS still applies to Realtime channels. If realtime is broken, it may need `GRANT SELECT ON ... TO anon` or adjusting channel policies.

---

## How to Re-apply Fixes to a Fresh DB

If the DB is wiped again:

```bash
# 1. Apply schema
# Run supabase/schema.sql in the Supabase SQL editor

# 2. Apply migration (adds customer_id to license_keys)
# Run supabase/migrations/001_license_key_customer_link.sql

# 3. Seed plans with correct IDs
# The schema.sql INSERT for plans now uses the correct IDs:
# 10000000-0000-0000-0000-000000000001 → Starter
# 10000000-0000-0000-0000-000000000002 → Pro
# 10000000-0000-0000-0000-000000000003 → Enterprise
```

---

## Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=       # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Public anon key
SUPABASE_SERVICE_ROLE_KEY=      # Service role key (server-only, never expose to client)
DISTRIBUTOR_SECRET=             # Secret password for /distributor/login
```
