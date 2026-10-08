## Context

The platform requires a centralized way to define how the reward pool is split whenever a customer completes a verified purchase from a business referral. This split is applied globally to all campaigns. We need a secure way for Admins to view and update these percentages, ensuring that the total always equals 100%. Without a global configuration, the percentages would have to be hardcoded or duplicated across campaigns, making future adjustments tedious and error-prone.

## Options considered

### Option 1: A general `Setting` collection

Store the split under a specific key (e.g., `GLOBAL_REWARD_SPLIT`) in a general `settings` collection.

**Pros**:
- Highly extensible; can store other future global platform configurations (e.g., maintenance mode, minimum withdrawal amounts).
- Simple to query by key.

**Cons**:
- Values are typically unstructured (e.g., stored as `Mixed` or `JSON` in Mongoose), requiring strict Zod validation at the application layer.

### Option 2: A dedicated `GlobalRewardSplit` collection

Create a specific Mongoose schema exclusively for the reward split, ensuring only one document ever exists.

**Pros**:
- Strongly typed at the database level.
- Schema explicitly defines the exact fields.

**Cons**:
- Over-engineered for a single configuration.
- Requires creating a new collection for every future global setting, cluttering the database.

## Rationale

A general `Setting` collection provides the right balance of simplicity and future-proofing. As the platform grows, we will inevitably need more global configurations. Creating a new collection for every single setting is an anti-pattern. By enforcing strict validation via Zod (AC-3, AC-4) and protecting the endpoint with Admin authorization, we mitigate the risks of unstructured data storage while maintaining a clean database architecture.
