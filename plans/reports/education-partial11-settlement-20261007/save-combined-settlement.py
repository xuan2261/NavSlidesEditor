"""Kết hợp report đã đọc, giữ bản cũ; không chứng nhận source hoặc receipt mới."""
import json
import pathlib

ROOT = pathlib.Path(__file__).parent
NATIVE_NAME = 'native11-complete-settlement-v2.json'
EVIDENCE_NAME = 'evidence11-complete-settlement-report.json'
native = json.loads((ROOT / NATIVE_NAME).read_text(encoding='utf-8'))
evidence = json.loads((ROOT / EVIDENCE_NAME).read_text(encoding='utf-8'))

settlement = {
    'reportKind': 'COMBINED_CORRECTION11_FAILURE_SETTLEMENT',
    'date': '2026-10-07',
    'verdict': 'FAILED_DELIVERY_NOT_ADMITTED_SOURCE_REPAIR_REQUIRED',
    'settlementReportComplete': True,
    'fullContractCoverageComplete': False,
    'meaning': 'Đã hoàn tất settlement read-only được phép với các giới hạn evidence có căn cứ. Không phải source-clean, full recursive coverage, admission hoặc runtime qualification.',
    'authority': {
        'userHandoff': 'C:/Work/NavSlidesEditor/plans/handoffs/education-partial11-resume-20261007.md',
        'currentUserScope': 'Read-only audit recovery/coverage and combined failure settlement only.',
        'producerPin': 'local8045/gemini-3.8-flash-high',
        'producerInvoked': False,
        'producerPinChanged': False,
        'reviewerMethod': 'Các reviewer GPT của session hiện tại tiếp nhận cùng logical audits; không phải agents kongming cũ được resume hoặc substantive producer.',
        'agentStateOrEvalAssumedPersistent': False,
    },
    'gitVerification': {
        'coordinator': {
            'path': 'C:/Work/NavSlidesEditor',
            'branch': 'main',
            'HEAD': 'aa19b59cd5bd5de2510f9bc4edd2ef2311ce9131',
            'initialAndObservedFinalStatus': 'Chỉ handoff education-partial11-resume-20261007.md untracked.',
        },
        'education': {
            'path': 'C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001',
            'branch': 'feat/education-gemini38-cook-261001',
            'HEAD': 'c5b5e896d9f06859b21e19122f81c7613067c386',
            'preexistingModifiedPaths': 12,
            'preexistingUntrackedPaths': 9,
            'observedStagedPaths': 0,
            'finalStatusOutsideSessionReportDirectoryMatchesObservedBaseline': True,
            'verificationLimit': 'Git path/status comparison và các write scopes quan sát được; không có initial byte-hash snapshot nên không tuyên bố byte-for-byte verification đối với thay đổi có sẵn.',
        },
    },
    'evidenceAccess': {
        'DVolumeReachable': True,
        'affectedDirectory': 'D:/NavSlidesQualification/edu-resume-261004',
        'nativeEnumerationError': 'Incorrect function',
        'toolReadSymptoms': ['empty directory listing', 'path does not exist'],
        'interpretation': 'Filesystem access/enumeration failure, not evidence of data loss. Exact cause is not established.',
        'attempts': 'Dedicated read, native Get-Item/Get-ChildItem, .NET enumeration and read-only fsutil metadata probes; native directory enumeration still failed on final observation.',
        'DWritten': False,
        'evidenceRecreatedOrOverwritten': False,
        'filesystemRepairedOrScratchDeleted': False,
        'codeGraph': 'code_explore attempted frozen Native directory; no available codegraph index. No canonical/historical graph substituted for frozen11.',
        'fallback': 'Authentic retained read/yield outputs recovered from original saved transcripts on C:, create-only files with row/timestamp/toolCall provenance.',
        'recordedFrozenSubjectHash': 'e8a558fc31049d076410c3a2c9a1d18457029550f5588bb3af0f25a09eee2a1f',
        'frozenSubjectHashRemeasured': False,
        'currentFrozenBytesCertified': False,
    },
    'latestOriginalAuditDeliveries': {
        'Native': [
            {'file': 'retained-transcript-outputs/Partial11NativeSalvage/yield-3302.json', 'meaning': 'Genuine substantive original delivery; incomplete integrated assignment.'},
            {'file': 'retained-transcript-outputs/Partial11NativeSalvage/yield-3306.json', 'meaning': 'Newest genuine original yield; provenance supplement, not complete integrated audit.'},
        ],
        'Evidence': [
            {'file': 'retained-transcript-outputs/Partial11EvidenceSalvage/yield-4068.json', 'meaning': 'Genuine substantive incomplete original audit; full authentic body recovery closes archived artifact intervals, not retroactive original review completeness.'},
            {'file': 'retained-transcript-outputs/Partial11EvidenceSalvage/yield-11482.json', 'meaning': 'Newest observed original delivery includes nulls and is not accepted as completion.'},
        ],
        'originalsAndSupplementsPreserved': True,
        'currentConsolidatedNative': NATIVE_NAME,
        'currentConsolidatedEvidence': EVIDENCE_NAME,
    },
    'deliverySettlement': {
        'verdict': 'FAILED_DELIVERY_NOT_ADMITTED',
        'Native11': {
            'recordedExit': 1,
            'recordedFailure': 'stream_error',
            'recordedElapsedSeconds': 807.30,
            'timeoutEstablished': False,
            'genuineProducerReceiptObserved': False,
            'meaning': 'Native failed delivery and thiếu genuine receipt. Transcript reasoning, source prepared, contributor reports hoặc Evidence receipt không thay thế delivery.',
        },
        'Evidence11': {
            'recordedExit': 0,
            'recordedElapsedSeconds': 745.76,
            'genuineProducerReceiptObserved': True,
            'receiptBodyReadInEachLogicalAudit': 'Full605 recorded lines including trailing blank; exact ranges/provenance in complete reports.',
            'meaning': 'Chỉ xác nhận Evidence delivery; không xác nhận combined completion hoặc source correctness.',
        },
        'combinedDeliveryComplete': False,
        'independentlyFatalEvenIfSourceWereCorrect': True,
        'receiptReconstructedOrAmended': False,
    },
    'receiptSettlement': {
        'verdict': 'GENUINE_EVIDENCE_RECEIPT_PRESENT_BUT_REQUIREMENTS_INCOMPLETE',
        'categories': native['receiptCompleteness']['discrepancies'],
        'independentEvidenceComparison': evidence['receipt']['RC11'],
        'meaning': 'RC11-01..07 là fidelity/detail/accuracy defects của delivery record, không tự động là source defect; RC11-08 là blocker missing Native delivery độc lập. Audit report không sửa hoặc bổ sung ngược receipt.',
    },
    'sourceSettlement': {
        'nativeVerdict': 'REPAIR_REQUIRED',
        'evidenceVerdict': 'REPAIR_REQUIRED',
        'remainingMechanisms': native['remainingSourceMechanisms'],
        'independentEvidenceFindings': evidence['currentSeamFindings'],
        'historicalPassUsedForCurrentSource': False,
        'newRegressionClaimedWithoutBeforeDiff': False,
        'requiredRepairScope': 'Các cơ chế dưới đây thuộc obligations lịch sử còn mở hoặc giới hạn được bound; prompt hiện tại không cấp phép sửa chúng.',
        'credits': {'Native': native['credits'], 'Evidence': evidence['credits']},
        'explicitRetractions': evidence['retractions'],
    },
    'coverageSettlement': {
        'Native': {
            'logicalAudit': 'Partial11NativeSalvage',
            'helperBodiesActuallyRead': 26,
            'callerBodiesActuallyRead': 12,
            'findingDispositions': 34,
            'attribution': 'Các same-audit actual source reads và owner additions ghi riêng trong complete report; không chuyển inventory của contributor thành full-read proof.',
            'details': native['coverage'],
            'remainingLimits': native['ownerDependencyGaps'],
        },
        'Evidence': {
            'logicalAudit': 'Partial11EvidenceSalvage',
            'helperBodiesActuallyRead': 26,
            'callerBodiesActuallyRead': 12,
            'findingDispositions': 34,
            'archivedAuditGapsRemaining': 0,
            'additionalPrimaryReads': evidence['personalPrimaryReadLog'],
            'remainingLimits': evidence['exhaustedRemainingCoverage'],
        },
        'commonMissingDependencyBodies': [
            'shared/src/education/game-schema.js',
            'shared/src/education/game-validation-utils.js',
            'shared/src/education/game-config-projection.js',
            'shared/src/education/browser/quiz-answer-controls.js',
            'shared/src/education/quiz-public-projection.js',
            'tests/e2e/pages/canvas-helper.js',
            'tests/e2e/pages/ribbon-insert-helper.js',
            'tests/e2e/pages/properties-panel-helper.js',
            'tests/e2e/pages/slide-panel-helper.js',
            'tests/e2e/pages/ribbon-tab-toolbar-helper.js',
            'tests/e2e/pages/menu-bar-dropdown-helper.js',
            'tests/e2e/pages/text-editor-prosemirror-and-find-replace-helper.js',
            'shared/src/education/card-content.js',
            'shared/src/content-safety.js',
        ],
        'missingBodyMeaning': 'Trong retention đã tìm chưa quan sát được các whole frozen11 bodies này; source extents unknown. Không suy luận source files bị mất, không coi canonical copies là frozen substitutes.',
        'branchSpecificLimits': 'Native còn exact-path alias/probe và import-boundary limits ghi riêng; không đồng nhất alias absence với implementation absence hoặc cộng thành source defects.',
        'historicalExplanationLimit': 'Một số delivered historical yields đã chứa literal line-truncated2000chars; full read không phục hồi suffix. Finding bodies nguyên bản đầy đủ và operative counsel explanations đã đọc; không giả claim byte restoration.',
        'dependencyLimit': 'node_modules junction ngoài recursive freeze; không chứng nhận full dependency immutability hoặc linked source/generated runtime equivalence.',
        'fullContractCoverageComplete': False,
        'availableAuthorizedImmediateBodyWorkExhausted': True,
        'manifestOrNullAcceptedAsCoverageProof': False,
        'independence': 'Hai nhánh không dùng contemporary sibling conclusions làm verdict. Các primary source outputs và historical authority có thể chia sẻ nhưng được đọc cá nhân và ghi provenance riêng.',
    },
    'scopeSettlement': {
        'NF_A4': native['NF_A4Scope'],
        'unconditionalKeypressRejectionProposal': native['keypressScope'],
        'meaning': 'NF-A4 giữ excluded/unresolved, không seventh repair. Passive callback/custom-binding defects không tự cấp phép policy reject mọi ineligible keypress.',
        'unauthorizedNow': ['retry/resume11', 'Correction12', 'source repairs', 'receipt reconstruction', 'caller cutover', 'canonical integration', 'smoke', 'qualification', 'merge', 'commit', 'push', 'deploy'],
        'notChanged': ['timeouts', 'retries', 'assertions', 'scoring', 'physics'],
    },
    'deferredAcceptance': native['deferredScope'],
    'canonicalIdentity': native['canonicalMappings'],
    'flags': {
        'admission': False, 'sourceReady': False, 'qualification': False,
        'PASS': False, 'runtimeExecuted': False, 'declaredCells': 54,
        'staticallyAdmittedCells': 0, 'executedAcceptanceCells': 0,
        'producerRetry': False, 'sourceModified': False,
        'receiptReconstructed': False, 'callerCutover': False,
        'smoke': False, 'merge': False, 'commit': False, 'push': False, 'deploy': False,
    },
    'sessionMethodClarification': {
        'mainReadOnlyCommandsWereRun': True,
        'commandsPurpose': 'Git identity/status; native filesystem metadata/enumeration; offline transcript parsing/extraction; report-only integrity/structural validation.',
        'noExecutionOfProjectSourceOrAcceptance': True,
        'scopeOfWorkerCommandsFalseClaims': 'Worker-local method only, not a claim that Main ran no commands. Main dispatched fresh reviewers; historical agents were not presumed alive.',
        'writeScope': 'Chỉ thư mục report mới education-partial11-settlement-20261007 trên C:. Không sửa source, existing reports, D evidence hoặc coordinator handoff.',
    },
    'realBlockers': [
        'Native11 FAILED_DELIVERY + genuine Native producer receipt thiếu, độc lập source correctness.',
        'Source REPAIR_REQUIRED: forwarding/readiness occurrence identity/order; rejected matched-packet siblings; live-root document chronology; passive callback/configured custom-binding diagnostics.',
        'Genuine Evidence receipt RC11-01..07 còn fidelity/detail/accuracy defects.',
        'Full contract coverage bị bound bởi inaccessible D evidence, missing retained dependency bodies, original truncated prose và dependency/runtime equivalence.',
        'NF-A4 và broader keypress rejection scope chưa được cấp phép;54 required acceptance cells chưa chạy.',
    ],
    'authorizationNeededNext': [
        {'action': 'Restore access / supply primary evidence read-only', 'need': 'Cung cấp khả năng đọc filesystem đúng hoặc primary frozen11 owner bodies có provenance. Diagnostic recovery không đồng nghĩa permission filesystem repair, overwrite hay regenerate evidence.'},
        {'action': 'Substantive producer continuation', 'need': 'User phải chọn riêng phương án xử lý Native failed delivery và các source obligations còn mở; cần authority mới bounded cho retry/resume11 HOẶC correction khác, giữ local8045/gemini pin. Không tự chọn ở settlement.'},
        {'action': 'Receipt delivery correction', 'need': 'Nếu cấp phép continuation thì yêu cầu genuine producer-delivered Native receipt và đầy đủ fidelity/provenance/detail của cả delivery; không reconstructed reviewer receipt.'},
        {'action': 'Scope decision', 'need': 'NF-A4 / broader keypress rejection cần explicit separate decision; không bắt buộc mở rộng và không cộng repair7.'},
        {'action': 'Later checks / cutover / qualification', 'need': 'Chỉ sau genuine combined delivery và hai independent full-source GO gates, dưới authority mới riêng. Không coi settlement này là GO.'},
    ],
    'completeAuditPayloads': {'Native': native, 'Evidence': evidence},
}

with (ROOT / 'combined-correction11-failure-settlement.json').open('x', encoding='utf-8') as stream:
    json.dump(settlement, stream, ensure_ascii=False, indent=2)

summary = '''# Combined Correction11 failure settlement — 2026-10-07

**Decision: FAILED_DELIVERY_NOT_ADMITTED; source REPAIR_REQUIRED.**

Settlement read-only đã hoàn tất trong phạm vi evidence quan sát được. Điều này **không** chứng nhận full-contract source coverage, source-ready, admission hoặc runtime PASS.

## Báo cáo cuối riêng
- `native11-complete-settlement-v2.json`
- `evidence11-complete-settlement-report.json`
- `combined-correction11-failure-settlement.json` — chứa cả hai payload và phân loại blockers.

Các report cũ, supplements, authentic yields và contributor outputs được giữ riêng, không ghi đè. Transcript được giữ theo provenance; không phải source hoặc producer receipt mới.

## Git / evidence
Coordinator: `main` / `aa19b59cd5bd5de2510f9bc4edd2ef2311ce9131`.
Education: `feat/education-gemini38-cook-261001` / `c5b5e896d9f06859b21e19122f81c7613067c386`.
Education vẫn có 12 modified + 9 untracked có sẵn, không staging; chỉ thêm thư mục report mới.

Ổ `D:` và parent directory truy cập được, nhưng `edu-resume-261004` native enumeration báo **Incorrect function**. Không kết luận evidence bị mất; không repair filesystem, regenerate hoặc overwrite. Subject hash chỉ là recorded preservation identity, không remeasured hay fresh-byte certification.

## Thu hồi và coverage
- Native original latest yield3306 là provenance supplement; yield3302 là substantive incomplete report.
- Evidence latest yield11482 chứa null, không completion; yield4068 là substantive incomplete report, nay được thu hồi toàn body.
- Mỗi logical audit đọc đủ **26 helpers +12 callers**, có **34 dispositions**; owner/governing/receipt reads được mở rộng và ghi nguồn cụ thể. Full605 Evidence receipt được đọc ở cả hai audit.
- Archived Evidence audit gaps đã đóng. Primary outputs contributor được đọc riêng, không dùng sibling conclusions.
- Missing retained dependency bodies và một số literal-truncated original historical prose vẫn bound; không claim full recursive/source-contract coverage. Dependency junction/runtime equivalence cũng chưa được chứng nhận.

## Delivery / receipt
Native11 exit1 `stream_error` sau recorded807.30s, **không timeout**; genuine Native receipt thiếu, blocker độc lập.
Evidence11 exit0 sau recorded745.76s; genuine Evidence receipt có, nhưng không thay combined delivery.
RC11-01..07 phân biệt original body fidelity, historical path provenance, current evidence, record detail, deferred scope, excluded scope và preservation-count accuracy.
RC11-08 là missing Native delivery độc lập. Không suy source defect chỉ từ receipt abbreviation; không dựng receipt.

## Source defects / credits
Còn forwarding occurrence identity qua evaluate, actual readiness observation-order, matched-packet sibling failure exposure, live-root document/error chronology, callback condition bị invoke với synthetic event và private registered-binding diagnostics.
Giữ credits: first recorder cause, guard siblings, atomic initial document, explicit phase/stable serialization all3 exposure paths, history/clock/witness, actual Page/portable ownership và late finalization.
`Reveal.isPaused` và `clickTriviaNext` false missing findings đã retracted. Keypress ở actual143;137-139 chỉ stage diagnostics.

## Scope / acceptance
**NF-A4: excluded, SOURCE_MECHANISM_CONFIRMED_SCOPE_APPLICABILITY_UNRESOLVED.** Không repair7, không repaired/disproved/waived.
Broad unconditional-keypress rejection cũng scope unresolved, không tự đổi fallback policy.
**54 declared /0 admitted /0 executed**, tất cả required/unexecuted. NC11/RPC17/original9 giữ identity; không historical PASS cho source hiện tại.

## Boundary / authority mới
Không producer invocation hoặc đổi pin `local8045/gemini-3.8-flash-high`.
Không retry/resume11, Correction12, source fix, reconstructed receipt, caller cutover, smoke/qualification, timeout/retry/assertion/scoring/physics changes; không merge/commit/push/deploy/scratch deletion.
Main chỉ chạy read-only Git/filesystem metadata và offline transcript/report integrity processing; worker `commands=false` chỉ là worker-local method.

Cần user authority mới riêng để chọn hướng xử lý failed Native delivery và source obligations; producer phải deliver genuine receipts đầy đủ. Nếu cần rộng thêm NF-A4 hoặc keypress policy phải cấp phép riêng. Checks/cutover/qualification chỉ được xem xét sau genuine combined delivery và hai independent full-source GO gates, dưới authority phù hợp mới.
'''
with (ROOT / 'combined-correction11-failure-settlement.md').open('x', encoding='utf-8') as stream:
    stream.write(summary)
print('Created combined JSON with both complete audit payloads and human-readable settlement; old files preserved.')
