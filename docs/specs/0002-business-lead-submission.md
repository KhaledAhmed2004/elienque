# 0002. Business Lead Submission API

**Date**: 2026-10-06
**Status**: Accepted

## Summary

This decision establishes a data model and API endpoint to empower promoters to submit new business leads directly from the app. A standard set of contact details is required to vet leads properly, and the system enforces uniqueness on phone and email to prevent duplicate submissions. This ensures a clean pipeline for administrators to review and approve new business acquisitions.

## Context

Promoters need a way to bring in new business leads directly, expanding the platform's reach. Currently, there is no structured way for them to submit or track these leads within the application. If left unaddressed, lead generation remains manual and untracked, limiting scalability and creating overhead in de-duplicating efforts. This feature focuses on capturing the initial lead details securely and reliably while preventing spam.

## Requirements

**User stories**:
- As a promoter, I want to submit a business lead so that the platform can review and onboard new businesses.

**Acceptance criteria**:
- **AC-1**: Promoter submits a business lead containing Business Name, Owner Name, Phone, Email, and Address.
- **AC-2**: System rejects submissions with a 409 Conflict if a lead with the exact same Phone or Email already exists.
- **AC-3**: The endpoint is accessible only to users with the `PROMOTER` role.
- **AC-4**: A successfully submitted lead is stored with a default status of `PENDING`.

## Options considered

### Option 1: Dedicated BusinessLead Collection (Recommended)

Create a new `BusinessLead` Mongoose model separate from the main `User` or `Business` models, tied to the promoter via `promoterId`.

**Pros**:
- Keeps lead data cleanly separated from active system users or businesses.
- Easy to manage the lifecycle (PENDING → APPROVED/REJECTED) without polluting core collections.

**Cons**:
- Requires a separate migration/creation step if a lead is later approved and converted into an actual business entity.

### Option 2: Store leads in the User/Business collection with a pending flag

Insert the lead directly into the final collection but mark it inactive.

**Pros**:
- No migration step needed upon approval; just flip a boolean.

**Cons**:
- Pollutes core operational tables with unvetted data, increasing the risk of accidental exposure or validation bypasses.

## Decision

**Chosen option**: Option 1: Dedicated BusinessLead Collection

We will implement a dedicated API endpoint (`POST /leads`) and a separate `BusinessLead` collection to capture and track new leads securely.

## Rationale

Using a dedicated collection (Option 1) prevents unvetted data from polluting the core operational collections. It provides a clean boundary for administrators to review submissions without risking accidental exposure of incomplete or spam records. The uniqueness constraints on email and phone protect the system from duplicate efforts.

## Feature design

**Data model sketch**:
- Entity: `BusinessLead`
- `businessName`: String, required
- `ownerName`: String, required
- `phone`: String, required, unique constraint
- `email`: String, required, unique constraint
- `address`: String, required
- `promoterId`: ObjectId (ref to User), required
- `status`: Enum (`PENDING`, `APPROVED`, `REJECTED`), required, default `PENDING`
- `timestamps`: createdAt, updatedAt

**State transitions**:
- PENDING → APPROVED
- PENDING → REJECTED

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/leads` | POST | `businessName`:String (req), `ownerName`:String (req), `phone`:String (req), `email`:String (req), `address`:String (req) | id, status | PROMOTER | 409 conflict, 400 bad request |

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Submit Lead | `status` | Hardcoded default to `PENDING` |
| Submit Lead | `promoterId` | Extracted from the authenticated user token |
| Submit Lead | `businessName`, `ownerName`, `phone`, `email`, `address` | Request body |

**Key invariants**:
- A lead's `phone` must be unique across all leads.
- A lead's `email` must be unique across all leads.
- Only a user with the `PROMOTER` role can create a lead.

**Security model**:
- Creation: Restricted to the `PROMOTER` role.
- Data ownership: Promoters own the leads they create. Admins have global read/write access.

**Configuration required**:
- None

**Critical test scenarios**:
- Happy path: A promoter successfully submits a lead with all valid fields, returning 201 Created. verifies **AC-1**, **AC-4**
- Failure case: A promoter submits a lead with a phone number that already exists, returning 409 Conflict. verifies **AC-2**
- Auth/permission: A user with `USER` role attempts to submit a lead and receives 403 Forbidden. verifies **AC-3**

## Build plan

1. Define the `BusinessLead` Mongoose schema and interface, enforcing unique indexes on `phone` and `email` and defaulting `status` to `PENDING`, satisfies **AC-1**, **AC-2**, **AC-4**
2. Add Zod validation schemas for the lead creation payload, enforcing required contact fields, satisfies **AC-1**
3. Create the `POST /leads` route and controller, protecting it with `auth(USER_ROLE.PROMOTER)`, satisfies **AC-3**
4. Implement the service logic to create the lead document, mapping `promoterId` from the authenticated user, satisfies **AC-1**, **AC-4**

## Consequences

**Positive**:
- Promoters gain an official, tracked mechanism to contribute to business growth.
- System stays clean from duplicates via strict DB-level constraints.

**Negative / tradeoffs**:
- A separate process is needed later to convert an `APPROVED` lead into an actual `Business` and `User` account.

**Neutral**:
- Introduces a new `lead` module/entity into the domain.

## Follow-up

- [ ] Design the Admin approval workflow to convert a `BusinessLead` into an actual Business entity.
