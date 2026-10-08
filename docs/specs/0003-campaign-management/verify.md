# Verification Plan: 0003 Campaign Management (Minimum Spend)

## Environment Requirements
- Seeded test accounts for: Business Owner, Admin, Promoter.

## Automated Verification

- Run backend test suite. (Not configured yet).

## Manual Verification (Happy Path)
1. Login as Business Owner.
2. Send `POST /api/v1/campaigns` with `minimumSpend: 50`.
3. Verify response `201 Created` and body contains `minimumSpend: 50`.
4. Login as Admin.
5. Send `GET /api/v1/campaigns` and verify the created campaign has `minimumSpend: 50`.
6. Send `PATCH /api/v1/campaigns/:id` with `minimumSpend: 100`.
7. Verify response `200 OK` and body contains `minimumSpend: 100`.

## Manual Verification (Edge Cases)
1. Send `POST /api/v1/campaigns` with `minimumSpend: -10`.
2. Verify response `400 Bad Request` with Zod validation error "Minimum spend must be a non-negative number".
3. Send `POST /api/v1/campaigns` without `minimumSpend`.
4. Verify response `400 Bad Request` with Zod validation error "Minimum spend must be a non-negative number" (since it is required on creation).
