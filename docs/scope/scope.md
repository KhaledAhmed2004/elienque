**Build approach:** Tracer Bullet (end-to-end vertical slices)
**Workflow:** Beta

## At a glance

| # | Feature | Phase | Status |
|---|---|---|---|
| 1 | Simplify Promoter Registration | Slice 1 | planned |
| 2 | Business Lead Submission ("Don't see a business you love") | Slice 2 | planned |
| 3 | Admin Lead Approval & Notification | Slice 2 | planned |
| 4 | Admin User Management | Slice 3 | planned |
| 5 | Campaign Management | Slice 3 | in-progress |
| 6 | Auth Database Redesign | Slice 4 | in-progress |
| 7 | Reward Cash Out & Receipt Verification | Slice 5 | done |
| 8 | Admin Managed Business Profiles | Slice 5 | done |
| 9 | Social Media Reward Feed | Slice 6 | in-progress |
| 10 | Global Reward Split Configuration | Foundation | planned |
| 11 | Minimum Spend per Campaign | Slice 7 | in-progress |
| 12 | Referral Verification (QR/Code Scan) | Slice 7 | planned |
| 13 | Reward Split Ledger (Pending Rewards) | Slice 8 | planned |
| 14 | Post-paid Business Invoicing | Slice 9 | planned |
| 15 | Campaign Reward Budget & Exhaustion | Slice 7 | planned |

---

### 1. Simplify Promoter Registration
Make it frictionless for promoters to join the platform by dropping legacy requirements.
**Done when:** Promoters can register with only Full Name, Email, Phone, and Password. Legacy fields (company, service area, vehicles) are removed from the schema and validation.
- [x] Design it ([0001-simplify-promoter-registration.md](docs/specs/0001-simplify-promoter-registration.md))
- [ ] Create a database migration script to `$unset` `company`, `serviceArea`, and `vehicles` from the `users` collection
- [ ] Remove `company`, `serviceArea`, and `vehicles` from the `IUser` interface and Mongoose schema
- [ ] Update `createUserValidationSchema` in `user.validation.ts` to strictly strip legacy fields
- [ ] Remove mapping logic for legacy fields in `user.controller.ts`

### 2. Business Lead Submission ("Don't see a business you love")
Empower promoters to bring in new business leads directly from the app via the "Don't see a business that you love?" section.
**Done when:** Promoters can submit a business lead/suggestion via a new API endpoint. The lead is saved in a pending state for admins to act upon.
- [ ] Design it: /architect 2

### 3. Admin Lead Approval & Notification
Close the loop on lead generation by allowing admins to vet, contact, and onboard suggested leads.
**Done when:** Admins can approve a pending lead. Upon approval, an email notification is sent to the promoter, and they are officially linked to the business.
- [ ] Design it: /architect 3

### 4. Admin User Management
Enable Admins to oversee platform accounts, create other admins, and manage business owners.
**Done when:** Admins can create new admin accounts and edit/manage any user account (including Business Owners) via the API or dashboard.
- [ ] Design it: /architect 4

### 5. Campaign Management
Allow Business Owners (and Admins) to create marketing campaigns with specific rewards and customer offers, and enable Promoters to participate in them. Includes tracking campaign budget limits.
**Done when:** A Campaign entity is created with Title, Reward per Purchase, Customer Offer, and End Date. Admins and Business Owners can create and manage these campaigns. Promoters can view and participate in specific business campaigns.
- [x] Design it ([0003-campaign-management.md](docs/specs/0003-campaign-management.md))
- [x] Create migration for `Campaign` and `CampaignParticipant` tables
- [x] Implement backend CRUD operations for Business Owners and Admins (Create, Edit Draft)
- [x] Implement backend endpoint for Promoters to list Active campaigns
- [x] Implement backend endpoint for Promoters to join an Active campaign and generate a referral code, handling edge cases
- [ ] Implement frontend UI for Business Owners to create/manage campaigns
- [ ] Implement frontend UI for Promoters to view and join campaigns

### 6. Auth Database Redesign
Update and redesign the database schema for the existing Auth and User modules to improve security, maintainability, and simplify the onboarding process.
**Done when:** The auth database schema is redesigned to ask only for necessary data during registration (email, password, business name, phone number) for promoters and business owners. Migrations are created, and existing data is preserved or migrated successfully.
- [x] Design it ([0004](../specs/0004-auth-database-redesign.md))
- [ ] Build it: /develop 6
  - [x] Update Mongoose schema and Zod validation (AC-2, AC-3, AC-4)
  - [x] Refactor auth controller/service payloads and registration logic (AC-1, AC-5)
- [x] Verify it: /check verify 6
- [x] Test it: /test 6
- [x] Review it: /check review 6

### 7. Reward Cash Out & Receipt Verification · GA
Promoters must upload a receipt from their business visit to claim rewards, giving the platform proof to invoice the business. They can cash out once they hit a minimum balance ($50) via Zelle, PayPal, or Cash App.
**Done when:** Users can upload receipt images linked to visits, view balance, and request cash out. Admins can view/approve receipts and process cash-outs.
- [x] Design it ([0005-reward-cash-out.md](docs/specs/0005-reward-cash-out.md))
- [ ] Build it: /develop 7
  - [ ] Schema & Models: Mongoose schemas for `Receipt` and `CashOutRequest`, update `User` schema for `rewardBalance`
  - [ ] Validation: Zod schemas for new API inputs
  - [ ] Services (Receipts): Logic for creating, approving, and rejecting receipts (updating balance)
  - [ ] Controllers & Routes (Receipts): Receipt endpoints with RBAC
  - [ ] Services (Cash Outs): Logic for cash out requests (enforce $50 min, single pending) and admin resolution (deduct balance)
  - [ ] Controllers & Routes (Cash Outs): Cash out endpoints with RBAC
  - [ ] Testing: Unit/E2E tests covering happy paths and edge cases

### 8. Admin Managed Business Profiles
Admins can fully manage business profiles and campaigns on behalf of the business owner, requiring the owner to simply approve the changes.
**Done when:** Admin dashboard allows editing business details/campaigns and triggering an approval notification for the business owner. Owner can one-click approve.
- [ ] Design it: /architect 8

### 9. Social Media Feed
A generic social feed where users can share text and image posts, similar to normal social apps.
**Done when:** Users can create posts with text or images, and scroll through a feed of other users' posts. (Not exclusively tied to rewards or specific events).
- [x] Design it ([0008-social-media-feed.md](docs/specs/0008-social-media-feed.md))
- [x] Build it: /develop 9
  - [x] Create `Post`, `PostLike`, and `Comment` models and interfaces
  - [x] Create Zod validations
  - [x] Implement `PostService` and `PostController` for CRUD and interactions
  - [x] Create routes and register them
- [ ] Verify it: /check verify 9
- [ ] Test it: /test 9

### 10. Global Reward Split Configuration
Admin must configure the exact percentage split (Promoter, Referred Customer, Platform) applied to all reward pools globally.
**Done when:** Admin can set and view the global split percentages. The values total 100%.
- [x] Design it ([0007-global-reward-split-configuration](docs/specs/0007-global-reward-split-configuration/index.md))
- [x] Build it: /develop 10
  - [x] Create the `Setting` Mongoose schema and interface with a unique `key` and a mixed `value` field
  - [x] Define Zod validation schemas for the reward split payload, including a custom `.refine()` check to ensure the sum equals 100
  - [x] Implement the `Setting` service, controller, and routes for GET and PUT `/api/v1/settings/reward-split`
  - [x] Secure the endpoints using the existing authentication and authorization middlewares, restricting access to `ADMIN`
  - [x] code in `src/app/modules/setting/`
- [x] Verify it: /check verify 10

### 11. Minimum Spend per Campaign
Business owners must configure a "Minimum Spend" threshold when creating or updating campaigns to ensure rewards are only paid for qualifying purchases.
**Done when:** Campaign creation and editing require a minimum spend amount. The backend validates and persists this amount.
- [x] Design it ([0003-campaign-management.md](docs/specs/0003-campaign-management/index.md))
- [x] Build it: /develop 11
  - [x] Add `minimumSpend` to `Campaign` schema and interface.
  - [x] Update `Campaign` validation schemas to require `minimumSpend`.
  - [x] Create database migration to set default `minimumSpend` for existing campaigns.
- [ ] Verify it: /check verify 11
- [ ] Test it: /test 11

### 12. Referral Verification (QR/Code Scan)
Businesses need a simple way to confirm that a referred customer visited and spent money.
**Done when:** The app provides a QR code or textual referral code for the Referred Customer. The Business owner can scan/enter this code and input the customer's total spend amount.
- [ ] Design it: /architect 12

### 13. Reward Split Ledger (Pending Rewards)
Upon a successful scan that meets the minimum spend, the system calculates the 3-way split of the campaign reward and credits the respective pending wallets.
**Done when:** A "Pending Reward" record is generated. The exact monetary split is calculated based on the global percentages and distributed conceptually to the Promoter, Customer, and Platform fee ledger.
- [ ] Design it: /architect 13

### 14. Post-paid Business Invoicing
Because businesses pay the reward pool, the platform must invoice them for the rewards accrued by successful referrals.
**Done when:** The platform aggregates pending rewards per business and generates a monthly invoice (or triggers an automatic deduction) for the business to pay.
- [ ] Design it: /architect 14

### 15. Campaign Reward Budget & Exhaustion
Campaigns require a maximum reward budget to control total payouts. When the budget is exhausted, the UI clearly reflects this status to Promoters.
**Done when:** Business owners can set a total reward budget when creating campaigns. Each successful referral deducts from the budget. Promoters can see if a campaign's reward budget is still available or exhausted. (Exact exhaustion handling rules to be determined during design).
- [ ] Design it: /architect 15
