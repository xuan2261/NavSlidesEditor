# Phase 1 re-plan decision after the failed OfficeCLI spike

Status: proposed correction, not approved gate evidence. The accepted Phase 1 rule stops execution before G0 when its real positive fixture fails. The [physical failure](./officecli-physical-feasibility-blocker.md) triggered that rule.

## Change the positive qualification fixture, not the validator

Keep `good-package.pptx` and its existing hash as an adversarial package-safety fixture. It is not a valid PowerPoint OPC document. Add a separately named, PowerPoint-generated, one-slide, no-user-content positive fixture with its generating PowerPoint build, source hash, and attribution recorded. Explicitly revise the Phase 1 positive-fixture requirement, physical runner's allowlist, receipt validator, and associated pinned hashes before any replacement receipt can satisfy the gate. Keep the two malformed fixtures and their existing typed-rejection expectations unchanged. Do not make OfficeCLI `success: false` or exit code 1 pass. The existing good-package input may still exercise the safety gate, but cannot prove native validation.

RED: the new fixture must fail before it is registered, and the old `good-package.pptx` must still be rejected by the real OfficeCLI. GREEN: the pinned `1.0.135` direct gateway accepts the new fixture, rejects both malformed fixtures through production preflight, writes a redacted authoritative receipt, and refuses a substituted path/hash. The temporary PowerPoint-generated probe in the failure report was only a feasibility experiment; it is not a retained or checked-in fixture.

## Decode the pinned executable's actual JSON contract

`server/services/pptx-import/officecli/output-parser.js` expects `valid: true`,
but successful version `1.0.135` emits `success: true`. First characterize the
actual positive and negative JSON envelopes in a failing focused parser test.
Then accept exactly the real positive shape, reject `success: false`, malformed
JSON, missing status, and ambiguous status fields. Migrate the existing mock
responses to the real shape rather than adding a permissive legacy fallback.
Repeat the production gateway probe after the parser fix; a direct CLI pass
does not prove the gateway decoded it.

## Close receipt and provenance gaps

Require one receipt entry per distinct pinned fixture, not just three matching
entries; add a regression for repeated positives with missing negatives. Redact
filesystem errors from the physical runner's CLI stderr and assert that missing
binary and fixture paths never appear in logs. Record a verifiable administrator
acquisition source and timestamp rather than using filesystem creation time.
An unsigned, hash-matched binary remains local integrity evidence only.

## Qualify the required isolation profile before G1

Phase 8 requires a clean dedicated standard Windows account or disposable VM, no project secrets, and denied outbound access. The developer-session probe did not satisfy that contract. Provision a clean profile, verify the binary identity and host build there, demonstrate denied DNS/TCP/HTTP and access to out-of-scope sentinel data, and record account/image and egress-policy digests in a receipt. Run the real positive/negative gateway in that boundary. Do not represent a filtered environment or the current developer account as isolation.

The present physical script/receipt schema does not record isolation or egress proofs. Add those fields and enforce them before calling a receipt G1-ready. If such infrastructure cannot be provisioned, retain `G1_BLOCKED_ISOLATION_UNAVAILABLE` and do not start G0/G1 implementation in reliance on the failed spike. No package-first or PowerPoint claim is promoted by this proposal.
