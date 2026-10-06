**Build approach:** Tracer Bullet (end-to-end vertical slices)
**Workflow:** Alpha

## At a glance

| # | Feature | Phase | Status |
|---|---|---|---|
| 1 | Simplify Promoter Registration | Slice 1 | planned |
| 2 | Business Lead Submission | Slice 2 | planned |
| 3 | Admin Lead Approval & Notification | Slice 2 | planned |
| 4 | Admin User Management | Slice 3 | planned |
| 5 | Campaign Management | Slice 3 | in-progress |

---

### 1. Simplify Promoter Registration
Make it frictionless for promoters to join the platform by dropping legacy requirements.
**Done when:** Promoters can register with only Full Name, Email, Phone, and Password. Legacy fields (company, service area, vehicles) are removed from the schema and validation.
- [x] Design it ([0001-simplify-promoter-registration.md](docs/specs/0001-simplify-promoter-registration.md))
- [ ] Create a database migration script to `$unset` `company`, `serviceArea`, and `vehicles` from the `users` collection
- [ ] Remove `company`, `serviceArea`, and `vehicles` from the `IUser` interface and Mongoose schema
- [ ] Update `createUserValidationSchema` in `user.validation.ts` to strictly strip legacy fields
- [ ] Remove mapping logic for legacy fields in `user.controller.ts`

### 2. Business Lead Submission
Empower promoters to bring in new business leads directly from the app.
**Done when:** Promoters can submit a business lead via a new API endpoint. The lead is saved in a pending state.
- [ ] Design it (spec)

### 3. Admin Lead Approval & Notification
Close the loop on lead generation by allowing admins to vet and approve leads.
**Done when:** Admins can approve a pending lead. Upon approval, an email notification is sent to the promoter, and they are officially linked to the business.
- [ ] Design it (spec)

### 4. Admin User Management
Enable Admins to oversee platform accounts, create other admins, and manage business owners.
**Done when:** Admins can create new admin accounts and edit/manage any user account (including Business Owners) via the API or dashboard.
- [ ] Design it (spec)

### 5. Campaign Management
Allow Business Owners (and Admins) to create marketing campaigns with specific rewards and customer offers, and enable Promoters to participate in them.
**Done when:** A Campaign entity is created with Title, Reward per Purchase, Customer Offer, and End Date. Admins and Business Owners can create and manage these campaigns. Promoters can view and participate in specific business campaigns.
- [x] Design it ([0003-campaign-management.md](docs/specs/0003-campaign-management.md))
- [x] Create migration for `Campaign` and `CampaignParticipant` tables
- [x] Implement backend CRUD operations for Business Owners and Admins (Create, Edit Draft)
- [x] Implement backend endpoint for Promoters to list Active campaigns
- [x] Implement backend endpoint for Promoters to join an Active campaign and generate a referral code, handling edge cases
- [ ] Implement frontend UI for Business Owners to create/manage campaigns
- [ ] Implement frontend UI for Promoters to view and join campaigns
