# 浏览器监控修复计划

## Goal
修复当前浏览器监控体验：预览破图、查看监控显示不完整、卡片关闭确认并删除浏览器内容、多开数量可输入且限制 2 起、单/多线程切换态更明显。

## Phases

### Phase 1: Evidence and Failing Tests
Status: completed
- Inspect current screenshots and source.
- Add failing tests for the requested behavior.

### Phase 2: Browser Monitor Behavior
Status: completed
- Replace broken screenshot preview path with live embedded monitor bounds or safe non-broken fallback.
- Add card top-right close control.
- Add close confirmation and destroy browser session on confirm.
- Keep expanded monitor bounds complete and in-app.

### Phase 3: Multi-Launch Controls
Status: completed
- Remove cramped "个浏览器" label under number.
- Allow manual numeric input.
- Reject/clamp 0 and 1 to valid multi-launch minimum.
- Strengthen single/multi active visual state.

### Phase 4: Verification
Status: completed
- Run focused tests, full test suite, typecheck, and build.
- Update progress and memory.

### Phase 5: XiaoPoZhan Sidebar Browser
Status: completed
- Add a sidebar navigation entry for 小破站.
- Open `https://api.snowovo.cc.cd/login` in the built-in Chromium view.
- Reuse the existing BrowserController/Orchestrator/IPC path for the embedded browser.
- Verify focused tests, full test suite, typecheck, and build.

### Phase 6: XiaoPoZhan Utility Browser Separation
Status: completed
- Exclude the 小破站 utility browser from monitor snapshots and monitor cards.
- Keep 小破站 on a dedicated persistent Chromium partition and detach instead of destroy when leaving the page.
- Add compact back/forward/reload controls for the 小破站 browser.
- Verify focused tests, full test suite, typecheck, and build.

### Phase 7: Embedded Browser New-Window Handling
Status: completed
- Leave Chrome-style password-manager prompts out of scope for now because they require a dedicated secure credential vault/autofill design.
- Keep persistent Chromium profile behavior for cookies/localStorage/site data.
- Intercept new-window requests from embedded browser pages and open http/https links in the same WebContentsView.
- Verify focused test, full test suite, typecheck, and build.

### Phase 8: Embedded Browser Color Scheme Sync
Status: completed
- Sync app light/dark theme changes into embedded Chromium sessions.
- Make websites that follow `prefers-color-scheme` switch with the app theme.
- Apply the selected color scheme to both existing and newly created browser sessions.
- Verify focused tests, full test suite, typecheck, and build.

### Phase 9: PR Review Fixes
Status: completed
- Remove redundant color-scheme broadcasts during batch task creation.
- Prevent monitor IPC/orchestrator paths from targeting utility browser sessions.
- Preserve XiaoPoZhan page state when launching tasks from that page.
- Add direct browser handle lookup for per-session operations.
- Rework utility resize handling, renderer broadcast targeting, and CSS selector escaping.
- Verify focused tests, full test suite, typecheck, and build.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Old collaboration-doc memory path did not exist: `项目分析和合作提示` | 1 | Re-checked the current `开发提示文档` project docs before editing. |
