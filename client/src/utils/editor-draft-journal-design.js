/*
 * General incremental draft journal proposal (not implemented).
 * A bounded semantic-only checkpoint format is now implemented separately in
 * editor-draft-semantic-envelope.js: certified validated immutable semantic roots,
 * committed retained IDB baselines, captured full presentation shells and exact
 * instance dictionary replacements for text-only edits. This is not a general
 * path journal; unsupported changes keep full records and checkpoints are retained.
 * Compact publication never precedes baseline commit and never rewrites an older
 * captured head after asynchronous work. The original draft/save metadata remains
 * on each head. Legacy full records remain readable.
 *
 * Finding: writeEditorDraft synchronously JSON-stringifies the entire record and
 * attempts localStorage on every revision. Quota failure then queues a full IDB
 * put (structured clone). There is no explicit per-record size contract here;
 * quota varies with origin usage. Skipping the synchronous attempt using a size
 * heuristic or cached failure would remove a reload/unload recovery opportunity.
 * This repair therefore changes only transaction completion/abort handling.
 *
 * EXACT DELTAS
 * Use reference equality to skip branches only under an established immutable
 * producer contract. Otherwise compare exact JSON values, not hashes, sizes, or
 * samples. Encode own-property set/delete paths as arrays of segments, preserving
 * null versus absence and handling prototype-sensitive names as data properties.
 * Initially replace changed arrays whole (including reorder/deletion). Unsupported
 * values must fall back to existing full-record persistence, not be approximated.
 * Preserve the complete metadata per revision: draftId, attemptId, updatedAt,
 * idempotencyKey, aggregateGeneration, key and template flag. Generation and key
 * travel atomically with their snapshot. Replay must not invent save identities.
 * Give each journal a unique lineage and monotonic sequence; every delta names
 * its exact base. Missing/reordered/foreign bases fail closed. Advance the base
 * only after successful persistence, never merely after scheduling a write.
 *
 * NO-LOSS PUBLICATION PROTOCOL
 * A versioned localStorage envelope at the existing key holds either a complete
 * local checkpoint plus tail or an immutable committed IDB checkpoint reference
 * plus tail. Every revision synchronously replaces that envelope with setItem;
 * no debouncing or acknowledging an in-memory-only delta is allowed.
 *
 * 1. Keep the previous envelope/checkpoint while a new immutable IDB checkpoint
 *    transaction is pending. Request success is not sufficient: await complete.
 * 2. After commit, validate the current lineage/head and atomically replace the
 *    local envelope with that checkpoint reference plus ALL successor deltas.
 *    Never install a captured old tail over a newer revision. If setItem fails,
 *    the old envelope remains valid; the new checkpoint is an orphan, not a
 *    recovery dependency. Never publish a reference to an uncommitted checkpoint.
 * 3. Garbage-collect only checkpoints no live envelope or pending writer can
 *    reference. Retain old bases until replacement publication is durable; extra
 *    retained checkpoints are safer than a delete-before-publish loss gap.
 * 4. On local quota/unavailability, retain the full-snapshot IDB fallback and
 *    acknowledge only after commit. Failure does not advance the persisted base.
 *    Recovery compares that standalone committed head with the reconstructed
 *    local head using existing ordering rules. The asynchronous fallback's current
 *    unload limitation must not be extended to successful synchronous writes.
 *
 * REPLAY, MIGRATION, AND CONCURRENCY
 * Read both backends and reconstruct only contiguous tails from complete bases.
 * Keep legacy full-record readers; publish a migrated representation atomically
 * only once independently recoverable. Unload/reload must never depend on an
 * unfinished asynchronous checkpoint. Serialize checkpoint publication, revision
 * writes, generation rebases and guarded clears. Clearing revision N must retain
 * its successors, using original draft/idempotency identity, not checkpoint IDs.
 * Compaction changes representation only, never the remote save identity.
 * Cross-tab checkpoint publication/GC needs coordination or an ownership protocol;
 * absent that, retain bases and do not claim stronger cross-tab ordering than the
 * current store. An in-memory write chain alone is not cross-tab coordination.
 *
 * QUALIFICATION REQUIRED BEFORE IMPLEMENTATION
 * Fault-inject reload/crash before/after checkpoint commit and local publication;
 * abort after request success; both backends failing; local quota; synchronous
 * unload writes; migration; checkpoint/successor races; older guarded clears;
 * failed-write retry; generation rebase and original-key replay; array edits and
 * special keys; multi-tab interference. Assert exact reconstructed values AND
 * metadata, and no accepted revision without a recoverable representation.
 * Measure serialized/structured-cloned bytes for large-deck single-element edits.
 * Envelope tails still cost work to rewrite: compaction must not discard accepted
 * revisions or invent a browser quota threshold. This format/migration change is
 * intentionally deferred rather than weakening durability in a bounded repair.
 */
