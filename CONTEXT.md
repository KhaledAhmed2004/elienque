# moeb26 Domain Context & Ubiquitous Language

## Overview
**moeb26** is a Chauffeur, Fleet, and Deal Dispatch/Management Backend Platform. It connects Chauffeurs (Drivers/Operators) and Company Owners to Service Areas, Vehicles, Deals, and Invoicing/Payout Systems.

---

## 👥 Actors & Role Hierarchy

### System Roles (`USER_ROLES`) — Authorization Boundary
* **`ADMIN`**: Platform administrators. Full governance over user accounts, document reviews, service areas, and deals.
* **`USER`**: Core platform participant (Chauffeurs, Fleet Owners, Operators).

### Company Roles (`COMPANY_ROLE`) — Informational Profile Metadata
*(Note: `COMPANY_ROLE` is purely descriptive/informational metadata stored on the User profile; authorization is governed by `USER_ROLES` and `APPLICATION_STATUS`)*
* **`Chauffeur`**: Individual driver executing trips.
* **`Owner`**: Fleet or company owner managing vehicle assets.
* **`Operator` / `Company Manager`**: Operational dispatcher or administrator within a fleet company.

---

## 🔄 Dual Lifecycle State & Status Model (`User`)

Each user account in `moeb26` is governed by two orthogonal, concurrent lifecycle models:

### 1. `ACCOUNT_STATUS` (Security & Authentication Lifecycle)
Answers: *"Is this identity verified and allowed to authenticate?"*
* **`UNVERIFIED`**: Initial state after registration. The user must verify their 6-digit email OTP. Cannot log in or access protected routes.
* **`VERIFIED`**: Email verified, account in good standing.
* **`LOCKED`**: Temporarily locked due to failed login attempts (>= 5 attempts: 10m, >= 10 attempts: 1h, >= 15 attempts: 24h). Automatically unlocks when cooldown timer expires or upon correct password entry.
* **`SUSPENDED`**: Manually suspended by an Admin. Access is blocked across all endpoints.
* **`DEACTIVATED`**: Soft-deleted or permanently deactivated account.

### 2. `APPLICATION_STATUS` (Approval & Operational Lifecycle)
*(Mapped to legacy `appState` in database)*
Answers: *"Where is this chauffeur's/company's operational approval application in its lifecycle?"*
* **`PENDING`**: Application has been submitted and is awaiting Admin review. Chauffeurs have restricted read-only profile access and document upload access only (blocked from deals/vehicles/active trips).
* **`ACTION_REQUIRED`**: Admin has requested corrections, additional information, or document updates.
* **`ACTIVE`**: Application has been approved and the chauffeur/company is fully authorized to operate on the platform.
* **`REJECTED`**: Application was rejected by Admin (rejection reason recorded).
* **`REVOKED`**: Previously granted operational approval has been withdrawn due to compliance, licensing, or operational violations.

---

## 🔑 Canonical Domain Terms & Glossary
* **Service Area (`serviceAreaId`)**: Geographic jurisdiction in which a chauffeur or company is authorized to operate.
* **One-Time Password (OTP)**: 6-digit cryptographic verification code sent via asynchronous `EmailOutbox`. Valid for 3 minutes.
* **Reset Token**: High-entropy 5-minute single-use cryptographic token issued after OTP verification for secure password reset.
* **Lockout Timer (`lockUntil`)**: Timestamp until which an account cannot attempt password authentication.
* **Refresh Token Rotation**: Refresh tokens issued via `httpOnly`, `SameSite=Lax` cookies and rotated upon each `/refresh-token` exchange.
