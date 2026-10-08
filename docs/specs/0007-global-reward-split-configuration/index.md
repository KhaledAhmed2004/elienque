# 0007. Global reward split configuration

**Date**: 2026-10-07
**Status**: Accepted

## Summary

This decision defines how the platform stores and manages the global reward split percentages. When a successful referral occurs, the total reward pool is divided between the Promoter, the Referred Customer, and the Platform based on this configuration. We will store this as a single document in a general `Setting` collection to allow for future global settings, and expose a simple API for Admins to manage it.

## Requirements

**User stories**:
- As an Admin, I want to configure the global reward split percentages so that the platform can automatically distribute funds upon successful referrals.
- As a backend system, I need a reliable way to fetch the current reward split to calculate payouts accurately.

**Acceptance criteria**:
- **AC-1**: The system must expose an endpoint for Admins to view the current global reward split.
- **AC-2**: The system must expose an endpoint for Admins to update the global reward split.
- **AC-3**: The update payload must require percentages for Promoter, Referred Customer, and Platform.
- **AC-4**: The sum of the percentages must strictly equal 100%; otherwise, the system rejects the update with a 400 Bad Request.
- **AC-5**: The configuration must be stored persistently and retrieved efficiently.

## Decision

**Chosen option**: Option 1: A general `Setting` collection

We will use a general `Setting` collection to store the configuration under the key `GLOBAL_REWARD_SPLIT`. The value will be a JSON object containing the percentages. Zod schemas will enforce strict type safety and the 100% sum rule before any data touches the database.

## Feature design

**Data model sketch**:
- **Entity**: `Setting`
- **Fields**:
  - `key`: String (required, unique, enum or constant like `'GLOBAL_REWARD_SPLIT'`)
  - `value`: Mixed/JSON (required, structure depends on the key)

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/v1/settings/reward-split` | GET | None | `{ promoter: number, customer: number, platform: number }` | Admin | 404 (if not set) |
| `/api/v1/settings/reward-split` | PUT | `promoter` (number), `customer` (number), `platform` (number) | `{ promoter, customer, platform }` | Admin | 400 (if sum != 100%), 401, 403 |

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| GET `/api/v1/settings/reward-split` | Split percentages | `Setting` collection where `key === 'GLOBAL_REWARD_SPLIT'` |
| PUT `/api/v1/settings/reward-split` | Updated split percentages | Request body `value` |

**Key invariants**:
- The sum of `promoter`, `customer`, and `platform` percentages must exactly equal 100.
- Only one document with the key `GLOBAL_REWARD_SPLIT` can exist in the `Setting` collection.

**Security model**:
- Reading and writing the reward split is strictly restricted to users with the `ADMIN` role.

**Configuration required**:
- None.

**Critical test scenarios**:
- Happy path: Admin updates the split with valid percentages (e.g., 40, 40, 20), verifies AC-2, AC-3.
- Failure case: Admin attempts to update the split with percentages that sum to 90%, system rejects with 400, verifies AC-4.
- Auth/permission: Business Owner or Promoter attempts to update the split, system rejects with 403 Forbidden, verifies AC-2.

## Build plan

1. Create the `Setting` Mongoose schema and interface with a unique `key` and a mixed `value` field, satisfies **AC-5**.
2. Define Zod validation schemas for the reward split payload, including a custom `.refine()` check to ensure the sum equals 100, satisfies **AC-3**, **AC-4**.
3. Implement the `Setting` service, controller, and routes for GET and PUT `/api/v1/settings/reward-split`, satisfies **AC-1**, **AC-2**.
4. Secure the endpoints using the existing authentication and authorization middlewares, restricting access to `ADMIN`, satisfies **AC-1**, **AC-2**.

## Consequences

**Positive**:
- Establishes a scalable pattern for all future global platform configurations.
- Centralizes the reward logic, making future financial calculations predictable.

**Negative / tradeoffs**:
- The `value` field in the database is loosely typed (Mixed), placing the burden of type safety entirely on the application layer (Zod).

**Neutral**:
- Requires seeding a default reward split upon system initialization or handling the "not found" case gracefully when the reward logic is executed.
