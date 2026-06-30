/**
 * Commit 信息校验规则（Conventional Commits）。
 * 本地启用：在 软件源码/ 安装 @commitlint/cli @commitlint/config-conventional + husky，
 * 并在 commit-msg 钩子执行 `npx commitlint --edit $1`。
 * CI 侧由 .github/workflows/pr-title.yml 校验 PR 标题。
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // 缺陷修复
        'docs',     // 文档
        'style',    // 格式（不影响逻辑）
        'refactor', // 重构
        'perf',     // 性能
        'test',     // 测试
        'build',    // 构建/依赖
        'ci',       // 流水线
        'chore',    // 杂项
        'revert',   // 回滚
      ],
    ],
    // 作用域建议值（非强制，便于统一）：见 CONTRIBUTING.md
    'scope-enum': [
      1,
      'always',
      [
        'browser',   // 浏览器控制/注入
        'sms',       // 接码 (smshero)
        'email',     // 邮箱 (Cloudflare Worker)
        'captcha',   // 打码/人机验证
        'store',     // 存储/数据库
        'callback',  // 回调/导出
        'codex',     // Codex-Manager 集成
        'cpa',       // CPA 平台集成
        'scheduler', // 调度/编排
        'log',       // 日志/监控
        'config',    // 配置
        'ui',        // 与交付 UI 的对接
        'security',  // 安全
        'deps',      // 依赖
        'ci',        // 流水线
        'docs',      // 文档
      ],
    ],
    'subject-case': [0], // 允许中文主题，不限制大小写
    'header-max-length': [2, 'always', 100],
  },
};
