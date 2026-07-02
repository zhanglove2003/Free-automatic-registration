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

### Phase 10: SmsHero Settings and Number Purchase
Status: completed
- Add a settings page for HeroSMS/SmsHero API Key and core purchase timing fields.
- Implement SMS-Activate compatible HeroSMS number purchase, 20s code wait timeout, invalid marking, and delayed cancellation support.
- Verify first success criterion with tests: purchase number through API shape, then cancel the order after the configured 3 minute delay.
- Run focused tests, full test suite, typecheck, and build.

### Phase 11: SmsHero Settings Persistence and Purchase Controls
Status: completed
- Persist SmsHero settings across app rebuild/restart without logging secrets.
- Hide service code from the Settings UI while retaining the default ChatGPT/OpenAI service code internally.
- Accept candidate countries as English names/codes, Chinese names, or SMS-Activate numeric country IDs.
- Add minimum and maximum purchase price controls; send maximum price to HeroSMS and skip countries below the configured minimum when price data is available.
- Make the 20s no-code timeout and 3 minute cancellation path observable and test-covered.
- Run focused tests, full test suite, typecheck, and build.

### Phase 12: SmsHero Country Search UI and Purchase Strategy
Status: completed
- Replace the single comma-separated country field with three candidate-country search slots in one row.
- Add autocomplete/listbox options that show Chinese name, English name, and SMS-Activate country ID.
- Keep min/max price controls in one row and add a country-order vs lowest-price strategy selector.
- Persist the three slots and strategy through existing settings save/load.
- Make `price_first` sort candidate countries by real price before purchase while keeping `country_first` order.
- Verify with failing tests first, then focused tests, full suite, typecheck, and build.

### Phase 13: SmsHero Dynamic Country Catalog and Exact Filtering
Status: completed
- Replace the temporary hard-coded country catalog with HeroSMS `getCountries`.
- Parse country records into searchable Chinese, English, numeric ID, and alias tokens.
- Re-render the country listbox from filtered results so entering `巴西` leaves only Brazil.
- Refresh the active country input after the async country catalog finishes loading.
- Verify with focused country/UI/provider tests, live `getCountries` evidence, full suite, typecheck, and build.

### Phase 14: SmsHero Settings Precision and Error Feedback
Status: completed
- Save and display SMS purchase price fields with four-decimal precision.
- Send `maxPrice` to HeroSMS with four decimal places, for example `0.0500`.
- Close all country dropdown listboxes after choosing an option so focus does not reopen the selected slot.
- Convert Electron-wrapped HeroSMS `NO_NUMBERS` errors into actionable Chinese feedback.
- Verify with focused red/green tests, full suite, typecheck, and build.

### Phase 15: SmsHero Auto Countries and All-Site Monitor
Status: completed
- Add an `自动获取` button next to Settings candidate countries.
- Fetch HeroSMS country catalog and current prices, then fill the three cheapest countries with available inventory.
- Persist the auto-filled candidate countries through the existing settings save path.
- Rename the dashboard GPT network card to `全站监控`.
- Keep GPT network connection as the first monitor item and add SmsHero balance as the second monitor item.
- Verify with focused red/green tests, full suite, typecheck, and build.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Old collaboration-doc memory path did not exist: `项目分析和合作提示` | 1 | Re-checked the current `开发提示文档` project docs before editing. |
| `C:\Users\Snow\.agents\skills\ui-ux-pro-max\scripts\search.py` missing because that install has placeholder files | 1 | Used the complete mirror at `C:\Users\Snow\.codex\skills\ui-ux-pro-max\scripts\search.py` for UI guidance. |
| `rg` regex check failed due PowerShell quote escaping around `data-country-id=\"73\"` | 1 | Re-ran as separate `rg --fixed-strings` checks for old and new UI markers. |
