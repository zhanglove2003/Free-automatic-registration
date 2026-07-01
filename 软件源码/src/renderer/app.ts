import type { RegistrationAppApi } from '../preload/preload.js';
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

async function boot(): Promise<void> {
  wireWindowControls();
  wireLaunchButton();
  wireSortableSidebar();
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

function wireLaunchButton(): void {
  const button = document.querySelector<HTMLButtonElement>('.nav-launch');
  button?.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await window.registrationApp?.createJob({ count: 1, site: 'chatgpt-openai' });
    } finally {
      button.disabled = false;
    }
  });
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

void boot();

