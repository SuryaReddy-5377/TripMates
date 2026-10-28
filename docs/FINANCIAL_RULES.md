# Financial rules (implemented in `backend/src/finance`, enforced by tests)

1. **Money** is integer paise. Inputs parsed from strings (`parseRupees`), never floats.
2. **Rounding**: largest-remainder method (BigInt). Leftover paise go to the largest fractional remainders;
   ties break by account id ascending, so the result does not depend on click order. Shares always sum to the total.
3. **Account keys**: `p:<id>` person, `f:<id>` family. An expense allocates to people, families, or both (mixed).
4. **No double charging**: a family share is one debt on `f:<id>`. Dividing it among members
   (`splitFamilyShare`) is an informational breakdown that must sum to the family share.
5. **Payer vs responsible**: `paidBy` is credited the full amount paid. Shares are charged only to
   selected accounts. If the payer is not selected, they owe nothing. `summarizeExpense` reports
   payer's own share and amount recoverable from the saved allocations.
6. **Itemized bills**: each item is split only among its assignees. Tax/service/tip are pro-rata to item
   shares by default (so non-eaters are never charged) or equal/custom among chosen accounts. Discounts and
   subtract-adjustments reduce shares; a negative resulting share is rejected. A receipt total mismatch yields a
   warning; nothing is altered silently.
7. **Balance convention** (corrects the brief): `net = paid − shares + sent − received (+ assumed credit − assumed debit)`.
   Positive → should receive; negative → owes; zero → settled. Sum of nets over the group is 0
   (`assertReconciled`).
8. **Repayments** are not expenses. They are rejected if they duplicate an earlier one (same idempotency key, or same
   from/to/amount/date/reference), if sender = recipient, if amount ≤ 0, or if they exceed what the sender owes or
   the recipient is owed — unless `allowAdvance` is explicitly set by an authorized caller.
9. **Covered shares**: `DebtAssumption` moves a debt to another account without touching the original expense or
   moving cash.
10. **History**: allocations are stored per expense and are never recomputed when attendance or membership
    changes; edits must be explicit and audited (`audit_log`).
