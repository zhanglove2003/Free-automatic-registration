# 浏览器监控修复发现

## 2026-07-01 Screenshot Review
- Image 1: Browser session card preview shows a broken image icon in the preview area. The card has task id, URL, partition, and "查看监控 / 刷新画面" actions.
- Image 2: Clicking "查看监控" opens an in-app monitor surface, but the browser content appears partially exposed with scrollbars and insufficient vertical space.
- Image 3: Multi-browser modal shows "2" plus "个浏览器" inside a compact input-like area. User wants the label removed, manual input supported, plus/minus retained, and 0/1 rejected.
- The launch mode segmented control is white-on-white and does not communicate active state strongly enough.

## Current Root-Cause Hypotheses
- Broken preview likely comes from rendering a snapshot data URL in an `<img>` when capture fails or returns unusable image data.
- A live `WebContentsView` can be moved between card preview and expanded monitor stage; this should avoid relying on fragile image snapshots for the main preview.
- Close behavior should be explicit: card close button -> confirmation -> destroy browser session -> remove card from monitor list.

## Resolution Notes
- Preview no longer injects an `<img>` element, so failed or empty captures render a stable placeholder instead of a broken-image icon.
- The expanded monitor shell is back inside the monitor page flow instead of a fixed overlay, with a stable large stage for `WebContentsView` bounds.
- Browser session close now destroys the underlying session through IPC and removes it from snapshots.
- Multi-launch input rejects values below 2 at confirmation time and keeps plus/minus controls for quick adjustment.

## 2026-07-01 XiaoPoZhan Navigation
- The existing BrowserController and monitor IPC path already supports attaching a `WebContentsView` into the main window, so the 小破站 page can reuse that infrastructure as a named utility browser session.
- The renderer previously normalized every non-monitor page back to dashboard; adding 小破站 requires explicit page normalization so dashboard cards do not remain visible.
- The utility browser session uses the stable id `utility-xiaopozhan`, opens `https://api.snowovo.cc.cd/login`, and detaches when the user navigates away from the 小破站 page.

## 2026-07-01 XiaoPoZhan Utility Browser Separation
- Monitor cards should only list task browser sessions. Utility sessions such as `utility-xiaopozhan` are filtered from `AppSnapshot.browserSessions`.
- The 小破站 browser should not navigate back to the login URL on every resize or page revisit; existing utility sessions are reattached without reloading so cookies, local storage, and form/password-related site data can remain in the persistent partition.
- Utility sessions now use the clearer partition `persist:utility-xiaopozhan` instead of a task-style partition name.
- Browser history controls are routed through `BrowserController`, keeping Electron WebContents calls out of the renderer.

## 2026-07-01 Embedded Browser New-Window Handling
- Electron's embedded Chromium does not provide Chrome's full Google password manager/sync UX. Building comparable password saving would be a separate secure credential-manager feature and is deferred.
- Persistent partitions can keep normal site data such as cookies and local storage, but they should not be described as equivalent to Chrome password saving.
- `WebContents.setWindowOpenHandler` can deny new native windows and load http/https target URLs into the same embedded view, which matches the desired 小破站 browsing behavior.

## 2026-07-01 Embedded Browser Color Scheme Sync
- The app theme toggle only changed the renderer document's `data-theme`; embedded `WebContentsView` pages do not inherit that DOM attribute.
- Sites that use `prefers-color-scheme` need the embedded Chromium media preference updated explicitly.
- `Emulation.setEmulatedMedia` over the WebContents debugger lets each embedded browser session report the selected light/dark scheme to the page without site-specific scripts.
