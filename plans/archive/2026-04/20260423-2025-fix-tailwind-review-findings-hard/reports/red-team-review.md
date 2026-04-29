# Red Team Review

## Accepted Findings

- Controller must not reuse presenter `navigate`; otherwise remote can still bypass ownership.
- `verticalIndex` must be first-class in every socket payload; putting `indexv` into `fragmentIndex` breaks vertical decks.
- `presentation-meta` should contain notes and flat slide labels, not full editable presentation state.
- Find/replace tests must target empty string replacement through UI, not only helper unit tests.

## Rejected Findings

- Adding a REST endpoint for live metadata is unnecessary; Socket.IO already carries room state and presentation data.
- Adding a separate `speaker` role duplicates controller semantics.

## Unresolved Questions

None.
