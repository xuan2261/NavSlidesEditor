# Evidence ledger — template thực thi

**Chưa có implementation run trong kế hoạch này.** Không copy trạng thái pass từ review trước vào bảng gate current candidate.

## Baseline planning

| Field | Value |
|---|---|
| Planning date | 2026-10-09 |
| Local source | `aa19b59cd5bd5de2510f9bc4edd2ef2311ce9131` |
| Local branch | `main` |
| Historical CI only | `5e324699318da8cd2950e80f6a2d0057cd3d7d33`, run `36756667471` |
| Current implementation candidate | not created |
| Implementation tests | not-run |
| Release qualification | not-run |
| Publication | not authorized |

## Một record cho mỗi batch test/qualification

```text
record_id:
phase_id / scenario_ids:
state: not-run | passed | failed | blocked | waived
source_sha:
working_tree_clean:
patch_digest_if_dirty:
workflow_sha / workflow_path:
command / cwd / exit_code:
start_end_time_utc:
os_arch_node_npm_browser_scanner_office_versions:
fixture_manifest / hashes / seed:
data_dir_ownership / cleanup_result:
artifact_kind / artifact_digest_algorithm / digest_namespace / value:
policy_path / policy_digest:
log_or_receipt_path:
assertion_summary / test_count / discovery_count:
red_evidence / green_evidence / adjacent_regression:
blocker_owner / unblock_action:
approval_reference_if_required:
reviewer:
```

Không ghi secret, token, private key hay deck nhạy cảm trong ledger. Attachment public phải được phân loại/redact.

## Final gate table (điền sau source freeze)

| Gate | State | Source/artifact | Receipt | Blocker |
|---|---|---|---|---|
| Lint/build | not-run | — | — | Implementation chưa bắt đầu |
| Unit/integration/coverage | not-run | — | — | — |
| E2E/import/live/mobile | not-run | — | — | — |
| Visual regression Linux | not-run | — | — | — |
| Load smoke | not-run | — | — | Không đại diện production capacity |
| Container qualification | not-run | — | — | — |
| Supply-chain scan/SBOM/provenance | not-run | — | — | — |
| Strict importer corpus | not-run | — | — | Không thay PowerPoint fidelity |
| Windows runtime closure | not-run | — | — | Host prerequisite cần xác nhận |
| OfficeCLI physical | not-run | — | — | Tool/license prerequisite cần xác nhận |
| PowerPoint fidelity | not-run | — | — | Office host prerequisite cần xác nhận |
| Authenticode + downloaded artifact signature | not-run | — | — | Signing approval/material cần xác nhận |
| Attestation/exact-source | not-run | — | — | — |
| Performance acceptance | not-run | — | — | Baseline budget chưa chốt |
| Release authorization | not-run | — | — | Cần user approval |

## Freeze/requalification rule

Sau qualification, thay source/lock/runtime/build config/policy có ảnh hưởng artifact => tạo candidate mới, rebuild và chạy lại gates bị ảnh hưởng; không tái dùng receipt chỉ vì version string giống nhau. Docs-only provenance changes cũng phải xem consumer/hash rules trước khi quyết định reuse. Nếu policy bắt exact-source toàn chuỗi, tuân thủ policy kể cả artifact bytes tình cờ không đổi.
