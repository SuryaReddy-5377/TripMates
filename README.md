# TripMates — Private Family Trip, Expense & Notification Manager

A full-stack, invitation-only application for Indian families to coordinate trips, plan routes and visiting places, split expenses fairly, track notifications, and manage families and accounts with administrative oversight.

Theme, styling, and typography strictly match the editorial standard (**Fraunces** serif headings and **Manrope** sans-serif body, with warm cream `#fbfaf7`, deep navy `#0f172a`, and gold `#f59e0b` accents).

---

## Key Features & Completed Priorities

### 1. Bilingual Language Switching (English & Telugu)
- **Functional Toggle**: Visible English (`EN`) and Telugu (`తెలుగు`) toggle buttons on the landing page hero, login/register forms, and navigation bar.
- **Immediate Translation**: Switching language translates all headings, labels, buttons, validation errors, and empty states immediately without reloading.
- **Persistence**: Selected language persists in `localStorage` (`tripmates_lang`) across page reloads and transitions. Works before authentication and across all authenticated screens.

### 2. Secure Unified Super-Admin Authentication
- **Unified Login**: Removed separate Super Admin Portal button from public view. Super Administrators sign in via the standard login form with their credentials.
- **Server-Verified RBAC**: Backend strictly identifies `role === 'super_admin'` from verified credentials and session tokens; frontend never trusts client-supplied roles.
- **Secure Bootstrap & Credential Updates**:
  ```bash
  # Bootstrap initial admin:
  npx tsx backend/src/cli/setup-admin.ts --email=admin@tripmates.local --password="YourSecurePassword123" --name="System Administrator"

  # Update existing admin credentials safely:
  npx tsx backend/src/cli/setup-admin.ts --update --password="<newPassword>" [--email="<newEmail>"] [--name="<newName>"]
  ```
  Updating admin credentials automatically revokes all prior active sessions. Passwords and secrets are never printed in logs.

### 3. Super-Admin User Management & Financial Safety
- **User Management Tab**: Search registered members across families, view role, family unit, trip count, and account status.
- **Remove User Action**: Clearly visible "Remove User" action with an explanatory confirmation dialog.
- **Financial Record Integrity**:
  - **Deactivation with History Preservation**: If a user has financial history (expenses paid, share allocations, repayments) or created trips, permanently deleting them would damage financial reconciliation and audit logs. The system deactivates their account, revokes sessions, and ends family memberships while preserving financial history intact.
  - **Permanent Deletion**: Permitted only when a user has zero financial records and zero trips.
- **Self-Removal Protection**: The system prevents super-admins from removing their own accounts and prevents removing the last remaining super-admin.
- **Audit Logging**: Every administrative action is recorded with before/after state diffs.

### 4. Family Invite Codes Management
- **Invite Codes Tab**: Dedicated Super Admin section to view, create, and revoke invite codes.
- **Code Customization & Auto-Generation**: Admins can enter a custom uppercase code or generate random secure codes (e.g., `FAM-ABC123`).
- **Target Family & Permissions**: Codes can be associated with a specific family or set to allow creating a new family.
- **Usage Limits & Expiry**: Configurable `max_uses` (default 1) and expiration dates.
- **Concurrency-Safe Registration**: Atomic database transactions prevent usage beyond `max_uses`.
- **Revocation**: Admins can revoke active codes instantly.

### 5. Quick Login
- **Device-Local Memory**: Remembers display name and email of previously signed-in accounts on that specific device (`tripmates_remembered_accounts`).
- **Zero Secret Storage**: Never stores plaintext passwords, session secrets, or tokens in localStorage.
- **Secure Authentication**: Users select their remembered account and must supply their valid password.
- **Account Management**: 1-click removal of remembered accounts and fallback to ordinary email/password login.

### 6. Expense Form & Split Engine
- **No Default ₹3,000**: Expense amount starts empty / ₹0. Users must deliberately enter the amount.
- **Validation**: Requires positive expense amount (`> ₹0`), valid title, and at least one participant before saving.
- **Lovable.app Reference Design**:
  - Editorial typography and card layout.
  - Large ₹ amount input with rupee symbol prefix.
  - Category pill selectors (Food, Transport, Stay, Activities, Shopping, General).
  - Payer selector with avatar and independent participant selection.
  - Split Methods: **Individual Amount + Equal Shared Remainder**, Equal, Per-Head, Custom, Percentage, and Family-wise.
  - Live calculation summary and allocation breakdown showing individual portion, shared remainder, and final amount owed.

### 7. Interactive Maps & Route Planning
- **Route & Visiting Places**: Trip creators and super-admins can add visiting places with GPS coordinates, planned times, and notes.
- **Visual Itinerary**: Numbered markers (Stop 1, Stop 2...) connected by route polyline with automatic bounding box fitting.
- **Route Sequence Editing**: Reorder stops with Move Up / Move Down buttons, and remove stops with confirmation.
- **User-Controlled Offline Preparation**:
  - "Prepare for Offline" button caches the complete itinerary, route coordinates, destination, and stops to `localStorage`.
  - Transparent policy: In compliance with OpenStreetMap Tile Usage Policy, raw tiles are not illegally bulk scraped. Route geometry and full itinerary details are stored locally and accessible offline on mobile devices.
  - Offline fallback view indicates cached itinerary state when internet connectivity is unavailable.

### 8. Mobile Speed & Reliability
- Fully responsive layout for mobile screens (320px+) and desktop viewports.
- Code-splitting with Vite: Leaflet vendor chunk is isolated (`148 kB`), total build takes `< 350ms`.
- Zero paid API dependencies or mandatory map keys.

---

## Local Development & Start Commands

### Requirements
- Node.js 22+ (uses native `node:sqlite`)
- npm 10+

### Starting Backend & Frontend
```bash
# 1. Install dependencies
npm install

# 2. Start Backend API (Port 4000)
npm run dev:backend
# Or: npm run start

# 3. Start Frontend Dev Server (Port 3000)
npm run dev:frontend
```
- **Frontend URL**: `http://localhost:3000`
- **Backend API URL**: `http://localhost:4000` (Vite dev server proxies `/api` to port 4000)

### Running Automated Test Suite
```bash
npm test
```
**Test Results**: **51 passing tests (0 failed, 0 skipped)** covering:
- Financial engine splits (individual remainder, equal, per-head, percentage, itemized food bills, settlements).
- Super-Admin user removal, self-protection, and financial record preservation.
- Family invite codes creation, limits, expiry, and revocation.
- Trip visiting places, reordering, and route permissions.
- In-app notification creation, delivery, and persistence.
- Session management, brute-force rate limiting, and password hashing.

### TypeScript Typecheck & Production Build
```bash
npm run typecheck
npm run build
```
Both complete with **0 errors**.
