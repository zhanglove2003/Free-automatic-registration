import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readProjectFile(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('custom frameless window chrome', () => {
  it('creates a frameless BrowserWindow and removes the native application menu', () => {
    const main = readProjectFile('src/main/main.ts');

    expect(main).toContain("import { app, BrowserWindow, Menu } from 'electron';");
    expect(main).toContain('frame: false');
    expect(main).toContain('thickFrame: false');
    expect(main).toContain('autoHideMenuBar: true');
    expect(main).toContain('resizable: true');
    expect(main).toContain('Menu.setApplicationMenu(null)');
  });

  it('uses a transparent Electron host and rounded page shell so desktop window corners are rounded', () => {
    const main = readProjectFile('src/main/main.ts');
    const html = readProjectFile('src/renderer/index.html');

    expect(main).toContain('transparent: true');
    expect(main).toContain("backgroundColor: '#00000000'");
    expect(html).toMatch(/html,\s*body\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;[^}]*background:\s*transparent;/s);
    expect(html).toMatch(/body\s*\{[^}]*background:\s*transparent;/s);
    expect(html).toMatch(/\.window\s*\{[^}]*border-radius:\s*20px;[^}]*overflow:\s*hidden;/s);
    expect(html).not.toMatch(/@media\s*\(max-width:\s*768px\)[\s\S]*?\.window\s*\{\s*border-radius:\s*0;\s*\}/);
  });

  it('does not draw outer window shadows that can leak as square artifacts over other apps', () => {
    const main = readProjectFile('src/main/main.ts');
    const html = readProjectFile('src/renderer/index.html');

    expect(main).toContain('hasShadow: false');
    expect(html).toMatch(/\.window\s*\{[^}]*box-shadow:\s*none;/s);
    expect(html).not.toContain('box-shadow: var(--shadow-window)');
  });

  it('wires custom traffic-light buttons during renderer boot', () => {
    const app = readProjectFile('src/renderer/app.ts');

    expect(app).toMatch(/async function boot\(\): Promise<void> \{\s*wireWindowControls\(\);\s*wireThemeToggle\(\);\s*wireLaunchButton\(\);/m);
    expect(app).toContain("'.tl-red'");
    expect(app).toContain('closeWindow()');
    expect(app).toContain("'.tl-yellow'");
    expect(app).toContain('minimizeWindow()');
    expect(app).toContain("'.tl-green'");
    expect(app).toContain('toggleMaximizeWindow()');
  });

  it('makes the custom titlebar draggable while keeping controls clickable', () => {
    const html = readProjectFile('src/renderer/index.html');

    expect(html).toMatch(/\.titlebar\s*\{[^}]*-webkit-app-region:\s*drag;/s);
    expect(html).toMatch(/\.traffic-lights\s*\{[^}]*-webkit-app-region:\s*no-drag;/s);
    expect(html).toMatch(/\.tl\s*\{[^}]*-webkit-app-region:\s*no-drag;/s);
  });

  it('visually separates the titlebar from the content area and rounds the sidebar content corner', () => {
    const html = readProjectFile('src/renderer/index.html');

    expect(html).toMatch(/\.titlebar\s*\{[^}]*background:\s*linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255,\s*0\.36\),\s*rgba\(255,\s*255,\s*255,\s*0\.18\)\);[^}]*border-bottom:\s*1px solid var\(--chrome-divider\);/s);
    expect(html).toMatch(/\[data-theme="dark"\]\s+\.titlebar\s*\{[^}]*background:\s*linear-gradient\(180deg,\s*rgba\(42,\s*42,\s*49,\s*0\.50\),\s*rgba\(30,\s*30,\s*36,\s*0\.28\)\);/s);
    expect(html).toMatch(/\.window-body\s*\{[^}]*background:\s*linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255,\s*0\.16\),\s*rgba\(255,\s*255,\s*255,\s*0\)\);/s);
    expect(html).toMatch(/\.sidebar\s*\{[^}]*border-top-right-radius:\s*18px;[^}]*overflow:\s*hidden;/s);
  });

  it('allows dragging the window from sidebar empty space without selecting sidebar text', () => {
    const html = readProjectFile('src/renderer/index.html');

    expect(html).toMatch(/\.sidebar\s*\{[^}]*-webkit-app-region:\s*drag;[^}]*user-select:\s*none;/s);
    expect(html).toMatch(/\.nav-item\s*\{[^}]*-webkit-app-region:\s*no-drag;[^}]*user-select:\s*none;/s);
    expect(html).toMatch(/\.sidebar-footer\s*\{[^}]*-webkit-app-region:\s*no-drag;/s);
  });

  it('marks reorderable sidebar navigation items as draggable and wires drag sorting', () => {
    const html = readProjectFile('src/renderer/index.html');
    const app = readProjectFile('src/renderer/app.ts');

    expect(html).toContain('data-nav-id="settings" draggable="true"');
    expect(html).toContain('data-nav-id="logs" draggable="true"');
    expect(html).toContain('aria-label="可排序主导航"');
    expect(html).toMatch(/\.nav-item\.is-dragging\s*\{[^}]*opacity:\s*0\.36;/s);
    expect(html).toMatch(/\.nav-item\.drag-over\s*\{[^}]*background:\s*var\(--hover\);/s);
    expect(html).toContain('.nav-drop-indicator');
    expect(app).toMatch(/async function boot\(\): Promise<void> \{\s*wireWindowControls\(\);\s*wireThemeToggle\(\);\s*wireLaunchButton\(\);\s*wireSortableSidebar\(\);/m);
    expect(app).toContain('function wireSortableSidebar(): void');
    expect(app).toContain("'.nav-items'");
    expect(app).toContain("'dragstart'");
    expect(app).toContain("'dragover'");
    expect(app).toContain('insertBefore');
  });

  it('uses a stable sidebar drop indicator instead of moving the dragged source during dragover', () => {
    const html = readProjectFile('src/renderer/index.html');
    const app = readProjectFile('src/renderer/app.ts');

    expect(app).toContain('function getSidebarDropTarget');
    expect(app).toContain('function ensureSidebarDropIndicator');
    expect(app).toContain('nav-drop-indicator');
    expect(app).toMatch(/navList\.insertBefore\(dropIndicator,\s*dropReference\);/);
    expect(app).not.toMatch(/navList\.insertBefore\(dragging,\s*shouldPlaceAfter\s*\?\s*target\.nextSibling\s*:\s*target\);/);
    expect(html).toMatch(/\.nav-drop-indicator\s*\{/s);
    expect(html).not.toMatch(/\.nav-item\.drag-over\s*\{[^}]*transform:\s*translateY\(-2px\);/s);
    expect(html).not.toContain('Sidebar nav switching');
  });

  it('hides the visible right-side scrollbar edge while keeping content scrollable', () => {
    const html = readProjectFile('src/renderer/index.html');

    expect(html).toMatch(/html, body \{[^}]*overflow:\s*hidden;/s);
    expect(html).toMatch(/\*,\s*\*::before,\s*\*::after\s*\{[^}]*scrollbar-width:\s*none;[^}]*-ms-overflow-style:\s*none;/s);
    expect(html).toMatch(/\*::-webkit-scrollbar\s*\{[^}]*display:\s*none;[^}]*width:\s*0;[^}]*height:\s*0;/s);
    expect(html).toMatch(/\.content\s*\{[^}]*overflow-y:\s*auto;[^}]*scrollbar-width:\s*none;[^}]*-ms-overflow-style:\s*none;/s);
    expect(html).toMatch(/\.content::-webkit-scrollbar\s*\{[^}]*display:\s*none;[^}]*width:\s*0;[^}]*height:\s*0;/s);
  });


  it('keeps renderer script loading cleanly for custom controls', () => {
    const html = readProjectFile('src/renderer/index.html');

    expect(html).toContain('<script type="module" src="./app.js"></script>');
    expect(html).not.toContain('</script>`n</body>');
  });

  it('removes dashboard search from the header', () => {
    const html = readProjectFile('src/renderer/index.html');

    expect(html).not.toContain('class="search"');
    expect(html).not.toContain('placeholder="搜索作业…"');
  });

  it('shows a rounded automatic GPT network status card without proxy controls', () => {
    const html = readProjectFile('src/renderer/index.html');

    expect(html).not.toContain('调度时间轴');
    expect(html).not.toContain('timeline-svg');
    expect(html).toContain('GPT 网络连接');
    expect(html).toContain('data-network-state="checking"');
    expect(html).toContain('自动检测中');
    expect(html).not.toContain('代理连接');
    expect(html).not.toContain('proxy-url');
    expect(html).not.toContain('测试连接');
    expect(html).toMatch(/--radius-card:\s*22px;/);
    expect(html).toMatch(/class="[^"]*apple-network-card[^"]*"/);
    expect(html).toMatch(/class="[^"]*apple-status-pill[^"]*"/);
    expect(html).toMatch(/class="[^"]*apple-status-icon[^"]*"/);
    expect(html).toMatch(/class="[^"]*apple-status-detail[^"]*"/);
    expect(html).toMatch(/\.apple-network-card\s*\{[^}]*border-radius:\s*24px;[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.72\);/s);
    expect(html).toMatch(/\.apple-status-pill\s*\{[^}]*border-radius:\s*999px;/s);
    expect(html).toMatch(/\.apple-status-icon\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
  });

  it('uses an Apple-style primary launch control with restrained motion', () => {
    const html = readProjectFile('src/renderer/index.html');

    expect(html).toContain('启动任务');
    expect(html).toContain('class="nav-item nav-launch apple-launch"');
    expect(html).toContain('class="apple-launch-symbol"');
    expect(html).toMatch(/\.nav-launch\s*\{[^}]*width:\s*60px;[^}]*height:\s*72px;[^}]*border-radius:\s*22px;/s);
    expect(html).toMatch(/\.apple-launch-symbol\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;[^}]*border-radius:\s*50%;/s);
    expect(html).toMatch(/\.nav-launch:hover\s*\{[^}]*transform:\s*translateY\(-1px\);/s);
    expect(html).toMatch(/\.nav-launch:focus-visible\s*\{[^}]*outline:\s*3px solid/s);
  });

  it('adapts Apple-style launch and network controls for dark mode', () => {
    const html = readProjectFile('src/renderer/index.html');

    expect(html).toMatch(/\[data-theme="dark"\]\s+\.nav-launch\s*\{[^}]*background:\s*rgba\(44,\s*44,\s*50,\s*0\.72\);[^}]*border:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.14\);/s);
    expect(html).toMatch(/\[data-theme="dark"\]\s+\.nav-launch:hover\s*\{[^}]*background:\s*rgba\(58,\s*58,\s*66,\s*0\.84\);/s);
    expect(html).toMatch(/\[data-theme="dark"\]\s+\.nav-launch\s+\.nav-label\s*\{[^}]*color:\s*rgba\(246,\s*247,\s*251,\s*0\.92\);/s);
    expect(html).toMatch(/\[data-theme="dark"\]\s+\.apple-network-card\s*\{[^}]*background:\s*rgba\(38,\s*38,\s*44,\s*0\.72\);[^}]*border:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.12\);/s);
    expect(html).toMatch(/\[data-theme="dark"\]\s+\.apple-status-icon\s*\{[^}]*background:\s*linear-gradient\(180deg,\s*rgba\(10,\s*132,\s*255,\s*0\.24\),\s*rgba\(10,\s*132,\s*255,\s*0\.10\)\);/s);
    expect(html).toMatch(/\[data-theme="dark"\]\s+\.apple-status-pill\s*\{[^}]*color:\s*#8EC5FF;[^}]*background:\s*rgba\(10,\s*132,\s*255,\s*0\.16\);/s);
    expect(html).toMatch(/\[data-theme="dark"\]\s+\.network-overview\[data-network-state="ok"\]\s+\.apple-status-pill\s*\{[^}]*color:\s*#7EE08E;[^}]*background:\s*rgba\(52,\s*199,\s*89,\s*0\.16\);/s);
    expect(html).toMatch(/\[data-theme="dark"\]\s+\.network-overview\[data-network-state="error"\]\s+\.apple-status-pill\s*\{[^}]*color:\s*#FF9F98;[^}]*background:\s*rgba\(255,\s*69,\s*58,\s*0\.16\);/s);
  });


  it('uses a CommonJS preload runtime so Electron exposes the window control API', () => {
    const main = readProjectFile('src/main/main.ts');
    const preload = readProjectFile('src/preload/preload.cjs');
    const copyAssets = readProjectFile('scripts/copy-assets.mjs');

    expect(main).toContain("../preload/preload.cjs");
    expect(preload).toContain("const { contextBridge, ipcRenderer } = require('electron');");
    expect(preload).toContain("contextBridge.exposeInMainWorld('registrationApp', api);");
    expect(copyAssets).toContain("src/preload/preload.cjs");
  });


  it('automatically checks network through preload and IPC without proxy input', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const preload = readProjectFile('src/preload/preload.cjs');
    const app = readProjectFile('src/renderer/app.ts');
    const network = readProjectFile('src/main/network/gptNetwork.ts');

    expect(ipc).toContain("ipcMain.handle('network:check'");
    expect(ipc).toContain('checkGptNetwork');
    expect(preload).toContain("checkNetwork: () => ipcRenderer.invoke('network:check')");
    expect(app).toContain('startAutomaticNetworkCheck();');
    expect(app).not.toContain('wireProxyCheck();');
    expect(app).not.toContain("'.proxy-test-btn'");
    expect(app).toContain('checkNetwork');
    expect(app).toContain("'.apple-status-pill-text'");
    expect(network).not.toContain("'direct://'");
  });

  it('provides a settings page for SmsHero API key and purchase timing', () => {
    const html = readProjectFile('src/renderer/index.html');
    const app = readProjectFile('src/renderer/app.ts');
    const ipc = readProjectFile('src/main/ipc.ts');
    const preloadTs = readProjectFile('src/preload/preload.ts');
    const preloadCjs = readProjectFile('src/preload/preload.cjs');

    expect(html).toContain('data-page="settings"');
    expect(html).toContain('data-settings-form');
    expect(html).toContain('name="smsApiKey"');
    expect(html).not.toContain('name="smsServiceCode"');
    expect(html).not.toContain('name="smsCountries"');
    expect(html).toContain('data-country-slot="0"');
    expect(html).toContain('data-country-slot="1"');
    expect(html).toContain('data-country-slot="2"');
    expect(html).toContain('name="smsCountry0"');
    expect(html).toContain('name="smsCountry1"');
    expect(html).toContain('name="smsCountry2"');
    expect(html).toContain('data-country-listbox');
    expect(html).toContain('data-sms-auto-countries');
    expect(html).toContain('自动获取');
    expect(html).toContain('role="listbox"');
    expect(html).not.toContain('data-country-id="73"');
    expect(html).not.toContain('data-country-id="151"');
    expect(html).toContain('name="smsCodeTimeoutSeconds"');
    expect(html).toContain('name="smsCancelDelayMinutes"');
    expect(html).toContain('settings-country-row');
    expect(html).toContain('settings-price-row');
    expect(html).toContain('name="smsMinPrice"');
    expect(html).toContain('name="smsMaxPrice"');
    expect(html).toMatch(/name="smsMaxPrice"[^>]*step="0\.0001"/);
    expect(html).toContain('最低购买价格');
    expect(html).toContain('最高购买价格');
    expect(html).toContain('name="smsSelectionStrategy"');
    expect(html).toContain('value="country_first"');
    expect(html).toContain('value="price_first"');
    expect(html).toContain('国家顺序优先');
    expect(html).toContain('低价格优先');
    expect(html).toContain('保存接码设置');
    expect(html).toContain('data-sms-test-purchase');
    expect(html).toContain('测试购买号码');
    expect(app).toContain('wireSettingsForm();');
    expect(app).toContain('wireCountrySearchFields();');
    expect(app).toContain('loadSmsCountries();');
    expect(app).toContain('autoFillCheapestSmsCountries');
    expect(app).toContain('getSmsCountries');
    expect(app).toContain('getCheapestSmsCountries');
    expect(app).toContain('filterSmsCountries');
    expect(app).toContain('hideAllCountryOptions();');
    expect(app).toContain('input.focus({ preventScroll: true });');
    expect(app).toContain('document.activeElement === input');
    expect(app).toContain('data-country-id="${escapeHtml(country.id)}"');
    expect(app).not.toContain('option.hidden = !visible');
    expect(ipc).toContain("ipcMain.handle('sms:countries'");
    expect(ipc).toContain("ipcMain.handle('sms:autoCountries'");
    expect(preloadTs).toContain("getSmsCountries: () => ipcRenderer.invoke('sms:countries')");
    expect(preloadTs).toContain("getCheapestSmsCountries: () => ipcRenderer.invoke('sms:autoCountries')");
    expect(preloadCjs).toContain("getSmsCountries: () => ipcRenderer.invoke('sms:countries')");
    expect(preloadCjs).toContain("getCheapestSmsCountries: () => ipcRenderer.invoke('sms:autoCountries')");
    expect(app).toContain('renderSettings(snapshot.settings);');
    expect(app).toContain('updateSettings(nextSettings)');
    expect(app).toContain('readCountrySlotInputs()');
    expect(app).toContain('nextSettings.sms.selectionStrategy');
    expect(app).toContain('testSmsPurchase()');
    expect(app).not.toContain('smsServiceCode');
  });

  it('turns the dashboard monitor card into all-site monitoring with GPT and SmsHero balance cards', () => {
    const html = readProjectFile('src/renderer/index.html');
    const app = readProjectFile('src/renderer/app.ts');
    const ipc = readProjectFile('src/main/ipc.ts');
    const preloadTs = readProjectFile('src/preload/preload.ts');

    expect(html).toContain('全站监控');
    expect(html).toContain('data-component="All Site Monitor"');
    expect(html).toContain('data-monitor-card="gpt-network"');
    expect(html).toContain('GPT 网络连接');
    expect(html).toContain('data-monitor-card="sms-balance"');
    expect(html).toContain('接码平台余额');
    expect(html).toContain('data-sms-balance-state="checking"');
    expect(app).toContain('startSmsBalanceCheck();');
    expect(app).toContain('setSmsBalanceStatus');
    expect(ipc).toContain("ipcMain.handle('sms:balance'");
    expect(preloadTs).toContain("getSmsBalance: () => ipcRenderer.invoke('sms:balance')");
  });

  it('registers the app renderer window explicitly for snapshot broadcasts', () => {
    const main = readProjectFile('src/main/main.ts');
    const ipc = readProjectFile('src/main/ipc.ts');

    expect(main).toContain("import { registerAppRendererWindow, registerIpc } from './ipc.js';");
    expect(main).toContain('registerAppRendererWindow(mainWindow);');
    expect(ipc).toContain('const appRendererWebContentsIds = new Set<number>();');
    expect(ipc).toContain('export function registerAppRendererWindow(window: BrowserWindow): void');
    expect(ipc).toContain('const webContentsId = window.webContents.id;');
    expect(ipc).toContain('appRendererWebContentsIds.add(webContentsId);');
    expect(ipc).toContain('appRendererWebContentsIds.delete(webContentsId);');
    expect(ipc).toContain('appRendererWebContentsIds.has(window.webContents.id)');
    expect(ipc).not.toContain('appRendererWebContentsIds.delete(window.webContents.id)');
    expect(ipc).not.toContain("getURL().includes('/renderer/index.html')");
  });

});
