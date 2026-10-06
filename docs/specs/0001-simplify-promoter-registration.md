# 0001. Simplify promoter registration

**Date**: 2026-10-05
**Status**: Proposed

## Summary

This specification defines the backend changes required to simplify the promoter registration flow. Legacy fields such as company, service area, and vehicles are removed from the data model and API payload entirely. This reduces friction during signup and aligns the schema with current business requirements.

## Context

The current registration process for promoters requires several legacy fields (company, service area, vehicles) that are no longer needed. This causes unnecessary friction for new promoters trying to sign up and adds validation complexity on the backend. By removing these fields entirely, we simplify the user model and make the onboarding flow much faster. Since we already have existing promoters in the database who may have this data, we will run a migration to clean up the legacy fields so the database remains consistent with the new schema. 

## Requirements

**User stories**:
- As a promoter, I want to register using only my name, email, phone, and password so that I can sign up quickly without providing unnecessary business details.

**Acceptance criteria**:
- **AC-1**: The `User` Mongoose schema no longer contains `serviceArea`, `company`, or `vehicles` fields.
- **AC-2**: The Zod validation schemas for user registration (`createUserValidationSchema`) do not accept or require `serviceArea`, `company`, or `vehicles`.
- **AC-3**: A database migration script is provided to `$unset` these legacy fields from all existing user documents.
- **AC-4**: The `/auth/register` API endpoint successfully registers a promoter with only Name, Email, Phone, and Password, returning the standard response format.

## Options considered

### Option 1: Remove fields strictly (Chosen)

Remove the fields from the schema, validation, and explicitly delete them from the database via a migration script.

**Pros**:
- Keeps the database clean and perfectly aligned with the schema.
- Eliminates technical debt from legacy data.

**Cons**:
- Irreversible data loss for those legacy fields (which the business has confirmed are no longer needed).

### Option 2: Ignore fields but keep in database

Remove from schema and validation, but leave the existing data in MongoDB.

**Pros**:
- Safest approach; no data is lost.
- Zero downtime or migration risk.

**Cons**:
- Database documents carry stale, inaccessible data forever.
- Can cause confusion if a developer inspects raw documents.

## Decision

**Chosen option**: Option 1: Remove fields strictly

We will remove the legacy fields from the Mongoose schema and Zod validation, and run a one-off database migration to `$unset` them from existing documents. 

## Rationale

The business has explicitly confirmed that these fields are legacy and completely unnecessary. Therefore, keeping them in the database provides no value and only adds technical debt. Running a migration to `$unset` them ensures the database is clean and strictly matches our application code. For older clients that might still send this data, since this is considered a "fully new" approach, our strict Zod validation will simply strip or reject the unexpected fields, ensuring only the required four fields are processed.

## Feature design

**Data model sketch**:
- `User` collection (MongoDB):
  - Retained fields: `name`, `email`, `phone`, `password`, `role`, `status`, etc.
  - Removed fields: `company`, `serviceArea`, `vehicles`.

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/v1/auth/register` (or equivalent user creation) | POST | `name`, `email`, `phone`, `password` (req) | standard user response | none | 400 Validation Error |

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Register User | `name` | Client request body |
| Register User | `email` | Client request body |
| Register User | `phone` | Client request body |
| Register User | `password` | Client request body |

**Key invariants**:
- The backend must not save any legacy fields to the database during user creation or update.

**Security model**:
- Role: `PROMOTER`
- Endpoint is public for registration.

**Configuration required**:
- None.

**Critical test scenarios**:
- Happy path: A user registers successfully providing only `name`, `email`, `phone`, and `password`, verifies **AC-4**.
- Failure case: Registration fails if `email` or `password` is missing, verifies **AC-2**.
- Data integrity: The migration script successfully unsets legacy fields without affecting other user data, verifies **AC-3**.

## Build plan

1. Create a database migration script to `$unset` `company`, `serviceArea`, and `vehicles` from the `users` collection, satisfies **AC-3**
2. Remove `company`, `serviceArea`, and `vehicles` from the `IUser` interface and Mongoose schema in `user.model.ts` and `user.interface.ts`, satisfies **AC-1**
3. Update `user.validation.ts` to remove the legacy fields from `createUserValidationSchema` and ensure strict validation strips them, satisfies **AC-2**, **AC-4**
4. Update `user.controller.ts` (if applicable) to remove any mapping logic that handles these legacy fields from multipart/form-data, satisfies **AC-4**

## Consequences

**Positive**:
- Cleaner codebase and database.
- Faster onboarding for promoters.

**Negative / tradeoffs**:
- Permanent loss of legacy business data for existing promoters.

**Neutral**:
- Requires running a database migration script on production.

## Migration plan

**Strategy**: one-off script
**Phases**:
1. Deploy the code changes (schema, validation, controller).
2. Run the MongoDB migration script to `$unset` the legacy fields.
**Rollback**: The code changes can be reverted, but the data deletion is irreversible without a database backup.
**Risks**: Minor risk of locking the users collection if the collection is extremely large, but a simple updateMany operation is typically fast.
