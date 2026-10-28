# TripMates — Private Family Trip, Expense & Notification Manager

A full-stack, invitation-only application for Indian families to coordinate trips, itemize food bills, settle expenses fairly, track real-time notifications, and access an administrative dashboard.

Theme, styling, and typography strictly match the editorial standard (**Fraunces** serif headings and **Manrope** sans-serif body, with warm cream `#fbfaf7`, deep navy `#0f172a`, and gold `#f59e0b` accents).

---

## Key Features

### 1. Automatic In-App Notifications
- **Trip Notifications**: When participants or families are added to a trip, users receive real-time notifications with trip name, dates, and organizer.
- **Expense Notifications**: When expenses are added, recipients receive the total bill and their exact assigned share. Unselected participants are shown with ₹0 share and never falsely charged.
- **Repayment Notifications**: Automatic receipts when payments or settlements are recorded.
- **Notification Center**: Bell icon with unread count badge, filter tabs (All, Unread, Expenses, Trips), relative timestamps, "Mark as read", "Mark all as read", and notification preferences.
- **Browser Push Notifications**: Optional opt-in desktop alerts with graceful permission fallback (no paid third-party dependencies required).
- **Idempotency & Isolation**: Every notification is scoped to the user with unique event keys preventing duplicate notifications on retry.

### 2. Separate Super Admin Portal & Protected Dashboard
- **Dedicated Route**: `/admin/login` and `/admin/dashboard` separate from the family member portal.
- **Strict Server-Side Authorization**: Enforced by Express middleware (`requireRole('super_admin')`) and SQLite constraints. Client-side URL tampering or role modification is rejected with HTTP 403.
- **Rate Limiting & Brute-Force Protection**: 5 failed login attempts trigger a 15-minute lockout with `Retry-After` headers.
- **Complete Dashboard**:
  - **Overview**: Real-time metrics calculated strictly from the database (Total families, registered users, active memberships, trip breakdowns, recorded expenses, repayments, and outstanding balances).
  - **Family Management**: Search and filter families, view admins and active memberships, create and edit families.
  - **Member Management**: Search registered members across families, toggle account status (activate/deactivate with immediate session revocation and audit logging).
  - **Trip Management**: Cross-family trip inspector showing itineraries, participant attendance (coming/not coming/pending), expandable itemized dish bills, repayments, and net balance ledgers.
  - **Expense & Settlement Registry**: Searchable expenses across trips, view itemized food breakdown, and void expenses with audit trails.
  - **Cryptographic Audit Log**: Searchable immutable records of all membership, financial, and admin changes with before/after state diffs.

### 3. Financial Engine
- Integer paise arithmetic (1 INR = 100 paise; never floats).
- Itemized food bill splitting (e.g., 3 idly @ ₹50 + 4 puri @ ₹80 = ₹470).
- Mixed mode (family-level + individual accounting without double counting).
- Pro-rata tax, service charge, and discounts.
- Deterministic largest-remainder rounding and settlement suggestions.

---

## Local Development & Setup

### Requirements
- Node.js 22+ (uses native `node:sqlite`)
- npm 10+

### Installation & Starting Dev Server
```bash
# 1. Install dependencies
npm install

# 2. Run database migrations and start server
npm run dev
```
The server will start on `http://localhost:3000`.

### Running Automated Tests
```bash
npm test
```
Runs the full suite of 45 automated tests covering:
- Unit & acceptance tests for the financial engine.
- Role-based authorization & data isolation.
- Automatic trip and expense notification creation & deduplication.
- Notification permissions & user isolation.
- Super Admin dedicated login, rate limiting, and administrative actions.
- Schema constraints & database migration integrity.

### TypeScript Compilation Check
```bash
npm run typecheck
```

### Packaging Clean Source Code
```bash
npm run package
```
Generates `tripmates-source.zip` without temporary files or `node_modules`.

---

## Creating the First Super Admin Account

### Option A: Via Command Line (Recommended)
```bash
npx tsx backend/src/cli/setup-admin.ts --email=admin@tripmates.local --password=YourSecurePassword123 --name="System Administrator"
```

### Option B: Via Web Interface
If no Super Admin exists yet, navigating to `http://localhost:3000` will display the initial setup form. Once configured, future setup attempts are locked permanently.

---

## Testing Trip & Expense Notifications

1. Log in with a user account.
2. In the navigation bar, observe the **Notification Bell** icon with unread count badge.
3. Add a participant to a trip.
4. Log into the added participant's account:
   - Click the bell icon to open the Notification Center.
   - Inspect the notification: `"Added to <Trip Name>"`.
   - Click the notification to navigate directly to the trip.
5. In a trip, add an itemized expense (e.g. Breakfast where only selected participants eat):
   - Selected participants receive a notification displaying their exact assigned share.
   - Unselected participants receive a notification showing ₹0 share.
   - Click "Mark all as read" or the check icon to mark individual notifications as read.
