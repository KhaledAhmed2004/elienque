---
name: reward-cash-out
status: Proposed
---

## Summary

This feature implements the Reward Cash Out and Receipt Verification workflow. Promoters will upload receipts as proof of their campaign participation. Admins will verify these receipts to prevent fraud. Upon approval, the promoter's wallet balance increments. Once the balance reaches a minimum threshold ($50), the promoter can request a cash out. Admins process these cash outs manually (via Zelle, PayPal, or CashApp) and mark them as paid in the system.

## Requirements

- **AC-1**: Promoters must be able to upload a receipt image linked to a specific campaign they participated in.
- **AC-2**: Admins must be able to view all pending receipts, and approve or reject them. If rejecting, they must provide a reason.
- **AC-3**: Upon receipt approval, the system must increment the promoter's `rewardBalance` by the campaign's reward amount.
- **AC-4**: Promoters must be able to view their current `rewardBalance`.
- **AC-5**: Promoters must be able to submit a cash out request once their `rewardBalance` is $50 or more. The request must include their preferred payment method (Zelle, PayPal, or CashApp) and payment identifier (e.g., email or phone number).
- **AC-6**: Promoters can only have one pending cash out request at any given time to prevent spamming.
- **AC-7**: Admins must be able to view pending cash out requests, process the payments manually outside the system, and mark the requests as "Paid" or "Rejected" within the system.
- **AC-8**: Marking a cash out as "Paid" must permanently deduct the requested amount from the promoter's `rewardBalance` and record the transaction.

## Decision

We will implement this feature using the existing backend stack (Node.js, Express, Mongoose, Zod). Two new entities will be introduced: `Receipt` and `CashOutRequest`. The `User` model will be extended to track the promoter's `rewardBalance`.

### Proposed stack
- **Backend**: Node.js, Express
- **Database**: MongoDB (Mongoose)
- **Validation**: Zod
- **Image Storage**: Standard project upload mechanism (e.g. Cloudinary/S3).

### Data model
**Entity: Receipt**
- `_id` (PK)
- `promoterId` (FK to User)
- `campaignId` (FK to Campaign)
- `receiptImageUrl` (String, required)
- `status` (Enum: 'PENDING', 'APPROVED', 'REJECTED' - default 'PENDING')
- `rejectionReason` (String, optional)
- `amountEarned` (Number, set upon approval based on campaign reward)
- `createdAt` / `updatedAt`

**Entity: CashOutRequest**
- `_id` (PK)
- `promoterId` (FK to User)
- `amount` (Number, minimum 50)
- `paymentMethod` (Enum: 'ZELLE', 'PAYPAL', 'CASHAPP')
- `paymentIdentifier` (String)
- `status` (Enum: 'PENDING', 'PAID', 'REJECTED' - default 'PENDING')
- `adminNotes` (String, optional)
- `createdAt` / `updatedAt`

**Entity: User (Updates)**
- `rewardBalance` (Number, default 0, only relevant for Promoters)

### API surface
- `POST /api/v1/receipts`: Upload a receipt (Promoter only).
- `GET /api/v1/receipts`: List receipts (Admin sees all, Promoter sees own).
- `PATCH /api/v1/receipts/:id`: Approve/Reject receipt (Admin only).
- `POST /api/v1/cashouts`: Request cash out (Promoter only).
- `GET /api/v1/cashouts`: List cash outs (Admin sees all, Promoter sees own).
- `PATCH /api/v1/cashouts/:id`: Mark cash out as Paid/Rejected (Admin only).

## Build plan

1. **Schema & Models**: Create the Mongoose schemas and models for `Receipt` and `CashOutRequest`. Update the `User` schema to include `rewardBalance`.
2. **Validation**: Create Zod validation schemas for all new API inputs.
3. **Services (Receipts)**: Implement business logic for creating receipts and admin approval/rejection (including updating the user's balance on approval).
4. **Controllers & Routes (Receipts)**: Expose the receipt endpoints with proper role-based access control.
5. **Services (Cash Outs)**: Implement business logic for creating cash out requests (enforcing the $50 minimum and single-pending rule) and admin resolution (deducting balance on success).
6. **Controllers & Routes (Cash Outs)**: Expose the cash out endpoints with proper role-based access control.
7. **Testing**: Write unit/E2E tests covering the happy paths and edge cases (e.g., trying to cash out with insufficient funds, or multiple pending requests).

## Consequences

- We are introducing a manual payment step. As the platform scales, this manual processing will become a bottleneck and will eventually require automated payouts (e.g., via Stripe Connect).
- Image uploads need to be managed carefully so we do not incur high storage costs for rejected or invalid receipts.

## Follow-up

- Consider implementing an automated payout integration once manual payout volume exceeds administrative capacity.
- Add receipt image cleanup jobs for rejected receipts after a retention period.

## Rationale
We chose a two-step process (upload receipt -> approve -> increment balance, then request cash out -> pay) to decouple the verification of campaign visits from the financial transaction process. This gives admins a buffer to verify fraud without immediately tying up payout logic, and allows promoters to accumulate balance over multiple small campaigns before cashing out.
