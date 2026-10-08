# 0004. Auth database redesign

**Date**: 2026-10-06
**Status**: Proposed

## Summary

This specification defines the redesign of the authentication and user data models to simplify the onboarding process for both Promoters and Business Owners. We are transitioning to a unified User model where legacy fields are removed and only essential data (email, password, phone, and conditionally business name) is required. This reduces friction during signup and aligns the schema with current business requirements.

## Context

The current registration process for promoters and business owners requires several legacy fields (such as company, service area, vehicles) that are no longer needed. This causes unnecessary friction for new users trying to sign up and adds validation complexity on the backend. By simplifying the user model, we make the onboarding flow much faster and more focused on the platform's core actors. Since we already have existing users in the database who may have this data, we will run a migration to clean up the legacy fields in our validation logic so the database remains consistent without breaking existing records.

## Requirements

**User stories**:
- As a promoter, I want to register using only my email, phone, and password so that I can sign up quickly.
- As a business owner, I want to register using my email, phone, password, and business name to quickly start creating campaigns.

**Acceptance criteria**:
- **AC-1**: Both Business Owners and Promoters register via a unified `/auth/register` API endpoint.
- **AC-2**: Business Owners must provide Email, Password, Phone Number, and Business Name.
- **AC-3**: Promoters must provide Email, Password, and Phone Number (Business Name is optional/omitted).
- **AC-4**: Existing legacy fields (vehicles, service area, etc.) are removed from the Mongoose schema and validation logic (existing data remains in the DB).
- **AC-5**: The existing email OTP verification flow is maintained with the new simplified payload.

## Options considered

### Option 1: Unified User collection with conditional fields

Maintain a single `User` collection and add `businessName` directly. Make `businessName` required only when the role is `BUSINESS_OWNER`.
**Pros**:
- Simple to implement and query.
- Preserves existing authentication and role-based access logic.
**Cons**:
- Sparse data (Promoters will have an empty or null `businessName`).

### Option 2: Split into separate role-specific collections

Create separate `Promoter` and `BusinessOwner` collections that reference a base `User` auth document.
**Pros**:
- Strictly typed schemas per role without sparse fields.
**Cons**:
- Requires complex joins (populates) for basic user queries and significantly complicates the migration path.

## Decision

**Chosen option**: Option 1: Unified User collection with conditional fields

We will keep a single unified `User` collection and add `businessName` as a conditionally required field for Business Owners.

## Rationale

A unified collection with conditional validation provides the simplest migration path from the current setup. Splitting the collections (Option 2) would require rewriting significant portions of the auth and user services, introducing high regression risk for little practical benefit at this scale. By keeping the schema flat and enforcing requirements via Zod validation, we achieve the frictionless signup goal while maintaining operational simplicity.

## Feature design

**Data model sketch**:
**Entity: User**
- `_id`: ObjectId (PK)
- `email`: String (Unique, Required)
- `password`: String (Hashed, Required, select: false)
- `phone`: String (Required)
- `role`: Enum [PROMOTER, BUSINESS_OWNER, ADMIN] (Required)
- `businessName`: String (Required if role === BUSINESS_OWNER, otherwise Optional)
- `isVerified`: Boolean (Default: false)
- `authentication`: Object (For OTP tracking, select: false)

*(Note: Legacy fields like company, vehicles, serviceArea will be explicitly omitted from schema validation but remain in the database for older records)*

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/auth/register` | POST | email, password, phone, role, businessName (if applicable) | User ID, verification prompt | None | 400 (validation), 409 (conflict) |
| `/auth/verify-email` | POST | email, otp | success message | None | 400, 401 |
| `/auth/resend-otp` | POST | email | success message | None | 400, 404 |
| `/auth/login` | POST | email, password | JWT tokens, User object | None | 401 |

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Registration | User role | Client input payload |
| Registration | Business Name requirement | Derived from role input |
| Registration | isVerified status | Defaulted to false in DB schema |

**Key invariants**:
- A `BUSINESS_OWNER` must always have a valid `businessName` provided at registration.
- Legacy fields are never required for new signups.

**Security model**:
- Registration endpoints are public. Passwords must be hashed via bcrypt before storage. OTPs must be validated securely.

**Configuration required**:
- None (existing SMTP/OTP configs remain unchanged).

**Critical test scenarios**:
- Happy path: A Promoter registers successfully with email, password, and phone only (verifies **AC-1**, **AC-3**).
- Happy path: A Business Owner registers successfully with email, password, phone, and businessName (verifies **AC-1**, **AC-2**).
- Failure case: A Business Owner attempts to register without a businessName and receives a 400 error (verifies **AC-2**).
- Failure case: Registration with legacy fields ignores the legacy fields (verifies **AC-4**).

## Build plan

1. Update `User` Mongoose schema to include `businessName` and remove legacy fields (`company`, `vehicles`, `serviceArea`), satisfies **AC-4**.
2. Update `user.validation.ts` Zod schemas to enforce `businessName` conditionally based on the `BUSINESS_OWNER` role, and strip legacy fields, satisfies **AC-2**, **AC-3**, **AC-4**.
3. Update `auth.controller.ts` and `auth.service.ts` to accept the simplified payload for `/auth/register` while maintaining the OTP verification flow, satisfies **AC-1**, **AC-5**.
4. Run integration tests to ensure registration works for both roles and legacy users are unaffected, satisfies **AC-1**, **AC-2**, **AC-3**.

## Consequences

**Positive**:
- Significantly faster onboarding for users.
- Cleaner validation logic and reduced payload size.

**Negative / tradeoffs**:
- Sparse fields in the database (Promoters will lack `businessName`).

**Neutral**:
- Existing users with legacy fields will retain them in the DB, but they will not be exposed or validated by the application layer going forward.

## Follow-up

- [ ] Ensure frontend clients are updated to remove legacy fields from their registration forms.
