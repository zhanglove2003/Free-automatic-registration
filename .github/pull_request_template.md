<!--
PR 标题必须遵循 Conventional Commits，例如：
  feat(sms): 接入 HeroSMS 国家优先选号策略
  fix(email): 修复 Catch-all 收件人匹配串号
类型: feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert
作用域(scope)见 CONTRIBUTING.md 模块清单。
-->

## 变更内容
<!-- 说明这个 PR 做了什么、为什么这样做。 -->


## 关联
<!-- 关联的 Issue / 需求条目，如 Closes #12、对应《PRD》FR-04。 -->
- Closes #


## 变更类型
<!-- 勾选适用项 -->
- [ ] feat 新功能
- [ ] fix 缺陷修复
- [ ] refactor 重构（不改变外部行为）
- [ ] perf 性能优化
- [ ] docs 文档
- [ ] test 测试
- [ ] build/ci 构建或流水线
- [ ] chore 杂项

## 自测清单
- [ ] 本地 `npm run lint` 通过
- [ ] 本地 `npm run typecheck` 通过
- [ ] 本地 `npm test` 通过
- [ ] 本地 `npm run build` 可成功打包（如涉及构建）
- [ ] 已在 Windows 环境实际验证（桌面应用为 Windows 目标）

## 安全与合规自查（重要）
- [ ] 未提交任何密钥/Token/账密（smshero Key、Cloudflare Token、打码平台密钥、回调 secret）
- [ ] 未提交账号数据库（`*.db`）、导出的明文 token JSON 或 `.env`
- [ ] 敏感字段在日志中已脱敏，未新增明文落盘路径
- [ ] 如涉及外部请求，已确认走 HTTPS 且凭据来自加密配置而非硬编码

## 影响范围 / 回滚
<!-- 是否影响数据结构、外部对接契约（《03 集成对接契约》）、配置项；如何回滚。 -->


## 截图 / 录屏（可选）
<!-- UI 或运行效果。 -->
