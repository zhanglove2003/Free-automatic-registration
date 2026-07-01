# Embedded Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder browser controller with a real Electron Chromium session layer.

**Architecture:** `src/main/browser/browserController.ts` owns hidden Electron `BrowserWindow` sessions keyed by task id. The controller exposes session creation, navigation, screenshot capture, and cleanup behind a small interface so orchestrator/site-adapter code does not depend directly on Electron.

**Tech Stack:** Electron `BrowserWindow`, TypeScript, Vitest.

---

### Task 1: Browser Controller Contract

**Files:**
- Modify: `软件源码/src/main/browser/browserController.ts`
- Create: `软件源码/tests/browserController.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests for:
- `createSession()` creates a hidden Chromium window with a task-scoped persistent partition.
- `createSession(taskId, url)` navigates to the initial URL.
- `navigate(handle, url)` loads a later URL on the same session.
- `snapshot(handle)` returns PNG bytes from `capturePage`.
- `destroySession(handle)` closes and unregisters the window, and repeated destroy is harmless.

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/browserController.test.ts`

Expected: FAIL because the current placeholder controller does not create windows or expose navigation.

- [ ] **Step 3: Implement minimal controller**

Update `ElectronBrowserController` to accept an optional window factory for tests, keep an internal `Map`, and use secure hidden `BrowserWindow` options:
- `show: false`
- `autoHideMenuBar: true`
- `webPreferences.partition = persist:task-${taskId}`
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`

- [ ] **Step 4: Verify green**

Run: `npm test -- tests/browserController.test.ts`

Expected: PASS.

### Task 2: Project Verification

**Files:**
- No new source files beyond Task 1.

- [ ] **Step 1: Run focused browser tests**

Run: `npm test -- tests/browserController.test.ts`

- [ ] **Step 2: Run full unit tests**

Run: `npm test`

- [ ] **Step 3: Run type checking**

Run: `npm run typecheck`

- [ ] **Step 4: Run production build**

Run: `npm run build`

### Self-Review

- Scope is limited to the reusable embedded Chromium session layer.
- Registration scripts, captcha solving, OAuth token harvesting, and external service integrations are intentionally outside this plan.
- The plan preserves existing user edits in renderer/task/orchestrator files.
