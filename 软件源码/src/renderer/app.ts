import type { BrowserMonitorBounds, RegistrationAppApi } from '../preload/preload.js';
import type { AppSnapshot, RegistrationTask } from '../main/domain/models.js';

declare global {
  interface Window {
    registrationApp?: RegistrationAppApi;
  }
}

const statusLabel: Record<RegistrationTask['status'], string> = {
  queued: '排队',
  running: '运行中',
  waiting: '等待中',
  ready: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

const XIAOPOZHAN_SESSION_ID = 'xiaopozhan';
const XIAOPOZHAN_URL = 'https://api.snowovo.cc.cd/login';

let launchMode: 'single' | 'multi' = 'single';
let multiLaunchCount = 2;
let pendingBrowserCloseTaskId: string | null = null;
let liveBrowserMonitorTaskId: string | null = null;
let xiaoPoZhanBrowserOpen = false;

async function boot(): Promise<void> {
  wireWindowControls();
  wireThemeToggle();
  wireLaunchButton();
  wireSortableSidebar();
  wireLaunchModeToggle();
  wireMultiLaunchModal();
  wireBrowserMonitorActions();
  wireLiveBrowserMonitor();
  wireBrowserCloseConfirmModal();
  wireXiaoPoZhanBrowserControls();
  window.addEventListener('resize', () => {
    void refreshLiveBrowserBounds();
    void refreshXiaoPoZhanBrowserBounds();
  });
  startAutomaticNetworkCheck();
  const snapshot = await window.registrationApp?.snapshot();
  if (snapshot) {
    renderSnapshot(snapshot);
  }
  window.registrationApp?.onSnapshot(renderSnapshot);
}

function wireWindowControls(): void {
  document.querySelector<HTMLButtonElement>('.tl-red')?.addEventListener('click', () => window.registrationApp?.closeWindow());
  document.querySelector<HTMLButtonElement>('.tl-yellow')?.addEventListener('click', () => window.registrationApp?.minimizeWindow());
  document.querySelector<HTMLButtonElement>('.tl-green')?.addEventListener('click', () => window.registrationApp?.toggleMaximizeWindow());
}

function wireThemeToggle(): void {
  const toggle = document.querySelector<HTMLButtonElement>('.theme-toggle');
  const root = document.documentElement;
  if (!toggle) return;

  const current = readAppTheme(root);
  root.setAttribute('data-theme', current);
  updateThemeToggleLabel(toggle, current);
  void setBrowserColorScheme(current);

  toggle.addEventListener('click', () => {
    const next = readAppTheme(root) === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    updateThemeToggleLabel(toggle, next);
    void setBrowserColorScheme(next);
  });
}

function readAppTheme(root: HTMLElement): 'light' | 'dark' {
  return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function updateThemeToggleLabel(toggle: HTMLButtonElement, scheme: 'light' | 'dark'): void {
  toggle.setAttribute('aria-label', scheme === 'light' ? '切换到黑夜模式' : '切换到白天模式');
}

async function setBrowserColorScheme(scheme: 'light' | 'dark'): Promise<void> {
  await window.registrationApp?.setBrowserColorScheme?.(scheme);
}

function wireLaunchButton(): void {
  const button = document.querySelector<HTMLButtonElement>('.nav-launch');
  button?.addEventListener('click', async () => {
    if (launchMode === 'multi') {
      showMultiLaunchModal();
      return;
    }
    await startLaunch(1);
  });
}

function wireLaunchModeToggle(): void {
  const toggle = document.querySelector<HTMLElement>('.launch-mode-toggle');
  toggle?.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-launch-mode]');
    if (!button) return;
    const mode = button.dataset.launchMode === 'multi' ? 'multi' : 'single';
    setLaunchMode(mode);
  });
  setLaunchMode(launchMode);
}

function wireMultiLaunchModal(): void {
  const modal = document.querySelector<HTMLElement>('.multi-launch-modal');
  if (!modal) return;

  modal.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    if (target === modal || target?.closest('[data-modal-close]')) {
      hideMultiLaunchModal();
      return;
    }

    const countButton = target?.closest<HTMLButtonElement>('[data-multi-count]');
    if (countButton) {
      const delta = Number(countButton.dataset.multiCount);
      setMultiLaunchCount(multiLaunchCount + delta);
      return;
    }

    if (target?.closest('[data-multi-confirm]')) {
      const count = readMultiLaunchCount();
      if (count === null) return;
      hideMultiLaunchModal();
      void startLaunch(count);
    }
  });

  modal.addEventListener('input', (event) => {
    const input = (event.target as Element | null)?.closest<HTMLInputElement>('.multi-count-input');
    if (!input) return;
    const count = readMultiLaunchCount();
    if (count !== null) {
      multiLaunchCount = count;
    }
  });

  modal.addEventListener('change', () => {
    const count = readMultiLaunchCount();
    if (count === null) {
      setMultiLaunchCount(2);
      return;
    }
    setMultiLaunchCount(count);
  });
}

function setLaunchMode(mode: 'single' | 'multi'): void {
  launchMode = mode;
  document.querySelectorAll<HTMLButtonElement>('[data-launch-mode]').forEach((button) => {
    const active = button.dataset.launchMode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function setMultiLaunchCount(count: number): void {
  multiLaunchCount = Math.min(8, Math.max(2, Math.round(count)));
  const input = document.querySelector<HTMLInputElement>('.multi-count-input');
  if (input) input.value = String(multiLaunchCount);
  showMultiLaunchValidation('');
}

function readMultiLaunchCount(): number | null {
  const input = document.querySelector<HTMLInputElement>('.multi-count-input');
  const value = Number(input?.value ?? multiLaunchCount);
  if (!Number.isFinite(value) || value < 2) {
    showMultiLaunchValidation('多开数量至少为 2');
    return null;
  }
  if (value > 8) {
    showMultiLaunchValidation('');
    return 8;
  }
  showMultiLaunchValidation('');
  return Math.round(value);
}

function showMultiLaunchValidation(message: string): void {
  const error = document.querySelector<HTMLElement>('.multi-count-error');
  const input = document.querySelector<HTMLInputElement>('.multi-count-input');
  if (error) {
    error.textContent = message;
    error.hidden = message.length === 0;
  }
  input?.classList.toggle('is-invalid', message.length > 0);
}

function showMultiLaunchModal(): void {
  setMultiLaunchCount(multiLaunchCount);
  const modal = document.querySelector<HTMLElement>('.multi-launch-modal');
  if (!modal) return;
  modal.hidden = false;
  modal.querySelector<HTMLButtonElement>('[data-multi-confirm]')?.focus();
}

function hideMultiLaunchModal(): void {
  const modal = document.querySelector<HTMLElement>('.multi-launch-modal');
  if (modal) modal.hidden = true;
}

async function startLaunch(count: number): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>('.nav-launch');
  if (button) button.disabled = true;
  try {
    await window.registrationApp?.createJob({ count, site: 'chatgpt-openai' });
    showPageById('monitor');
  } finally {
    if (button) button.disabled = false;
  }
}

function wireSortableSidebar(): void {
  const navList = document.querySelector<HTMLElement>('.nav-items');
  if (!navList) return;
  let draggingItem: HTMLElement | null = null;
  let dropIndicator: HTMLElement | null = null;
  let lastDropReference: ChildNode | null | undefined;

  navList.addEventListener('click', (event) => {
    const item = (event.target as Element | null)?.closest<HTMLElement>('.nav-item[data-nav-id]');
    if (!item) return;
    setActiveSidebarItem(item);
    showPageById(item.dataset.navId ?? 'dashboard');
  });

  navList.addEventListener('dragstart', (event) => {
    const item = (event.target as Element | null)?.closest<HTMLElement>('.nav-item[data-nav-id]');
    if (!item || item.getAttribute('draggable') !== 'true') return;
    draggingItem = item;
    dropIndicator = null;
    lastDropReference = undefined;
    item.classList.add('is-dragging');
    navList.classList.add('is-reordering');
    event.dataTransfer?.setData('text/plain', item.dataset.navId ?? '');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  });

  navList.addEventListener('dragover', (event) => {
    if (!draggingItem) return;

    const dropTarget = getSidebarDropTarget(event, navList, draggingItem);
    if (!dropTarget) return;

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    navList.querySelectorAll<HTMLElement>('.nav-item.drag-over').forEach((item) => {
      item.classList.toggle('drag-over', item === dropTarget.target);
    });
    dropTarget.target.classList.add('drag-over');

    dropIndicator ??= ensureSidebarDropIndicator(navList);
    const dropReference = dropTarget.dropReference;
    if (dropReference === dropIndicator || lastDropReference === dropReference) return;
    navList.insertBefore(dropIndicator, dropReference);
    lastDropReference = dropReference;
  });

  navList.addEventListener('drop', (event) => {
    event.preventDefault();
    if (draggingItem && dropIndicator?.parentElement === navList) {
      navList.insertBefore(draggingItem, dropIndicator);
    }
    clearSidebarDragState(navList);
    draggingItem = null;
    dropIndicator = null;
    lastDropReference = undefined;
  });

  navList.addEventListener('dragend', () => {
    clearSidebarDragState(navList);
    draggingItem = null;
    dropIndicator = null;
    lastDropReference = undefined;
  });
}

function wireBrowserMonitorActions(): void {
  const list = document.querySelector<HTMLElement>('.browser-monitor-list');
  list?.addEventListener('click', async (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button[data-browser-action]');
    if (!button) return;

    const taskId = button.dataset.taskId;
    if (!taskId) return;

    if (button.dataset.browserAction === 'request-close') {
      requestBrowserClose(taskId);
      return;
    }

    button.disabled = true;
    try {
      if (button.dataset.browserAction === 'open') {
        await showLiveBrowserMonitor(taskId);
      } else if (button.dataset.browserAction === 'refresh') {
        await refreshBrowserPreview(taskId);
      }
    } finally {
      button.disabled = false;
    }
  });
}

function wireLiveBrowserMonitor(): void {
  const lightbox = document.querySelector<HTMLElement>('.browser-monitor-lightbox');
  if (!lightbox) return;

  lightbox.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    if (target === lightbox || target?.closest('[data-browser-monitor-close]')) {
      void hideLiveBrowserMonitor();
      return;
    }
    if (target?.closest('[data-browser-monitor-refresh]')) {
      void refreshLiveBrowserBounds();
    }
  });
}

function wireBrowserCloseConfirmModal(): void {
  const modal = document.querySelector<HTMLElement>('.browser-close-confirm-modal');
  if (!modal) return;

  modal.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    if (target === modal || target?.closest('[data-browser-close-cancel]')) {
      hideBrowserCloseConfirmModal();
      return;
    }
    if (target?.closest('[data-browser-close-confirm]')) {
      void confirmBrowserClose();
    }
  });
}

function wireXiaoPoZhanBrowserControls(): void {
  const toolbar = document.querySelector<HTMLElement>('.xiaopozhan-browser-toolbar');
  toolbar?.addEventListener('click', async (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-xiaopozhan-action]');
    if (!button) return;

    button.disabled = true;
    try {
      if (button.dataset.xiaopozhanAction === 'back') {
        await window.registrationApp?.goUtilityBrowserBack?.(XIAOPOZHAN_SESSION_ID);
      } else if (button.dataset.xiaopozhanAction === 'forward') {
        await window.registrationApp?.goUtilityBrowserForward?.(XIAOPOZHAN_SESSION_ID);
      } else if (button.dataset.xiaopozhanAction === 'reload') {
        await window.registrationApp?.reloadUtilityBrowser?.(XIAOPOZHAN_SESSION_ID);
      }
    } finally {
      button.disabled = false;
      await refreshXiaoPoZhanBrowserBounds();
    }
  });
}

function requestBrowserClose(taskId: string): void {
  pendingBrowserCloseTaskId = taskId;
  const modal = document.querySelector<HTMLElement>('.browser-close-confirm-modal');
  if (!modal) return;
  const title = modal.querySelector<HTMLElement>('.browser-close-confirm-title');
  if (title) title.textContent = '是否关闭该浏览器监控';
  modal.hidden = false;
  modal.querySelector<HTMLButtonElement>('[data-browser-close-confirm]')?.focus();
}

async function confirmBrowserClose(): Promise<void> {
  const taskId = pendingBrowserCloseTaskId;
  if (!taskId) return;
  const confirmButton = document.querySelector<HTMLButtonElement>('[data-browser-close-confirm]');
  if (confirmButton) confirmButton.disabled = true;
  try {
    if (liveBrowserMonitorTaskId === taskId) {
      await hideLiveBrowserMonitor();
    }
    await window.registrationApp?.destroyBrowserMonitor?.(taskId);
    hideBrowserCloseConfirmModal();
  } finally {
    if (confirmButton) confirmButton.disabled = false;
  }
}

function hideBrowserCloseConfirmModal(): void {
  pendingBrowserCloseTaskId = null;
  const modal = document.querySelector<HTMLElement>('.browser-close-confirm-modal');
  if (modal) modal.hidden = true;
}

interface SidebarDropTarget {
  target: HTMLElement;
  dropReference: ChildNode | null;
}

function getSidebarDropTarget(event: DragEvent, navList: HTMLElement, draggingItem: HTMLElement): SidebarDropTarget | null {
  const target = (event.target as Element | null)?.closest<HTMLElement>('.nav-item[data-nav-id]');
  if (!target || target === draggingItem || !navList.contains(target)) return null;

  const rect = target.getBoundingClientRect();
  const shouldPlaceAfter = event.clientY > rect.top + rect.height / 2;
  return {
    target,
    dropReference: shouldPlaceAfter ? target.nextSibling : target,
  };
}

function ensureSidebarDropIndicator(navList: HTMLElement): HTMLElement {
  const existing = navList.querySelector<HTMLElement>('.nav-drop-indicator');
  if (existing) return existing;

  const indicator = document.createElement('div');
  indicator.className = 'nav-drop-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  navList.appendChild(indicator);
  return indicator;
}

function setActiveSidebarItem(item: HTMLElement): void {
  const navList = item.closest<HTMLElement>('.nav-items');
  if (!navList) return;
  navList.querySelectorAll<HTMLElement>('.nav-item[data-nav-id]').forEach((navItem) => {
    navItem.classList.remove('active');
    navItem.removeAttribute('aria-current');
  });
  item.classList.add('active');
  item.setAttribute('aria-current', 'page');
}

function showPageById(pageId: string): void {
  const normalizedPageId = pageId === 'monitor' ? 'monitor' : pageId === 'xiaopozhan' ? 'xiaopozhan' : 'dashboard';
  if (normalizedPageId !== 'monitor') {
    void hideLiveBrowserMonitor();
  }
  if (normalizedPageId !== 'xiaopozhan') {
    void hideXiaoPoZhanBrowser();
  }
  document.querySelectorAll<HTMLElement>('[data-page]').forEach((page) => {
    page.hidden = page.dataset.page !== normalizedPageId;
  });

  const navItem = document.querySelector<HTMLElement>(`.nav-item[data-nav-id="${normalizedPageId}"]`);
  if (navItem) {
    setActiveSidebarItem(navItem);
  }

  const title = document.querySelector<HTMLElement>('.page-title');
  const subtitle = document.querySelector<HTMLElement>('.page-subtitle');
  if (title) title.textContent = pageTitleFor(normalizedPageId);
  if (subtitle) {
    subtitle.textContent = pageSubtitleFor(normalizedPageId);
  }

  if (normalizedPageId === 'xiaopozhan') {
    void showXiaoPoZhanBrowser();
  }
}

function pageTitleFor(pageId: string): string {
  if (pageId === 'monitor') return '监控';
  if (pageId === 'xiaopozhan') return '小破站';
  return '仪表盘';
}

function pageSubtitleFor(pageId: string): string {
  if (pageId === 'monitor') return '任务浏览器会话与实时预览';
  if (pageId === 'xiaopozhan') return '内置浏览器 · https://api.snowovo.cc.cd/login';
  return '任务/作业调度总览 · 2026-06-29 今日';
}

function clearSidebarDragState(navList: HTMLElement): void {
  navList.querySelectorAll<HTMLElement>('.nav-item').forEach((item) => {
    item.classList.remove('is-dragging', 'drag-over');
  });
  navList.classList.remove('is-reordering');
  navList.querySelector<HTMLElement>('.nav-drop-indicator')?.remove();
}


async function startAutomaticNetworkCheck(): Promise<void> {
  if (!window.registrationApp?.checkNetwork) return;
  setNetworkStatus('checking', '自动检测中', '正在确认当前网络是否可以连接 GPT 服务');
  try {
    const result = await window.registrationApp.checkNetwork() as NetworkCheckResult;
    renderNetworkCheck(result);
  } catch (error) {
    setNetworkStatus('error', '连接异常', error instanceof Error ? error.message : String(error));
  }
}

interface NetworkCheckResult {
  ok: boolean;
  latencyMs: number;
  endpoints: Array<{ name: string; ok: boolean; status?: number; latencyMs: number; error?: string }>;
}

function renderNetworkCheck(result: NetworkCheckResult): void {
  if (result.ok) {
    setNetworkStatus('ok', '连接正常', `当前网络可用 · ${result.latencyMs}ms`);
    return;
  }
  const firstError = result.endpoints.find((endpoint) => !endpoint.ok)?.error;
  setNetworkStatus('error', '连接异常', firstError ? `无法连接 GPT 服务：${firstError}` : '无法连接 GPT 服务，请检查当前网络');
}

function setNetworkStatus(state: 'checking' | 'ok' | 'error', title: string, note: string): void {
  const panel = document.querySelector<HTMLElement>('.network-overview');
  const chipText = document.querySelector<HTMLElement>('.apple-status-pill-text');
  const titleElement = document.querySelector<HTMLElement>('.network-status-title');
  const noteElement = document.querySelector<HTMLElement>('.network-status-note');
  panel?.setAttribute('data-network-state', state);
  if (chipText) chipText.textContent = state === 'ok' ? '连接正常' : state === 'error' ? '连接异常' : '自动检测';
  if (titleElement) titleElement.textContent = title;
  if (noteElement) noteElement.textContent = note;
}

function renderSnapshot(snapshot: AppSnapshot): void {
  renderStats(snapshot);
  renderTaskTable(snapshot.tasks);
  renderActivity(snapshot);
  renderBrowserMonitor(snapshot.browserSessions);
}

function renderStats(snapshot: AppSnapshot): void {
  const statKeys: Array<keyof typeof snapshot.stats> = ['running', 'queued', 'completed', 'failed'];
  for (const key of statKeys) {
    const valueEl = document.querySelector<HTMLElement>(`.stat-card[data-stat="${key}"] .stat-value`);
    if (valueEl) valueEl.textContent = String(snapshot.stats[key]);
  }
}

function renderTaskTable(tasks: RegistrationTask[]): void {
  const tbody = document.querySelector<HTMLTableSectionElement>('.job-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  for (const task of tasks.slice(0, 20)) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="job-name">${escapeHtml(task.site)} · ${escapeHtml(task.id.slice(0, 8))}</td>
      <td><span class="status ${classForStatus(task.status)}">${statusLabel[task.status]}</span></td>
      <td class="job-time">${formatTime(task.createdAt)}</td>
      <td class="job-duration">${task.attempts} 次尝试</td>
      <td class="job-actions"><button class="action-btn" type="button">日志</button></td>
    `;
    tbody.appendChild(row);
  }
}

function renderActivity(snapshot: AppSnapshot): void {
  const list = document.querySelector<HTMLUListElement>('.activity-list');
  if (!list) return;

  list.innerHTML = '';
  for (const log of snapshot.recentLogs.slice(0, 20)) {
    const item = document.createElement('li');
    item.className = 'activity-item';
    item.innerHTML = `
      <span class="activity-time">${formatTime(log.at)}</span>
      <span class="activity-dot ${dotForLevel(log.level)}" aria-hidden="true"></span>
      <span class="activity-text"><strong>${escapeHtml(log.taskId.slice(0, 8))}</strong> ${escapeHtml(log.message)}</span>
    `;
    list.appendChild(item);
  }
}

function renderBrowserMonitor(sessions: AppSnapshot['browserSessions']): void {
  const list = document.querySelector<HTMLElement>('.browser-monitor-list');
  if (!list) return;

  if (sessions.length === 0) {
    list.innerHTML = '<div class="browser-empty-state">点击启动任务后，这里会显示任务浏览器。</div>';
    return;
  }

  list.innerHTML = '';
  for (const session of sessions) {
    const card = document.createElement('article');
    card.className = 'card browser-session-card';
    card.dataset.taskId = session.taskId;
    card.innerHTML = `
      <button class="browser-session-close" type="button" aria-label="关闭该浏览器监控" title="关闭监控" data-browser-action="request-close" data-task-id="${escapeHtml(session.taskId)}">
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6"/></svg>
      </button>
      <div class="browser-preview" data-browser-preview="${escapeHtml(session.taskId)}">
        <span class="browser-preview-empty">正在获取浏览器画面</span>
      </div>
      <div class="browser-session-meta">
        <div class="browser-session-title">${escapeHtml(session.taskId.slice(0, 8))} · ${session.embedded ? '正在监控' : '后台运行'}</div>
        <div class="browser-session-detail">${escapeHtml(session.url || 'about:blank')}</div>
        <div class="browser-session-detail">${escapeHtml(session.partition)}</div>
      </div>
      <div class="browser-session-actions">
        <button class="action-btn" type="button" data-browser-action="open" data-task-id="${escapeHtml(session.taskId)}">查看监控</button>
        <button class="action-btn" type="button" data-browser-action="refresh" data-task-id="${escapeHtml(session.taskId)}">刷新画面</button>
      </div>
    `;
    list.appendChild(card);
    void refreshBrowserPreview(session.taskId);
  }
}

async function showLiveBrowserMonitor(taskId: string): Promise<void> {
  const lightbox = document.querySelector<HTMLElement>('.browser-monitor-lightbox');
  const stage = document.querySelector<HTMLElement>('.browser-monitor-stage');
  if (!lightbox || !stage || !window.registrationApp?.openBrowserMonitor) return;

  showPageById('monitor');
  liveBrowserMonitorTaskId = taskId;
  lightbox.hidden = false;
  const title = lightbox.querySelector<HTMLElement>('.browser-monitor-lightbox-title');
  if (title) title.textContent = `${taskId.slice(0, 8)} · 浏览器监控`;
  await nextAnimationFrame();
  await window.registrationApp.openBrowserMonitor(taskId, boundsForElement(stage));
}

async function hideLiveBrowserMonitor(): Promise<void> {
  const taskId = liveBrowserMonitorTaskId;
  liveBrowserMonitorTaskId = null;
  const lightbox = document.querySelector<HTMLElement>('.browser-monitor-lightbox');
  if (lightbox) lightbox.hidden = true;
  if (taskId) {
    await window.registrationApp?.closeBrowserMonitor?.(taskId);
  }
}

async function refreshLiveBrowserBounds(): Promise<void> {
  if (!liveBrowserMonitorTaskId || !window.registrationApp?.openBrowserMonitor) return;
  const stage = document.querySelector<HTMLElement>('.browser-monitor-stage');
  if (!stage || stage.closest<HTMLElement>('[hidden]')) return;
  await window.registrationApp.openBrowserMonitor(liveBrowserMonitorTaskId, boundsForElement(stage));
}

async function showXiaoPoZhanBrowser(): Promise<void> {
  const stage = document.querySelector<HTMLElement>('.xiaopozhan-browser-stage');
  if (!stage || !window.registrationApp?.openUtilityBrowser) return;
  xiaoPoZhanBrowserOpen = true;
  await nextAnimationFrame();
  await window.registrationApp.openUtilityBrowser(XIAOPOZHAN_SESSION_ID, XIAOPOZHAN_URL, boundsForElement(stage));
}

async function hideXiaoPoZhanBrowser(): Promise<void> {
  if (!xiaoPoZhanBrowserOpen) return;
  xiaoPoZhanBrowserOpen = false;
  await window.registrationApp?.closeUtilityBrowser?.(XIAOPOZHAN_SESSION_ID);
}

async function refreshXiaoPoZhanBrowserBounds(): Promise<void> {
  if (!xiaoPoZhanBrowserOpen || !window.registrationApp?.openUtilityBrowser) return;
  const stage = document.querySelector<HTMLElement>('.xiaopozhan-browser-stage');
  if (!stage || stage.closest<HTMLElement>('[hidden]')) return;
  await window.registrationApp.openUtilityBrowser(XIAOPOZHAN_SESSION_ID, XIAOPOZHAN_URL, boundsForElement(stage));
}

function boundsForElement(element: HTMLElement): BrowserMonitorBounds {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.max(0, Math.round(rect.left)),
    y: Math.max(0, Math.round(rect.top)),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function refreshBrowserPreview(taskId: string): Promise<void> {
  const preview = document.querySelector<HTMLElement>(`.browser-preview[data-browser-preview="${cssEscape(taskId)}"]`);
  if (!preview || !window.registrationApp?.captureBrowser) return;

  try {
    const dataUrl = await window.registrationApp.captureBrowser(taskId);
    if (!isPngDataUrl(dataUrl)) {
      preview.classList.remove('has-capture');
      preview.style.backgroundImage = '';
      preview.innerHTML = '<span class="browser-preview-empty">后台浏览器已打开，点击查看监控</span>';
      return;
    }
    preview.classList.add('has-capture');
    preview.style.backgroundImage = `url("${dataUrl}")`;
    preview.innerHTML = '<span class="browser-preview-empty">浏览器画面已就绪</span>';
  } catch (error) {
    preview.classList.remove('has-capture');
    preview.style.backgroundImage = '';
    preview.innerHTML = `<span class="browser-preview-empty">${escapeHtml(error instanceof Error ? error.message : String(error))}</span>`;
  }
}

function isPngDataUrl(value: string | undefined): value is string {
  return Boolean(value?.startsWith('data:image/png;base64,') && value.length > 'data:image/png;base64,'.length);
}

function classForStatus(status: RegistrationTask['status']): string {
  if (status === 'ready') return 'status-completed';
  if (status === 'failed') return 'status-failed';
  if (status === 'queued') return 'status-queued';
  return 'status-running';
}

function dotForLevel(level: 'info' | 'warn' | 'error'): string {
  if (level === 'error') return 'danger';
  if (level === 'warn') return 'warning';
  return 'info';
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[char] ?? char);
}

function cssEscape(value: string): string {
  if ('CSS' in window && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}

void boot();
