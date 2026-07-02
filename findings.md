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

## 2026-07-01 PR Review Fixes
- `BrowserController.createSession` already applies the controller's current color scheme, so Orchestrator should not call `setColorScheme` once per task in a batch.
- Monitor operations must reject `utility-*` task ids so renderer bugs or forged IPC calls cannot attach/destroy the XiaoPoZhan utility browser through monitor channels.
- Starting a registration job from the XiaoPoZhan page should not navigate away from that page; otherwise the dedicated browser is detached while the user may be mid-login.
- `WebContentsView` popup interception cannot await navigation in `setWindowOpenHandler`, so the requested URL is recorded before `loadURL` resolves.
- Snapshot broadcasting should target explicitly registered app renderer windows rather than relying on a fragile URL substring.

## 2026-07-01 SmsHero Settings and Purchase
- Current settings schema already has `sms.apiKey`, `baseUrl`, `serviceCode`, `candidateCountries`, polling, timeout, and max attempts fields, but the renderer has no settings page content.
- `HeroSmsProvider` is still a skeleton that throws `ComplianceBoundaryError`; it needs a testable SMS-Activate compatible implementation.
- Project docs specify HeroSMS as SMS-Activate compatible: `getNumber`, `getStatus`, and `setStatus`; status `8` cancels, status `6` completes, and status `3` requests resend.
- User's first verification target is purchase success through the API, followed by cancellation after 3 minutes. The 20 second no-code condition should mark the number invalid before scheduling the delayed cancel.
- UI guidance from ui-ux-pro-max: use visible labels, clear inline feedback, touch/click targets at least 44px high, semantic success/error states, and consistent light/dark contrast.

## 2026-07-01 SmsHero Persistence and Cancellation Follow-up
- User reported settings save does not survive rebuild/reopen; current `Orchestrator` initializes with `defaultSettings()` and IPC `saveSettings` only updates memory, so persistence is missing.
- Service code is an internal site adapter/provider default and should not be exposed in the Settings page for ordinary users.
- Candidate country input should support English, Chinese, or numeric IDs. Existing provider only maps a few English aliases.
- Price controls should include minimum and maximum purchase price. HeroSMS/SMS-Activate compatible `getNumber` supports `maxPrice`; minimum price should be enforced by checking price data where available before attempting purchase.
- Cancellation currently runs in an unobservable background promise; release failures are swallowed by `.catch(() => undefined)`, which makes "3 minutes did not cancel" hard to diagnose.

## 2026-07-01 SmsHero Country Search UI Follow-up
- Project docs already require FR-17: three country candidates plus `country_first` / `price_first` strategy.
- Current renderer still has one `name="smsCountries"` comma-separated text input, so it cannot show per-slot search dropdown entries with Chinese name, English name, and SMS-Activate ID.
- Current renderer does not write `sms.selectionStrategy` from the settings form even though the shared settings schema already supports it.
- Current provider filters countries below `minPrice`, but `price_first` does not yet reorder countries by current `getPrices` cost.
- UI guidance: keep form labels visible, use listbox/option semantics for country search, and keep related numeric controls in stable row containers.

## 2026-07-01 SmsHero Dynamic Country Catalog Follow-up
- The real HeroSMS country catalog is available without an API key at `https://hero-sms.com/stubs/handler_api.php?action=getCountries`.
- A live check returned 196 countries; Brazil is `{ id: 73, eng: "Brazil", chn: "巴西" }` and Chile is `{ id: 151, eng: "Chile", chn: "智利" }`.
- The prior `COUNTRY_CATALOG` approach was only a temporary hard-coded subset and cannot satisfy Chinese/English/ID search across the platform country list.
- Using `option.hidden = !visible` is fragile here because `.country-search-option { display: grid; }` can override the browser's hidden default. Re-rendering the listbox with only filtered matches is the safer behavior.
- The renderer should refresh the focused country input once the async HeroSMS country list arrives, so fast typing immediately after opening Settings does not leave an empty or stale dropdown.

## 2026-07-01 SmsHero Settings Precision and Error Feedback
- Price input step was still `0.01`, which made the Settings UI behave like two-decimal money input. HeroSMS prices need four-decimal support such as `0.0456`.
- Rendering saved numeric prices with `String(value)` turns `0.0500` into `0.05`; use a dedicated four-decimal display formatter instead.
- Country option selection hid the current listbox before calling `input.focus()`. When the option button had focus, focusing the input could trigger the input focus handler and reopen the dropdown. Close all dropdowns after focusing the selected input.
- Electron wraps thrown IPC errors as `Error invoking remote method ...`; showing that raw message makes expected HeroSMS inventory failures look like application crashes.
- `NO_NUMBERS` means the selected countries have no available inventory under the current constraints. The UI should tell the user to change countries, raise max price, or retry later instead of showing raw country IDs.

## 2026-07-02 SmsHero Auto Countries and All-Site Monitor
- The Settings page already has dynamic HeroSMS country catalog support, so the `自动获取` action can reuse `getCountries` plus `getPrices` instead of adding another static country table.
- `getPrices` data includes service-level `cost` and `count`; auto-fill should ignore countries with `count <= 0` and sort by ascending cost.
- Auto-filled countries should be written through the existing settings update path so they survive rebuild/reopen.
- The existing dashboard GPT network card is a good visual container for broader service health. Renaming it to `全站监控` and nesting two monitor items keeps the right rail compact.
- SmsHero balance uses the SMS-Activate compatible `getBalance` action and should show `未配置` when no API key is saved instead of surfacing a request error.
