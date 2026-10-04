## TL;DR

**Phase04 remains NO-GO.** The failed assertion proves neither that Electron omitted CSP nor that it allowed `unsafe-eval`: no headers were captured. Keep production policy unchanged; distinguish header visibility from enforcement using correlated Electron interception logs and a CSP-respecting renderer execution probe.

Advisory only; no edits, tests, builds, formatting, or browser execution performed. Same-model counsel using `local52186/gpt-6.1-sol`, not model-family-independent review.

## Evidence versus inference

**Verified from source:**

- `electron/content-security-policy.js:5` permits inline scripts but omits `unsafe-eval`.
- `electron/content-security-policy.js:17–21` **preserves any existing CSP header**, case-insensitively. It inserts `DESKTOP_CSP` only when no such header exists. Therefore, importing this helper does not prove that the response received its default policy.
- `.tmp/phase04-electron-smoke.cjs:6–15` installs interception before navigation, targets `http://127.0.0.1:55173/*`, and sets `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`.
- `electron/main.js:99–101` uses the same interception/helper pattern for the production origin on port 3002.
- Installed package metadata identifies Electron `42.9.3`.

**Reported runtime evidence:** the compound header assertion failed; subsequent responsive checks did not execute. Earlier successful Electron gameplay remains accepted.

**[INFERENCE]** CDP may expose headers that do not reflect Electron’s interception changes. Nothing captured here establishes that explanation—or establishes a weak effective policy.

## What to do

### 1. Capture both header views without changing policy

Instrument the **existing harness callback**, not a second `onHeadersReceived` listener. Electron documents that only the last listener is used; adding another can replace enforcement.

For the target `mainFrame` response, log:

- Request ID, URL, status, resource type, and `webContentsId`.
- Incoming `details.responseHeaders`.
- The exact result of `withDesktopCsp(details.responseHeaders)` passed to `callback`.
- Case-insensitively extracted enforced CSP values and report-only CSP values, separately.

On the automation side, capture the reload response URL, status, and headers **before asserting**. Confirm that they refer to the same document/navigation.

Interpretation:

| Observation | Decision |
|---|---|
| No matching interception record | Target, filter, session, or listener mismatch; NO-GO. |
| Incoming CSP exists; helper preserves it | Inspect that policy rather than assuming `DESKTOP_CSP` was inserted. |
| Callback supplies expected CSP; CDP omits it | Header-observation discrepancy; enforcement remains unproven. |
| Callback supplies CSP containing `unsafe-eval` | The stated no-relaxation criterion fails; NO-GO. |
| CDP displays expected CSP | Useful corroboration, but still perform the execution probe. |

The callback log proves **what was supplied to Electron**, not independently what Chromium enforced.

### 2. Probe the real document without debugger CSP bypass

The [CDP `Runtime.evaluate` contract](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/js_protocol.pdl) documents `allowUnsafeEvalBlockedByCSP`, **defaulting to `true`**. An ordinary automation evaluation containing `eval()` is therefore not sufficient security evidence.

Use the existing CDP connection to the Electron page’s **default main-world execution context**, explicitly disabling that evaluation bypass:

```js
await cdp.send('Runtime.evaluate', {
  expression: 'new Function("return 17")()',
  allowUnsafeEvalBlockedByCSP: false,
  returnByValue: true,
});
```

Also probe `eval("17")` separately.

Important checks:

- Do not enable `Page.setBypassCSP`.
- Do not use an isolated-world context.
- Inspect `exceptionDetails`; a successful CDP command can return a JavaScript exception rather than reject its command promise.
- Run an ordinary function/arithmetic control in the same context. A broken context or failed command is not proof that CSP blocked evaluation.
- If the running protocol rejects the parameter, treat this method as unavailable—not as a passing security result.

### 3. Collect policy-specific enforcement evidence

Before probing, install a `securitypolicyviolation` listener on the document. Record:

```text
disposition
effectiveDirective
blockedURI
originalPolicy
documentURI
```

Require the matching evaluation violation to have:

- `disposition === "enforce"`.
- A script evaluation directive, normally `script-src`.
- `blockedURI === "eval"`.
- `originalPolicy` matching an expected enforced policy from the interception evidence.

Correlate events with the deliberate probes; do not count unrelated application violations. Wait for event delivery with a bounded deadline, not just a synchronous array inspection.

**Alternative ordinary-renderer probe:** append a temporary inline `<script>` to the actual presentation document. Inside that script, register the violation listener and schedule a **function callback** that attempts `eval()` and `new Function()`, records exceptions, and tracks execution sentinels. Schedule it after the injection command returns; automation then only reads the recorded result.

This exercises ordinary page-script execution rather than relying on debugger evaluation semantics. The default policy permits inline scripts. If the probe script itself is blocked or never starts, the result is inconclusive—not an eval-blocking pass.

### 4. Finish only the unexecuted acceptance checks

After CSP proof passes, execute the narrow responsive/touch checks skipped by the failed cell. Do not repeat the already accepted native picker or gameplay merely to reconfirm them.

## GO criteria

CSP acceptance passes only with all of:

1. Correct Electron page/navigation identified.
2. Correlated callback evidence showing the expected enforced policy without `unsafe-eval`.
3. Positive ordinary-JavaScript control.
4. Both dynamic-evaluation probes blocked, with no execution sentinel set.
5. Matching **enforced** CSP violation evidence identifying the policy.

**Phase04 overall remains NO-GO until this proof and the skipped responsive/touch checks pass.**

Do not relax CSP, add `allow-same-origin`, force replacement of an upstream policy, or reinterpret successful debugger evaluation as application permission.

## Assumptions and limits

- **High confidence:** the supplied failure is authoritative; its compound condition does not identify which operand failed.
- **Medium confidence:** the caller can issue explicit CDP commands through its existing connection. Otherwise, use the ordinary-renderer probe.
- **Version limit:** installed Electron types confirm the local debugger API; the cited CDP documentation is current, not a runtime capability observation. Check parameter support when executing.
- This harness proves the generated document in a real Electron renderer using the production CSP helper. It does **not** independently prove the full packaged application startup path.