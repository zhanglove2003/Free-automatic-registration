# 贡献与提交规范（CONTRIBUTING）

> 适用项目：Windows 桌面端「自动注册机」（Electron + TypeScript）
> 本规范是 PR 提交的唯一依据，所有协作者（含未来 CPA/Codex-Manager 集成）须遵循。
> 配套文档见 `开发提示文档/`（PRD、设计规范、集成对接契约）。

---

## 1. 分支策略

| 分支 | 用途 | 保护 |
|------|------|------|
| `main` | 唯一长期分支，始终可构建、可发布 | 受保护，禁止直推 |
| `feat/<简述>` | 新功能 | 短生命周期，合并后删除 |
| `fix/<简述>` | 缺陷修复 | 同上 |
| `docs/<简述>` | 文档 | 同上 |
| `chore/<简述>` | 杂项/构建/依赖 | 同上 |

- 所有改动经 **Pull Request** 合入 `main`，**不允许直接 push 到 `main`**。
- 分支命名用小写 + 连字符，如 `feat/sms-country-strategy`、`fix/email-worker-timeout`。
- 一个 PR 只做一件事，保持小而聚焦，便于评审。

---

## 2. 提交信息规范（Conventional Commits）

格式：

```
<type>(<scope>): <subject>

[可选正文：说明动机与做法]

[可选脚注：BREAKING CHANGE / 关联 issue，如 Closes #12]
```

### 2.1 type（必填）
`feat` 新功能 ｜ `fix` 修复 ｜ `docs` 文档 ｜ `style` 格式 ｜ `refactor` 重构 ｜ `perf` 性能 ｜ `test` 测试 ｜ `build` 构建/依赖 ｜ `ci` 流水线 ｜ `chore` 杂项 ｜ `revert` 回滚

### 2.2 scope（建议填，对应模块）
`browser` ｜ `sms` ｜ `email` ｜ `captcha` ｜ `store` ｜ `callback` ｜ `codex` ｜ `cpa` ｜ `scheduler` ｜ `log` ｜ `config` ｜ `ui` ｜ `security` ｜ `deps` ｜ `ci` ｜ `docs`

### 2.3 subject（必填）
- 一句话说明做了什么，**可用中文**，结尾不加句号，建议 ≤ 50 字。
- 用祈使语气：「新增…」「修复…」，而非「新增了…」。

### 2.4 破坏性变更
在脚注写 `BREAKING CHANGE: <说明>`，或在 type 后加 `!`，如 `feat(store)!: 调整账号表结构`。

### 2.5 示例
```
feat(sms): 支持三国家候选与国家优先/低价优先选号策略

按 HeroSMS(SMS-Activate) 协议实现 getNumber 多国家回退；
选号策略走配置，默认国家优先。

Closes #8
```
```
fix(email): 修复 Catch-all 收件人匹配大小写不一致导致漏取邮件
```

---

## 3. 提交前自检（本地必须通过）

在 `软件源码/` 下执行：

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # 单元测试
npm run build       # 可构建
```

> 源码骨架就绪后，建议本地接入 husky + lint-staged + commitlint，
> 在 `commit-msg` 钩子用根目录 `commitlint.config.cjs` 校验提交信息，
> 在 `pre-commit` 跑 lint-staged。CI 侧已对 PR 标题做同等校验。

---

## 4. Pull Request 流程

1. 从最新 `main` 切出分支，按命名规范命名。
2. 提交遵循第 2 节;PR **标题同样遵循 Conventional Commits**(CI 会校验)。
3. 推送后创建 PR,填写 `pull_request_template.md` 各项,关联 issue。
4. 确保 CI 全绿(lint / typecheck / test / build)。
5. 至少 **1 名评审通过**后方可合并;涉及 `security`/`store`/`codex` 改动建议 2 人评审。
6. 合并方式统一 **Squash and merge**,squash 后的标题须符合 Conventional Commits(用于生成 changelog)。
7. 合并后删除分支。

### 4.1 PR 大小建议
- 单个 PR 改动尽量 ≤ 400 行(不含生成物与锁文件)。
- 大特性拆成多个可独立评审的 PR。

---

## 5. 评审检查清单(评审人对照)

- [ ] 实现与 PRD/设计规范/集成契约一致,无擅自扩大范围。
- [ ] 模块边界清晰,只通过既定接口交互(见设计规范第 2 章)。
- [ ] 错误处理与重试符合容错策略;资源(号码/会话/信号量)确保释放。
- [ ] **无任何明文凭据/token/密钥进入代码、日志或测试快照**。
- [ ] 敏感字段落盘走加密;日志已脱敏。
- [ ] 新增/变更有对应测试,CI 通过。
- [ ] 外部调用(smshero/Cloudflare/打码/回调)有超时与失败语义。

---

## 6. 安全红线(违反则一票否决)

- 禁止提交 `.env`、API Key、账号 token、账号数据库(`*.db`)、私钥等(已在 `.gitignore` 覆盖,仍需人工把关)。
- 禁止把真实账号数据、真实手机号、真实邮箱写入仓库或测试夹具,统一用占位/脱敏数据。
- 涉及凭据存储、传输加密、token 抓取的改动,须在 PR 描述中说明安全影响。
- 依赖新增须锁定版本(见 `package.json` 固定版本),警惕可疑/仿冒包。

---

## 7. 文档同步

- 改动影响行为/接口/字段时,**同步更新 `开发提示文档/` 对应规范并在 PR 勾选**。
- 需求/集成结论变更时,回写《03 集成对接契约》并升版本号。
