# GitHub workflow caller-boundary runtime proof (P16-08/09/10)

## Scope and method

Executed the actual extracted Bash bodies from `.github/workflows/electron-server-lock-refresh.yml` policy (30–33) and PR caller (53–77), and `.github/workflows/release.yml` CI selection (69–82). The only substituted GitHub expression was `${{ github.repository }}` → explicit synthetic `synthetic-owner/synthetic-repo`; environment fixtures supplied approved branch `main`, subject `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`, Linux run `51001`, OfficeCLI run `51002`, and fidelity run `51003`. This **does not** change or reinterpret the actual upstream baseline branch `master`.

Runner command: `python plans/261009-0901-navslides-full-reliability-deep-tdd/reports/.tmp-github-caller-boundary-smoke.py`. Each extracted body ran under actual Git-for-Windows Bash: `bash --noprofile --norc -eo pipefail <policy|refresh|selection>.sh`. Scripts/fixtures ran in an owned OS temporary directory, never production/server/client/tests/e2e roots. `git init --bare`, `git init -b main`, actual commits, and actual `git push --force-with-lease origin chore/electron-server-lock-refresh` used only a bare local file remote. Git restricted protocols to `file`, disabled credential prompts, and used isolated global configuration. Consumer effects were asserted through remote refs, committed lock contents, Git invocation trace, gh argument logs, exit status, and GITHUB_OUTPUT bytes—not source-string assertions.

`gh` was an exclusive PATH boundary executable returning deterministic synthetic upstream outputs and logging every invocation. Genuine gh/auth/API/network/token/dispatch/publication/permission operations never ran. Token/secret/password/PAT environment entries were removed before subprocess execution. The boundary only accepted repository-default-branch query, PR list/create, and the run-list API command; unexpected boundary calls failed. The fixture is not evidence of real GitHub authorization or successful hosted CI.

## Preserved initial failure

`github-caller-boundary-smoke-pre-repair.json` is the durable complete initial matrix (12 executed cases, 10 passed expectations, two product-contract failures). Initial hard assertion interrupted on wrong branch; mandatory `GitHubCallerFailureCounsel` consultation preceded any harness diagnosis/edit. Counsel identified Bash errexit exemptions for nonfinal commands in AND lists. The harness was then changed only to retain observed failed expectations, finish the matrix, and handle Windows read-only Git object cleanup. No workflow/product edit was made by this worker.

Workflow whole-file SHA-256: refresh `4540cab8054ed024cf7785b3a9ab74963fa65a7b3436da0d204a6b07cea07d23`; release `b128603bc0a61b3829af678769bad51e0067d2bb17026230222febb37ba75432`. Exact un-substituted extracted body SHA-256 values are in JSON (`workflowBodies`), including release selection `691304e7c06511e244c79aee7905476626f48190ef47efe7d739180e1775d5dd`.

| Acceptance ID / case | Observed consumer evidence | Initial result |
|---|---|---|
| P16-08 denied refresh PR | Local refresh branch committed/pushed; exactly PR list then PR create; create refusal produces actionable `::error::` owner-approval guidance, explicit no-permission/PAT fallback statement, exit 1. No additional gh calls. | PASS |
| P16-09 no diff | Exit 0; no gh calls, no Git commit/push invocation; complete remote ref map unchanged. | PASS |
| P16-09 existing PR #733 | Exit 0; exactly one PR list, no PR create; existing automation ref advances to new committed lock; remote main and unrelated refs unchanged. Only force-with-lease on designated automation branch. | PASS |
| P16-10 default branch discovery | Three actual policy-body executions write `base=main`, exit 0. | PASS |
| P16-10 approved main/exact SHA/push | API args request exact SHA, branch main, event push, status success and exact workflow endpoint; exit 0, four distinct-routing outputs below. No requirement for master. | PASS |
| P16-10 wrong branch `master` | Exit **0**, emits all producer outputs despite BASE=main. | **FAIL: product guard defect** |
| P16-10 wrong SHA `bbbb…` | Exit **0**, emits wrong `head_sha` plus producer IDs. | **FAIL: product guard defect** |
| P16-10 wrong workflow source | Exit 1; no consumer outputs. | PASS |
| P16-10 wrong event pull_request | Exit 1; no consumer outputs. | PASS |
| P16-10 conclusion failure | Exit 1; no consumer outputs. | PASS |

Approved run-selection GITHUB_OUTPUT:

```text
run_id=51001
head_sha=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
officecli_run_id=51002
fidelity_run_id=51003
```

The defect is in release lines 74–75: a failing nonfinal `test` in `test A && test B` does not trigger `set -e`, so later passing guards/output writes mask it. Main was notified; suggested Main-owned repair is standalone assertions (including analogous distinct-producer guard line 78). The synthetic boundary intentionally supplies out-of-filter responses to exercise defensive consumer refusal; this establishes the local shell flaw, not a claim that GitHub currently returns such a response or that downstream validators permit publication.

## Cleanup and ownership

Both initial failed-run and completed characterization temporary directories were removed; Windows Git loose-object read-only attributes required an owned-root cleanup handler. JSON records cleanup success. Main repository Git was never used for mutation; only plan reports and the disposable runner were written here. The runner was removed after final proof. Physical qualification, live Actions/PR policy, remote exact-SHA CI and release authority remain outside this proof.

## Final Main-owned repair rerun — PASS (20/20)

Main replaced the vulnerable chained `test` predicates with independent admission assertions. This worker re-read and extracted the actual repaired release selection body (69–88), then reran the same consumer proof plus Main-requested producer-admission negatives. `github-caller-boundary-smoke-green.json` records **20/20 passed expectations**: three default-branch policy executions, three refresh caller cases, and fourteen release-selection cases. Process runner exited 0; denied PR and each rejected selection case individually exited 1 as expected.

Approved branch `main`, exact SHA, successful push and exact workflow source still emit the four run-selection outputs above. Wrong branch, wrong SHA, wrong workflow source, wrong event, wrong conclusion, empty Linux run ID, each of the three duplicate producer-ID pairs (Linux/OfficeCLI, Linux/fidelity, OfficeCLI/fidelity), each missing physical producer ID, and each nonnumeric physical producer ID all exit 1 with **empty GITHUB_OUTPUT**. Request logs retain the exact-SHA/approved-branch/push/success API arguments; no additional external calls occur. P16-08 and P16-09 remain passed under actual isolated Git ref/commit assertions.

Final release workflow SHA-256: `3190a8c45edecc6bee91f82867297242a5a03baad1cce79310883d1f66aee75e`. Final extracted un-substituted body SHA-256: `50d8db34bfe898894cd8c1c85304699edacab9bec60f42a60881da80dbb50234`. Refresh identities are unchanged. Initial failed JSON SHA-256: `3291b8c537fe25b203ab88105a0ed102feef66d6aed40cba4c5ed140c450b6a5`; final green JSON SHA-256: `23d92d0ef787038553f1185a020a45829f5be7a541c47dd40b4ac5f228a73d4b`.

The original `github-caller-boundary-smoke.json` and the immutable `github-caller-boundary-smoke-pre-repair.json` preserve the characterized RED result; they are not final green qualification. The green report supersedes the caller defect in this isolated scope only. No permanent tests, workflow edits by this worker, product changes, credentials, or real GitHub operations were introduced. All owned temporary roots and the `.tmp-github-caller-boundary-smoke.py` scaffold were removed.
