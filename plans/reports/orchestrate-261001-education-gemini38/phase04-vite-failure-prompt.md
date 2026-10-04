# Kongming — Phase04 actual editor failed smoke

Advisory only; installed Kongming role appended at launch. User authorized full cook --auto --advice --tdd, temporarily excludes Gemini; no commit/push/deploy. Explicit local52186/gpt-6.1-sol; independent context, not model-family independence. Cwd C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001. No edits/tests/build/lint/formatters/nested agents.

Actual browser before reload showed inert authored Name Picker but no Try control. Reloaded existing isolated Vite editor http://127.0.0.1:55173/editor/e10d985a-1d9f-4102-a561-6527e0efe674 for current Phase04 smoke. Page now shows React error boundary, exact body:
```
Something went wrong
The requested module '/@fs/C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001/shared/src/education/config-serialization.js' does not provide an export named 'escapeInlineScript'
Try Again
Reload Page
```
Actual pageerror matches that SyntaxError. This is not merely a locator readiness failure. No production edits since observation. npm run vendor succeeded and actual generated-IIFE hydration/native/generated unit suites pass 15/15. Existing dev Vite was launched before new Phase04 graph; server remains running with isolated data on API34102, Vite55173. Earlier phase03 optimizer incident was repaired with verified workspace entrypoints, inspect current client/vite.config.js rather than guessing.

Current files introduced include shared/src/education/config-serialization.js (CommonJS), browser/mount.js (CommonJS), client/src/components/education/native-game-try-adapter.jsx importing mount and serialization via deep workspace path, shared/src/index.js exports, htmlGenerator.js imports/consumer. Inspect actual source/optimizer configuration and determine whether fresh dependency optimization suffices or entrypoint integration must change. Keep same native runtime, no second ESM implementation, no inline duplicated helpers, no weaken CSP/no React gameplay substitute. Recommend minimal root repair, fresh real-editor Try + generated smoke verification and remaining import risks. <=1000 words, GO/NO-GO; no claimed runtime verification.
