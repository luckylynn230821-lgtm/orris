# ORRIS — Security Gate Closure and Production Readiness V1.2

这仍是测试模板，不是已上线的真实商店。没有开启真实收款。没有把生产测试数据写入正式销售。

完成度分成四层，不能互相代替：

| 层 | 含义 |
| --- | --- |
| 源码完成 | 代码和迁移文件在 main 上 |
| 自动化测试通过 | 本机 `npm test` 与本地 Playwright 通过，数据库是内存 PGLite |
| 生产部署通过 | Vercel 生产部署 READY，公开站返回 200，迁移已记入 `_migrations` |
| 生产业务验收通过 | 在生产上用真实会话或真实订单验证。做不到的保持 BLOCKED |

## 部署基线（本轮改动之前）

| 项 | 值 |
| --- | --- |
| 部署 | `dpl_AtLPe6Yeg7s4oZsHwPtdEfvEwBHj` |
| 状态 | READY，target production |
| SHA | `bfece8e2fc6034f0bac8f537f2f0224a42d093d1` |
| 别名 | `mu-omega-nine.vercel.app` 指向该部署 |
| 健康检查 | `GET /` 200，`GET /orders` 200 |

本文件提交之后会再有一次生产部署。那次部署才负责执行 `0007`。部署前的 SHA 不是凭证已轮换的证明。

## P0

### 1. 公开的 seed-token 凭证

只读影响评估（`BEGIN READ ONLY`，轮换之前）：

| 项 | 数量 |
| --- | --- |
| 订单 | 123 |
| 演示订单 | 123 |
| 非演示订单 | 0 |
| `seed-token-<数字>` | 123 |
| 非演示订单上的该模式 | 0 |
| 未付款 / 库存预留 | 0 / 0 |
| 用户 / 店员 / `owner_email` | 0 / 0 / 未设置 |

`migrations/0007_retire_seed_tokens.sql` 只更新 `is_demo = true` 且凭证匹配该模式的 `access_token`。新值在数据库内用两次 `gen_random_uuid()` 生成，迁移日志不回传凭证。金额、状态、付款、库存、邮箱都不改。回滚说明在 [rollback-0007.sql](rollback-0007.sql)：不能把旧的公开字符串写回去。

种子代码改为 `mintOrderToken()`。生产查询页的 Playwright 改为断言该公开模式不能打开订单。历史验收报告里出现过这个模式，它已经不是有效凭证，本报告不记录任何新凭证。

生产上这 123 行已经换掉，证据在文末「部署后复核」。

### 2. 真实订单凭证

新订单使用 32 字节 `base64url`（`randomBytes`）。结账和查询成功后凭证放进 `sessionStorage`，不再放进 URL。旧链接如果还带着 `token` 或 `email`，页面会收下凭证并立刻 `replace` 掉查询串。订单页加上 `noindex` 和 `no-referrer`。服务端没有把凭证打到 `console.log`。支付网关模块不会把凭证写进报告。

### 3. bfece8e 生产部署

PASS。见上表。那次部署不包含 `0007`。包含 `0007` 的部署记录在文末。

### 4. 店主绑定

生产环境变量里没有 `OWNER_EMAIL`。`store_settings.owner_email` 未设置。用户表是空的。

源码规则：`ownerMayBind` 要求 `emailVerified = true`，并且账号的 `providerId` 是 `grok-google`。未验证邮箱、邮箱密码、X 身份都不能成为店主。生产上还没有人登录，所以这条规则没有在生产里被看见。生产绑定验收 BLOCKED。

### 5. 隔离环境的后台测试

`admin.integration.test.ts` 在内存 PGLite 里通过：未验证的 Google 身份不能占店主；验证后的 Google 身份可以；X 身份不能；店主可看设置；经理可上架商品但不能看设置；店员不能退款，退款额不变；报表打开演示数据后的订单数高于默认。这不是生产后台验收。

### 6. 仍未做的生产验收

保持 BLOCKED，不把隔离测试写成生产 PASS：

- 生产已登录用户查看自己的订单（没有创建登录会话）
- 生产演示付款拒绝（没有未付款订单，不允许为了测试去插入）
- 生产后台勾选「包含演示数据」
- 生产店主绑定（0 个用户）

## 自动化测试（源码层）

- 沙箱里的 `npm test` 曾经通过，是因为本机有被 gitignore 的 `.grok/skills/og`。GitHub 检出没有这个目录。
- Actions [39453472144](https://github.com/luckylynn230821-lgtm/orris/actions/runs/39453472144)（`ad934c6`）和 [39453673865](https://github.com/luckylynn230821-lgtm/orris/actions/runs/39453673865)（`6d8df16`）都失败在脚本测试：198 项里 4 项 `ENOENT`（`brand-check.test.mjs` 三处、`write-atomic.test.mjs` 一处）。类型检查和 Lint 在那两次运行里已经通过。商业集成测试和 Playwright 没有跑到。
- 技能文档不在商店仓库里。缺文件时跳过那两处技能核对，仓库里的 `AGENTS.md` 约束仍然检查。没有 `.grok` 的检出上，脚本测试 196 通过、2 跳过、0 失败。这只证明沙箱模拟，不是这次提交的 GitHub 结论。
- `npx tsc --noEmit` 与 `npx eslint .` 在沙箱通过过。本地 Playwright 2 项通过。生产 Playwright 的结果写在文末，只覆盖已经部署的 `ad934c6`。

## P1 设计（未启用）

### 定时释放未付款预留

现有 `releaseExpiredHolds` 只在有人打开首页、商店、下单或查单时运行。第二阶段应加独立 Cron，每 5 分钟调用同一函数。建议路由 `POST /api/internal/release-holds`，请求头 `Authorization: Bearer <CRON_SECRET>`，密钥只放在环境变量。未带密钥返回 401。本轮没有注册 Vercel Cron，避免在未授权的情况下写生产库存。生产当前没有未付款预留，所以缺少 Cron 还没有卡住真实库存。

### 管理员 MFA

店主和第二阶段的退款、设置、团队操作需要第二因素。建议 Better Auth TOTP，只对 `owner` 强制；备用码只显示一次并哈希保存。邮件密码目前没有验证信，不能拿它当第二因素。本轮不打开 MFA，避免把唯一店主锁在外面。

### 图片迁到对象存储

今天图片以 data URL 存在数据库里，上传仍检查 JPEG/PNG/WebP 魔数和大小。迁移步骤：私有桶；浏览器拿一次性上传 URL；服务端再读魔数；数据库改存对象键；校验对象数量与行数一致后再停写字节列。回滚是继续读旧列，不删字节，直到校验通过。本轮不迁移字节。

### 支付网关（不收款）

`src/lib/commerce/gateway.ts` 校验 `sha256=` HMAC，并用常数时间比较。`gatewayMayCapture()` 固定返回 false。`acceptGatewayEvent` 即使签名正确也返回 `not-live`，不会改订单。没有挂 Webhook 路由。生产付款拒绝仍在 `customer.server.ts`。

### 备份与恢复

优先使用 Neon 控制台的时间点恢复，保留窗口以控制台为准，本文不假设天数。可携带副本是在受信任机器上执行 `pg_dump`，`DATABASE_URL` 只从环境读取，不写进仓库、不打印。输出路径必须在 git 树外，检查函数在 `scripts/backup-plan.mjs`。本轮没有把生产数据导出到工作区。恢复演练还没在一份真实副本上做过，所以备份的生产验收是 BLOCKED。源码里的检查函数已有测试。

### CI

`.github/workflows/ci.yml` 在 push 和 pull request 上运行类型检查、Lint、`npm test` 和本地 Playwright。CI 把 `DATABASE_URL` 设成空字符串，隔离写测试因此不会碰到 Neon。不跑生产 Playwright，以免把线上验收和生产部署混在一起。前两次 push 的结论是失败，原因在上面。这次提交之后的 Actions 结果要等运行结束再记。沙箱通过不等于 GitHub CI 通过。

## 剩余风险

1. Git 历史里仍有旧的公开凭证字符串。轮换之后它不能打开订单，但历史删不掉，除非另做一次历史改写。本轮不改写历史。
2. 已经发出去的旧链接，第一次打开时查询串里仍可能被访问日志看到。新订单不再这样生成。
3. 生产店主席位是空的。在设置已验证的 Google 店主邮箱之前，后台没有人能进。
4. 邮箱密码注册是开的，但没有验证信。这类账号不能当店主。有人如果先占用店主邮箱，会挡住真正的 Google 账号（邮箱唯一）。生产目前 0 个用户。
5. 没有 MFA，没有独立 Cron，图片仍在数据库，真实收款未接。
6. 网关签名函数没有挂到公网，也还没有用服务商的真实测试密钥演练。
7. 备份流程没有在生产副本上演练。
8. 隔离测试通过不等于生产业务验收通过。
9. GitHub Actions 还没有一次成功记录。前两次失败是脚手架测试去读未入库的技能目录。源码已改为缺文件就跳过；在 Actions 对这次提交给出成功之前，自动化层的 GitHub 结论仍未关闭。

## 部署后复核

| 项 | 结果 | 证据 |
| --- | --- | --- |
| 部署 | PASS | `dpl_MpUx3aUgQjTm2HgAX1UiWJkc6iqL`，READY，production。SHA `ad934c69817b0e1b539dd3d92d186f83c5d9b2b6`。公开别名指向该部署 |
| 健康检查 | PASS | `GET /` 200，`GET /orders` 200 |
| 迁移 | PASS | `_migrations` 有 `0007_retire_seed_tokens.sql` |
| 公开凭证 | PASS | 只读。订单仍是 123，全部演示，非演示 0。匹配旧模式的凭证 0。64 位十六进制新凭证 123。付款行仍是 123。未付款 0，库存预留 0。没有读出或记录新凭证 |
| 生产查询 | PASS | Playwright 生产项目 2 项通过。邮箱和旧的公开模式都不能打开订单 |
| 店主绑定 | BLOCKED | 用户 0，成员 0，`owner_email` 仍未设置。源码规则已测，生产没有可登录的人 |
| 生产已登录查单、生产演示付款、生产报表勾选 | BLOCKED | 没有创建会话，也没有插入未付款订单 |
| 备份演练 | BLOCKED | 没有导出生产数据副本 |

源码、沙箱自动化测试、`ad934c6` 的生产部署，以及公开凭证失效，是通过的。GitHub Actions 对 `ad934c6` 和 `6d8df16` 是失败。需要真实登录或真实订单的生产业务验收仍然是 BLOCKED。

