# 0006: Admin Managed Business Profiles

**Status**: Proposed
**Code area**: Backend (API)

## Context
- **Mode**: Feature
- **Stack**: Node.js, Express, Mongoose
- **Summary**: Admins can manage business profiles and campaigns on behalf of the business owner. Instead of direct mutation, edits are captured as a "Draft". The owner receives a notification and must explicitly approve or reject the draft before changes are applied.

## Requirements

- **AC-1**: Admins can create a draft containing proposed edits for a Business Profile or Campaign.
- **AC-2**: Creating a draft triggers a notification to the Business Owner.
- **AC-3**: Business Owners can view their pending drafts.
- **AC-4**: Business Owners can approve a draft. Approval applies the changes to the target entity (Profile or Campaign) and marks the draft as `APPROVED`.
- **AC-5**: Business Owners can reject a draft. Rejection marks the draft as `REJECTED` and discards the changes. Owners can optionally provide a `rejectionReason`.
- **AC-6**: Only one `PENDING` draft is allowed per target entity at a time to prevent conflicts.
- **AC-7**: Admins can update or withdraw a pending draft they created.

## Build plan

### 1. Data Model: `Draft` Collection
Create a new Mongoose schema/model for Drafts.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `targetType` | Enum | Yes | `'BUSINESS_PROFILE'` or `'CAMPAIGN'` |
| `targetId` | ObjectId | Yes | Reference to the User (Business) or Campaign |
| `adminId` | ObjectId | Yes | Reference to the Admin User who created the draft |
| `ownerId` | ObjectId | Yes | Reference to the Business Owner User |
| `changes` | Object/JSON | Yes | The proposed edits (e.g., `{ name: 'New Name' }`) |
| `status` | Enum | Yes | `'PENDING'`, `'APPROVED'`, `'REJECTED'`, `'WITHDRAWN'` (Default: `PENDING`) |
| `rejectionReason`| String | No | Optional reason provided by owner on rejection |
| `createdAt` | Date | - | Managed by Mongoose timestamps |
| `updatedAt` | Date | - | Managed by Mongoose timestamps |

**Index / Constraints:**
- A compound unique index on `{ targetId: 1, status: 1 }` where `status` is `'PENDING'` (Sparse/Partial index if supported, or handled via application logic during creation) to enforce AC-6.

### 2. API Surface

#### Admin Endpoints
- `POST /api/v1/admin/drafts`
  - **Auth**: Admin only
  - **Inputs**: `targetType`, `targetId`, `changes`
  - **Action**: Verifies no existing pending draft for `targetId`. Creates draft. Sends notification to `ownerId`.
- `PATCH /api/v1/admin/drafts/:id`
  - **Auth**: Admin only
  - **Inputs**: `changes`
  - **Action**: Updates an existing pending draft.
- `DELETE /api/v1/admin/drafts/:id`
  - **Auth**: Admin only
  - **Action**: Marks the draft as `WITHDRAWN`.

#### Business Owner Endpoints
- `GET /api/v1/drafts`
  - **Auth**: Business Owner
  - **Query**: `status` (optional filter)
  - **Action**: Returns drafts where `ownerId` matches the authenticated user.
- `PATCH /api/v1/drafts/:id/approve`
  - **Auth**: Business Owner
  - **Action**: Asserts draft is `PENDING` and belongs to the owner. Applies `changes` to the actual Campaign or User document. Updates draft status to `APPROVED`.
- `PATCH /api/v1/drafts/:id/reject`
  - **Auth**: Business Owner
  - **Inputs**: `reason` (optional)
  - **Action**: Asserts draft is `PENDING` and belongs to the owner. Updates draft status to `REJECTED` and stores `rejectionReason`.

## Value Sourcing
- `targetType`: Provided by admin client.
- `targetId`: Provided by admin client.
- `ownerId`: Looked up backend-side based on the `targetId` (if `targetType` is `CAMPAIGN`, lookup the campaign to find `businessId`/`ownerId`).
- `changes`: Provided by admin client.

## Edge Cases Handled
- **Concurrent Edits**: AC-6 prevents multiple pending drafts for the same resource.
- **Lost context**: Draft tracks both the admin who created it and the owner who must approve it.
