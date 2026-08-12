---
title: "PPTX Reliability Remediation Research"
status: completed
created: 2026-08-10
---

# PPTX Reliability Remediation Research

## Findings

- JSZip CRC validation inflates entries before raw entry-count and declared-byte
  limits. Existing bounded streams run only afterward.
- Compatibility drain returns only an applied count. It cannot prove the target
  import write was applied rather than stale, unrelated, or dead-lettered.
- Package rollback removes pending outbox writes but does not compensate an upsert
  already applied to `presentations.json`.
- Imported media files and global hash entries are created before package commit.
  Ownership exists only in process memory, so abrupt termination leaks both.
- Completed predecessor plans explicitly left durable media replay and full repair
  states residual. The active package-first plan depends on these shared contracts.

## Selected Design

1. Parse raw ZIP structure first, reject count/declared budgets, load JSZip without
   eager CRC, then stream each entry once under actual-byte caps while calculating
   CRC. Preserve existing error codes and return shape.
2. Return exact per-write drain outcomes. Import completes only after its own
   compatibility write is `applied`.
3. Add minimal durable compensation state, queue an identity-fenced removal, and
   resume incomplete compensation on startup. Avoid a generic saga engine.
4. Stage new media in a job namespace. Bind a bounded manifest to durable package
   publication, finalize idempotently, and recover before compatibility drain.
5. Preserve legacy state/media without migration, inference, or destructive sweep.

## Error and Ordering Policy

```text
abort
  > compressed-file/signature/raw-structure error
  > entry-count/declared-byte budget
  > actual inflated-byte/XML budget
  > CRC mismatch
  > required-part/content validation
```

Import commit ordering:

```text
stage media
  -> publish package + media manifest + compatibility write identity
  -> finalize media
  -> verify exact compatibility receipt
  -> durable committed/done
```

Rollback ordering:

```text
persist compensation intent
  -> remove package authority
  -> queue and verify identity-fenced compatibility removal
  -> rollback manifest-owned media
  -> durable rolled-back
```

## Test Strategy

- Instrumented preflight tests prove no inflation before count/declared rejection.
- Deferred-gate crash tests cancel after real JSON apply but before drain settle.
- Mixed-batch/poison/ack-failure tests validate exact receipt semantics.
- Reopen real temporary package stores after each injected crash point.
- Child-process media tests terminate between stage/publish/move/hash/finalize and
  verify idempotent restart convergence.

## Rejected Alternatives

- New archive library without first exhausting current raw ZIP + JSZip seams.
- SQLite, a generic distributed transaction framework, or global media GC.
- Rewriting legacy media ownership or changing public job DTOs.
- Duplicating package-first feature/fidelity work.

## Unresolved Questions

None.
