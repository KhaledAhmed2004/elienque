# Lead Module & Promoter Journey

This document outlines the complete workflow for the **Promoter and Lead Management** lifecycle in our system. It describes how a promoter submits a lead, how the admin manages its status, and what happens when a lead is approved or rejected.

## Flow Visualization (Mermaid)

Below is a Sequence Diagram mapping out the exact flow tested in our E2E journey (`promoter-journey.e2e.spec.ts`):

```mermaid
sequenceDiagram
    actor Promoter
    participant System (API)
    actor Admin
    participant Database

    %% Step 1: Promoter Registration
    Promoter->>System (API): Registers as PROMOTER
    System (API)->>Database: Create User (Role: PROMOTER)
    System (API)-->>Promoter: Success + Token

    %% Step 2: Lead Submission
    Promoter->>System (API): Submit New Business Lead
    System (API)->>Database: Check if Business Owner User exists
    alt User already exists
        System (API)-->>Promoter: Error 409 (Conflict)
    else User does not exist
        System (API)->>Database: Save Lead (Status: PENDING)
        System (API)-->>Promoter: Success (Lead created)
    end

    %% Step 3: Admin Review 
    Admin->>System (API): GET All Leads
    System (API)-->>Admin: List of Leads (incl. PENDING)

    %% Step 4: Admin processing
    Admin->>System (API): Update Status -> IN_PROGRESS
    System (API)->>Database: Update Lead Status
    System (API)-->>Admin: Success

    %% Step 5: Promoter checking status
    Promoter->>System (API): GET /my-leads
    System (API)-->>Promoter: View Lead as IN_PROGRESS

    %% Step 6: Final Decision
    alt Admin Rejects Lead
        Admin->>System (API): Update Status -> REJECTED (with reason)
        System (API)->>Database: Update Lead Status & Note
        System (API)-->>Admin: Success
    else Admin Approves Lead
        Admin->>System (API): Update Status -> APPROVED
        System (API)->>Database: Create new User (Role: BUSINESS_OWNER)
        System (API)->>Database: Auto-generate temp password & set needsPasswordChange = true
        System (API)->>Database: Link newly created User ID to the Lead
        System (API)-->>Admin: Success (User onboarded automatically)
    end
```

## E2E Test Coverage
Our E2E test suite covers:
1. Promoter successfully registering.
2. Promoter submitting a business lead.
3. Admin fetching all leads.
4. Admin moving the lead to `IN_PROGRESS`.
5. Promoter fetching their own leads to verify the status.
6. Admin updating the lead status to `REJECTED` (with internal notes).
*(Approvals and user auto-generation are handled in service logic and covered through unit/integration layers).*
