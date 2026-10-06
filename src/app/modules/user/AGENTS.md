# User Module

## Overview

Manages user profiles, chauffeur (driver) approvals, roles (PROMOTER, BUSINESS_OWNER, ADMIN), and favorites. Handles complex multipart form-data for license uploads and maps them into nested document structures.

## Key files

| File | Owns |
|---|---|
| `user.model.ts` | Mongoose schema, auth statics (password hash), and pre-save hooks |
| `user.controller.ts` | Request mapping, specifically `mapLicenseFields` for flattening form-data |
| `user.validation.ts` | Zod schemas, includes form-data specific schemas (`licenseDocSchemaFormData`) |
| `user.route.ts` | Express router with role-based auth and rate-limiting middlewares |

## Conventions

- **Form-data mapping**: Multipart file keys (e.g., `drivingLicenseImage`) and expiry dates are sent flat but mapped into nested documents (e.g., `drivingLicense: { image, expiryDate }`) in the controller before passing to the service.
- **Admin actions**: State changes like suspend, approve, reject, block are strictly admin-only (`auth(USER_ROLES.ADMIN)`).
- **Favorites**: Users can save 'chauffeurs' as favorites, stored as ObjectIds in `favoriteChauffeurs`.

## Gotchas

- Passwords and `authentication` (OTPs) are `select: false` by default in the schema and must be explicitly selected when needed (e.g. `isExistUserByEmail`).
- `user.controller.ts` contains fallback aliases (e.g., `blockUser` = `suspendUser`) for backward compatibility.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
