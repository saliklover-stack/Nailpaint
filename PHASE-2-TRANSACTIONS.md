# Phase 2 transaction reversals

Completed business transactions are immutable. They use `completed`, `cancelled`, or `reversed` status metadata. Cancellation preserves the original row and appends inverse stock-ledger movements; the original ledger rows are never deleted.

Editing is implemented as one PostgreSQL transaction: reverse the old effect, validate the replacement under the same row locks, post the replacement, and commit. If validation or posting fails, the whole transaction rolls back and the original remains completed.

Cancellation requires a reason and is rejected when the original status is no longer `completed`. Purchase cancellation is rejected if its material has already been consumed. Production cancellation is rejected if its finished goods have already been consumed. Sale, payment, and expense effects are reversed atomically with their source records.
