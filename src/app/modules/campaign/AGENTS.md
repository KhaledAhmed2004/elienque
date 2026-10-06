# Campaign Management Context

- **Governing Spec**: `docs/specs/0003-campaign-management.md`
- **Models**: `Campaign` (draft/active lifecycle) and `CampaignParticipant` (promoter joins).
- **Authorization**: Business Owners can manage their own campaigns; Admins can manage all. Promoters can only join active campaigns.
- **Constraints**: Campaigns cannot be modified once active. Promoters cannot join draft or expired campaigns.

_Drafted by /sync from the introducing change, worth a quick human pass._
