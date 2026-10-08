# 0003. Campaign Management Feature

**Date**: 2026-10-06
**Status**: Proposed

## Summary

This spec outlines the Campaign Management feature, allowing Business Owners and Admins to create and manage campaigns. Promoters can view active campaigns and join them to receive unique referral codes. This expands the platform's core offering by driving promoter-led marketing without upfront budget caps, simplifying the initial rollout.

## Context

The platform needs a way for businesses to incentivize promoters to drive traffic or sales. Currently, there is no structured way for Business Owners to define offers and rewards, or for Promoters to easily opt-in and receive tracking codes. The decision is to build a simplified campaign lifecycle (Draft -> Active -> Expired) without budget caps initially to reduce complexity and speed up time to market, while still providing the core functionality needed for promoter engagement.

## Requirements

**User stories**:
- As a Business Owner, I want to create and edit draft campaigns so that I can prepare offers for promoters.
- As an Admin, I want to manage campaigns across the platform so that I can provide support and oversight.
- As a Promoter, I want to view active campaigns and join them so that I can get a unique code to share and earn rewards.

**Acceptance criteria**:
- **AC-1**: Business Owners can create a campaign with Title, Reward, Offer, Start Date, End Date, and Minimum Spend, defaulting to 'Draft' status.
- **AC-2**: Business Owners can edit a campaign only if it is in 'Draft' status.
- **AC-3**: Promoters can view a list of 'Active' campaigns (Start Date <= Now < End Date).
- **AC-4**: Promoters can join an 'Active' campaign and receive a unique referral code.
- **AC-5**: Joining a 'Draft' or 'Expired' campaign returns an error.
- **AC-6**: Campaigns automatically expire when the current date passes the End Date.

## Decision

**Chosen option**: Option 1: Implement Campaign and CampaignParticipant data models with a simplified lifecycle (Draft/Active).

Implement the core Campaign entity and a one-to-many relationship to CampaignParticipant for tracking promoter joins. We will use a time-based active/expired state rather than explicit status toggles for expiration, keeping the data model simple.

## Rationale

This approach provides the necessary functionality for businesses to run campaigns while minimizing implementation complexity. By deferring budget caps and explicit "Cancel" actions, we can ship the feature faster and validate the core promoter workflow. The time-based expiration is reliable and requires less manual intervention from Business Owners.

## Feature design

**Data model sketch**:
- `Campaign`:
  - `id` (UUID, PK)
  - `businessId` (UUID, FK to Business)
  - `title` (String, Required)
  - `reward` (String, Required)
  - `offer` (String, Required)
  - `startDate` (DateTime, Required)
  - `endDate` (DateTime, Required)
  - `minimumSpend` (Number, Required)
  - `status` (Enum: DRAFT, ACTIVE, Required)
- `CampaignParticipant`:
  - `id` (UUID, PK)
  - `campaignId` (UUID, FK to Campaign)
  - `promoterId` (UUID, FK to Promoter)
  - `referralCode` (String, Required, Unique)
  - `joinedAt` (DateTime, Required)

**State transitions**:
- Campaign: Draft -> Active (Manual activation by Business Owner/Admin)
- Campaign: Active -> Expired (Automatic based on `endDate`)

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/campaigns` | POST | title, reward, offer, startDate, endDate, minimumSpend | id, status | Bearer (Business/Admin) | 400 (Invalid dates/spend) |
| `/campaigns/:id` | PUT | title, reward, offer, startDate, endDate, minimumSpend | id, status | Bearer (Business/Admin) | 403 (Not draft), 404 |
| `/campaigns` | GET | status=ACTIVE | list of campaigns | Bearer (Promoter) | |
| `/campaigns/:id/join` | POST | (none) | referralCode | Bearer (Promoter) | 400 (Not active), 409 (Already joined) |

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Create Campaign | status | Defaulted to DRAFT |
| Join Campaign | referralCode | Generated uniquely by backend |
| View Active Campaigns | filtered list | DB query where status=ACTIVE and startDate <= now < endDate |

**Key invariants**:
- Start Date must be before End Date.
- A Promoter can only join a specific Campaign once.
- Only Draft campaigns can be modified.

**Security model**:
- Business Owners can only read/write their own Campaigns.
- Admins have global read/write access to all Campaigns.
- Promoters can only read Active Campaigns and create their own CampaignParticipant records.

**Critical test scenarios**:
- Happy path: Business creates campaign, activates it. Promoter views and joins it, receiving a unique code. Verifies **AC-1, AC-3, AC-4**.
- Failure case: Promoter attempts to join a draft campaign. Expect error. Verifies **AC-5**.
- Failure case: Business owner attempts to edit an active campaign. Expect error. Verifies **AC-2**.

## Build plan

1. Create migration for `Campaign` (including `minimumSpend`) and `CampaignParticipant` tables, satisfies **AC-1, AC-4**.
2. Implement backend CRUD operations for Business Owners and Admins (Create, Edit Draft) with `minimumSpend` validation, satisfies **AC-1, AC-2**.
3. Implement backend endpoint for Promoters to list Active campaigns, satisfies **AC-3, AC-6**.
4. Implement backend endpoint for Promoters to join an Active campaign and generate a referral code, handling edge cases, satisfies **AC-4, AC-5**.
5. Implement frontend UI for Business Owners to create/manage campaigns.
6. Implement frontend UI for Promoters to view and join campaigns.

## Consequences

**Positive**:
- Establishes the core marketing loop for the platform.
- Simple data model allows for quick implementation.

**Negative / tradeoffs**:
- Lack of budget caps means businesses must manually monitor performance if they have strict budgets.

**Neutral**:
- Requires a reliable clock for the time-based expiration logic.
