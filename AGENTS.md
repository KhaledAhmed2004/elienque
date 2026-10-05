# Project Rules & Customizations (Antigravity IDE)

This repository contains project-level rules, workflows, and skills under `.agents/`.

## Workflows & Audits

- **Code Audit & Refactoring**:
  Whenever the user asks to review, audit, or refactor any existing module, feature, or code, **always follow the 9-phase workflow** in [`.agents/workflows/code-audit.md`](file:///c:/Users/Khaled/Khaled%20Dask/Backend/moeb26/.agents/workflows/code-audit.md).
  - Stop at all **3 Hard Gates** (Gate 1: Scope, Gate 2: Findings, Gate 3: Plan Approval).
  - No code changes are permitted before explicit Gate 3 approval.
  - **Audit Evidence & Output Contract (Mandatory Protocol)**:
    - *Zero Inference without Inspection*: Never assume repository facts when they can be inspected. Never present conceptual architecture as observed reality.
    - *Two-Dimensional Classification*:
      - **Evidence Class**: `OBSERVED` (direct `file:line` or command output) | `INFERRED` (deduction citing observed evidence) | `UNKNOWN` (cannot be established). **Missing evidence = UNKNOWN, never PASS.**
      - **Investigation State**: `RESOLVED` | `UNRESOLVED — Needs Business Input` | `UNRESOLVED — Needs Active Debugging` | `BLOCKED — Environment Dependency`.
    - *Mandatory Gate 1 Evidence Tuples*: Gate 1 report is incomplete without: (1) Exact path, (2) Exact archetype, (3) Exact file inventory, (4) Git provenance, (5) Lockfile evidence, (6) Canonical test command from repo config, (7) Mutation-safety reasoning, (8) Baseline exit codes/counts, (9) Real caller trace with `file:line`.
    - *Mandatory Investigation Order*: (1) Initialize 9-item checklist → (2) Collect raw evidence → (3) Classify as OBSERVED/INFERRED/UNKNOWN → (4) Validate completeness → (5) ONLY THEN generate Gate 1 report.
    - *Reporting & Approval Invariant*: Gate approval is EXPLICIT from the user, never inferred or assumed by the agent. If ANY mandatory Gate 1 item is missing or UNKNOWN, DO NOT request approval. State which item remains UNKNOWN and continue evidence collection.
    - *Observation $\neq$ Finding*: Observations in Phase 0–1 must never be labeled as defects or findings before Phase 6.
    - *Strict Terminology*: Use exact workflow labels (`QUERY_BUILDER`, `CONFIRMED_BUG`, etc.). Never invent ad-hoc variants.

- **Modular PRD & BDD Generation**:
  Whenever the user asks to write, generate, or document a module's PRD or requirements, **follow the 5-phase specialist workflow** in [`.agents/workflows/modular-prd.md`](file:///c:/Users/Khaled/Khaled%20Dask/Backend/moeb26/.agents/workflows/modular-prd.md) using the [`modular-prd-generator`](file:///c:/Users/Khaled/Khaled%20Dask/Backend/moeb26/.agents/skills/modular-prd-generator/SKILL.md) skill, `grill-with-docs`, and the [`plain-docs`](file:///c:/Users/Khaled/Khaled%20Dask/Backend/moeb26/.agents/skills/plain-docs/SKILL.md) clarity standard.
  - Stop at all **3 Hard Gates** (Gate 1: Scope & Baseline, Gate 2: Domain Mapping & Unresolved Decisions, Gate 3: Final PRD & CONTEXT.md Sign-off).
  - Always enforce **Plain Language & Zero-Jargon**: Use simple, crisp English that any junior developer or non-tech stakeholder can understand in 30 seconds.

- **New Feature Implementation**:
  Whenever the user asks to implement, build, or develop a new feature or module, **always follow the Controlled Engineering Decision Pipeline (CEDP)** in [`.agents/workflows/feature-implementation.md`](file:///c:/Users/Khaled/Khaled%20Dask/Backend/moeb26/.agents/workflows/feature-implementation.md).
  - Classify feature into Risk Tiers (**L0–L4 × S0–S3**) before execution.
  - Stop at all **3 Evidence-Enforced Hard Gates** (Gate 1: Domain & Architecture Assurance, Gate 2: Contract & Adversarial Test Assurance, Gate 3: Automated Verification vs Business Acceptance).
  - Never write implementation code before Gate 1 approval.
  - **Architectural Keystone:** Skills produce `CONTROL_RESULT` envelopes; the CEDP orchestrator evaluates envelopes at gates — never free-text summaries.
  - **New specialist skills** (invoke for the appropriate tiers):
    - [`evidence-provenance-validator`](.agents/skills/evidence-provenance-validator/SKILL.md) — Required at Gate 1 & 2: validates every claim has verifiable provenance (SOURCE, SOURCE_TYPE, EVIDENCE, CONFLICT).
    - [`idempotency-contract`](.agents/skills/idempotency-contract/SKILL.md) — Required for L3/L4: formalizes idempotency scope, IN_PROGRESS behavior, and effectively-once outcome. Blocks Gate 2 if absent.
    - [`concurrency-proof`](.agents/skills/concurrency-proof/SKILL.md) — Required for L3/L4: proves DB-level atomic guards at Level 2+. Blocks Gate 2 if absent.
    - [`backend-module-auditor`](.agents/skills/backend-module-auditor/SKILL.md) — Required at Gate 3: post-implementation architectural verification across 8 core pillars with Evidence Grid and CONTROL_RESULT.
  - Strictly enforce 5-Tier Authorization (Auth, Role, Resource Ownership, Tenant Isolation, Field-Level BOPLA), Negative Invariants, Concurrency Guards, and living domain docs sync (`CONTEXT.md`).
  - If a **P0 or P1** is discovered during implementation, STOP immediately, reopen the affected gate, resolve the finding, and re-present the dossier before resuming.

## Active Rules
- Additional architecture, API design, and workflow rules are located in [`.agents/rules/`](file:///c:/Users/Khaled/Khaled%20Dask/Backend/moeb26/.agents/rules/).



