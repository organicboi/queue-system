# Queue System — End-to-End User Guide

> Complete walkthrough from Distributor setup to a Client managing a live queue on their dashboard.

---

## System Overview

```
Distributor (platform operator)
 └── Plans (Starter / Pro / Enterprise)
      └── Customers (businesses you onboard)
           ├── Admin Users (customer's login)
           ├── Branches (physical locations)
           │    ├── Screens (TV displays in that branch)
           │    └── Queue (the live queue for that branch)
           └── Ads & Ticker messages
```

The flow is always top-down:

1. **Distributor** creates a customer record + generates a license key
2. **Client** visits `/onboard`, enters the key, creates their admin account
3. **Client admin** logs in and manages branches, queues, screens, users

---

## Part 1 — Distributor

### 1.1 Log In

- URL: `/distributor/login`
- Enter the distributor secret (set in the server environment as `DISTRIBUTOR_SECRET`)
- This creates a 7-day session cookie (`dist_session`)
- You are redirected to `/distributor` (the distributor dashboard)

### 1.2 View Plans

Navigate to `/distributor/keys` to see all available subscription plans:

| Plan | Description |
|---|---|
| Starter | Limited branches and screens |
| Pro | More branches, more screens |
| Enterprise | Unlimited / highest limits |

Plans define these limits:
- `max_branches` — how many branches the customer can create
- `max_screens_per_branch` — how many TV screens per branch
- Storage quota, live-rate access, Excel import, etc.

### 1.3 Create a Customer

Navigate to `/distributor/customers` → click **"Add Customer"**.

Fill in:
| Field | Description |
|---|---|
| Business Name | The company name shown in the customer's dashboard |
| Plan | Which subscription tier |
| Contact Email | For reference only (not used for auth) |
| Contact Name | The business owner's name |

What happens in the database:
- A `customers` row is created with `is_active = true`
- A `Main Branch` branch is created for this customer
- A `queue_state` row is created for that branch
- A `license_keys` row is generated, linked to this customer via `customer_id`

### 1.4 Copy the License Key

After creating the customer, the generated license key appears on screen. **Copy it and send it to the client.** The key is single-use and expires based on plan settings.

You can view all keys at `/distributor/keys`.

---

## Part 2 — Client Onboarding

### 2.1 Activate Account

- URL: `/onboard`
- The client enters:
  | Field | Required | Notes |
  |---|---|---|
  | License Key | Yes | Provided by distributor |
  | Your Name | Yes | Stored in their profile |
  | Email | Yes | Used for login |
  | Password | Yes | Minimum 8 characters |
  | Business Name | Only if standalone key | Pre-created customer keys don't need this |

What happens:
1. License key is validated (not used, not expired)
2. If the key has a `customer_id` (distributor pre-created): the existing customer record is activated
3. A Supabase Auth user is created with `email_confirm: true` (no email verification needed)
4. A `profiles` row is created with `role = 'admin'`
5. License key is marked as used
6. Client is redirected to `/login`

> **Note:** If the client sees "License key already used", the key was either already activated or something went wrong. Contact the distributor for a new key.

### 2.2 Log In

- URL: `/login`
- Enter the email and password created during onboarding
- On success: redirected to `/dashboard`

---

## Part 3 — Admin Dashboard

### 3.1 Dashboard (`/dashboard`)

Shows a real-time overview:
- Total customers in queue today across all branches
- Currently serving / waiting / completed / cancelled counts
- Branch-by-branch status cards
- Recent activity feed

### 3.2 Queue Management (`/queue-management`)

The live queue operator view. From here staff can:
- **Add Customer** — manually add someone to the queue (name, phone optional)
- **Call Next** — calls the next waiting customer
- **Call Specific** — calls a specific queue number
- **Mark Complete / No Show / Cancel** — close out an entry
- **Pause / Resume Queue** — temporary holds
- **Reset Queue** — clears all entries for the day (use with caution)

Queue entries have these states: `waiting → serving → completed / no_show / cancelled`

### 3.3 Branches (`/branches`)

Lists all branches for this customer. From here:
- **Create Branch** — name, optional location note
- Click a branch to open its detail page

#### Branch Detail (`/branches/[branchId]`)

Sub-sections:
- **Overview** — queue stats for this branch
- **Settings** (`/branches/[branchId]/settings`) — queue label, self-join toggle, max capacity, average service time, sound alerts, printer settings
- **Screens** (`/branches/[branchId]/screens`) — manage TV displays
- **Ads** (`/branches/[branchId]/ads`) — upload and manage ads + ticker messages

### 3.4 Screens

Each branch can have multiple screens (limit set by plan).

To add a screen:
1. Go to `/branches/[branchId]/screens`
2. Click **"Add Screen"**
3. Name it (e.g. "Lobby TV", "Counter Screen")
4. Set orientation (landscape / portrait)

Each screen has a unique **screen token** — the URL to load on the TV is:

```
/display/[token]
```

Open that URL in a browser on the TV and it will show the live queue display. The token can be regenerated at any time (old URL stops working immediately).

**Display layouts:**
| Layout | Split | Use |
|---|---|---|
| split-standard | 64% queue / 36% ads | Default balanced |
| rates-wide | 75% queue / 25% ads | Emphasize queue numbers |
| rates-full | 100% queue | No ads |
| ads-full | 100% ads | Lobby/promo screen |
| portrait | Top: queue / Bottom: ads | Vertical TV |

### 3.5 Ads & Ticker (`/branches/[branchId]/ads`)

**Ads** — images or videos that play in the ads panel on TV screens.
- Supported: image (JPG, PNG, GIF) and video (MP4)
- Set duration in seconds for images (videos auto-advance)
- Toggle active/inactive without deleting
- Drag to reorder

**Ticker Messages** — scrolling text at the bottom of the TV display.
- Add any plain text message
- Toggle active/inactive
- Multiple messages cycle through

### 3.6 Add Customer to Queue (`/add-customer`)

Staff-facing page to manually add walk-in customers. Fields:
- Name (optional)
- Phone (optional)
- Branch (select which branch)

The customer gets a queue number and can track their position at `/track/[queueId]`.

### 3.7 Public Self-Join (`/join/[branchId]`)

If `allow_self_join` is enabled on a branch, customers can scan a QR code and add themselves:
- URL: `/join/[branchId]`
- Enter name (optional) and phone (optional)
- Receive their queue number
- Link to track status at `/track/[queueId]`

### 3.8 Analytics (`/analytics`)

Historical view of queue performance:
- Customers served per day
- Average wait times
- Peak hours
- Branch comparison

### 3.9 Users (`/users`)

Manage who has access to the dashboard:

| Role | Capabilities |
|---|---|
| admin | Full access to all features |
| branch_user | Can operate queue for assigned branches only |

To add a user:
1. Go to `/users` → **"Invite User"**
2. Enter their email, name, role
3. Assign them to one or more branches (branch_user role only)

> Users receive an invitation email and set their own password.

### 3.10 Settings (`/settings`)

Customer-level settings:
- **Business Name** — shown in the dashboard header
- **Logo URL** — appears on TV displays
- **Primary Color** — brand color used across the UI and TV screens
- **Contact Details** — email, phone, address (internal reference)

---

## Part 4 — TV Display

### 4.1 Opening the Display

On the TV / large screen device:
1. Open a browser (Chrome recommended, fullscreen mode)
2. Navigate to: `https://your-domain.com/display/[screen-token]`
3. The screen auto-updates in real time via Supabase Realtime — no refresh needed

### 4.2 What's Shown

- **Now Serving** — the currently called queue number (large, prominent)
- **Queue List** — next few waiting numbers
- **Ads Panel** — cycling images or videos
- **Ticker** — scrolling text at the bottom
- **Clock** — current time (optional, toggleable per screen)

### 4.3 Display Themes

Each screen can use one of four visual themes:
| Theme | Style |
|---|---|
| standard | Light background, clean |
| dark | Dark background, high contrast |
| vibrant | Bold colors |
| minimal | Minimal UI, maximum data |

---

## Part 5 — Public Queue Tracking

Customers who receive a queue entry can track their position:

- URL: `/track/[queueId]`
- Shows current position, estimated wait time, status
- Auto-updates in real time

---

## Quick Reference

| Who | Action | URL |
|---|---|---|
| Distributor | Log in | `/distributor/login` |
| Distributor | Dashboard | `/distributor` |
| Distributor | Manage customers | `/distributor/customers` |
| Distributor | View license keys | `/distributor/keys` |
| Client | Activate account | `/onboard` |
| Client | Log in | `/login` |
| Admin | Dashboard | `/dashboard` |
| Admin | Queue operations | `/queue-management` |
| Admin | Add customer to queue | `/add-customer` |
| Admin | Manage branches | `/branches` |
| Admin | Branch settings | `/branches/[id]/settings` |
| Admin | Manage screens | `/branches/[id]/screens` |
| Admin | Manage ads & ticker | `/branches/[id]/ads` |
| Admin | Manage users | `/users` |
| Admin | Business settings | `/settings` |
| Admin | Analytics | `/analytics` |
| Staff | Self-join page | `/join/[branchId]` |
| Customer | Track queue status | `/track/[queueId]` |
| TV | Live display | `/display/[screen-token]` |
