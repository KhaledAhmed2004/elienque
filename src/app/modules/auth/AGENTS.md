# Auth

## Overview

Manages authentication, authorization, registration, OTP verification, and password resets using JWT and bcrypt.

## Key files

| File | Owns |
|---|---|
| auth.controller.ts | Request handling and response formatting for auth endpoints |
| auth.route.ts | Route definitions, rate limiting, and auth middleware application |
| auth.service.ts | Core business logic for authentication, tokens, and password hashing |
| auth.validation.ts | Zod schemas for input validation |

## Conventions

- Uses HTTP-only cookies for storing refresh tokens.
- Encrypts email payload when sending verification emails via EmailOutbox.
- Implements strict rate limiting on registration and OTP endpoints to prevent abuse.
- Authorization uses the central `auth()` middleware mapping to `USER_ROLES`.

## Gotchas

- Registration uses MongoDB transactions to insert User and EmailOutbox records atomically.
- Password hashing is done explicitly before updating or creating users in the service layer.
- `claimAdmin` route exists for initial setup, requiring exact password requirements.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
