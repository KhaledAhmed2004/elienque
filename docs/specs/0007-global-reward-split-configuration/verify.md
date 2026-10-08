# Verify: Global reward split configuration · spec 0007 · updated 2026-10-07
_Steps derived from spec 0007 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._
## Commands
- [x] `GET /api/v1/settings/reward-split` as Admin → returns global reward split or 404 → AC-1, AC-5
- [x] `PUT /api/v1/settings/reward-split` with `promoter: 40, customer: 40, platform: 20` as Admin → succeeds, updates global split → AC-2, AC-3, AC-5
- [x] `PUT /api/v1/settings/reward-split` with `promoter: 40, customer: 40, platform: 10` as Admin → fails with 400 Bad Request → AC-4
- [x] Access endpoints as non-Admin → fails with 403 Forbidden → AC-1, AC-2
## Acceptance-criteria coverage
- AC-1 is covered by steps 1, 4 · AC-2 is covered by steps 2, 4 · AC-3 is covered by step 2 · AC-4 is covered by step 3 · AC-5 is covered by steps 1, 2
