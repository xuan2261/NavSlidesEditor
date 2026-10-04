# Phase 04 hydration failure counsel

- Source: `artifact://1036`, settled `proc://bg_127`, session `01a0fbca-d533-7000-8362-6a5a38611b45`.
- Counsel: installed Kongming, explicitly pinned `local52186/gpt-6.1-sol`; independent context, not model-family independence. Read-only; no test/build/lint runs.
- Verdict: GO for fixture repair; NO-GO for production rollback or weakening identity/privacy guards.
- Diagnosis: installed JSDOM 21.1.2 exposes `crypto.getRandomValues` but no `crypto.randomUUID`; fresh host-session creation calls `randomUUID` before creating its `/games` socket. Existing helper supplies no UUID API. Host controls appear before session creation and do not by themselves prove readiness.
- Coordinator capability probe: exit 0; `{ "jsdom": "21.1.2", "randomUUID": "undefined", "getRandomValues": "function" }`. Prior failed GREEN remains the reproduction; it was not rerun merely to confirm failure.
- Repair: supply real `node:crypto.randomUUID` in the existing document helper, wait for two actual game sockets in valid cases, assert disabled-before-join/enabled-after-join controls and independently addressed commands. Strengthen disconnect and deferred late-bootstrap cases. Keep the real generated IIFE and all generation/revision/tuple/public-config mismatch guards.
- Required next proof: rerun the three affected suites after the repair, then continue actual hosted/file/native runtime acceptance. No Phase 04 completion claim yet.
