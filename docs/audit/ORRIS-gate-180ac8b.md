# ORRIS Security Gate — 180ac8b

验收对象是提交 `180ac8b2ade8a3c45267f6a589cea40340ab4fbb`。没有新增商业功能，没有开启真实收款，没有插入、更新或删除生产订单。生产库只使用了 `BEGIN READ ONLY`。会写数据的检查只跑在本机独立的内存 PGLite 里，进程里没有 `DATABASE_URL`。

这仍是测试模板，不是已上线的真实商店。

## 结论

| # | 检查 | 结果 | 证据 |
| --- | --- | --- | --- |
| 1 | 生产部署的 Git SHA | PASS | 最新生产部署 `dpl_DNJcZXie4DrCTRAYu9XTd1fLtCCd` 状态 READY，`githubCommitSha` 为 `180ac8b2ade8a3c45267f6a589cea40340ab4fbb`。本地 `HEAD` 相同。公开站 `/orders` 已是凭证文案，不再要求邮箱 |
| 2 | Neon 上 0006 已生效 | PASS | 只读。`_migrations` 有 `0006_integrity.sql`，`applied_at` 2026-10-20T13:01:34.197Z。列和约束见下表 |
| 3 | 订单号加邮箱不能打开订单 | PASS | 生产只读调用。`OR-18421` 的邮箱与种子地址一致，不带凭证返回 `null`。错误凭证、串单凭证也是 `null`。页面没有邮箱输入框 |
| 4a | 有效结账凭证能打开自己的订单 | PASS | 生产：`OR-18421` + `seed-token-1` 返回该订单号。隔离库：下单返回的凭证能打开，别的凭证不能 |
| 4b | 生产环境已登录用户打开自己的订单 | BLOCKED | 没有为验收创建登录会话。那会往生产认证表写用户。隔离库里，会话邮箱一致可以打开，别人的邮箱不行 |
| 5a | 生产环境当场拒绝演示付款 | BLOCKED | 生产没有未付款订单（0 / 123）。要打到这条分支必须先插入未付款订单，验收不允许写生产。没有对任何生产订单调用付款 |
| 5b | 同一提交在隔离库、`VERCEL_ENV=production` 时拒绝演示付款 | PASS | 抛出 `err.payNotLive`。订单仍是 `unpaid` / `stock_held=true` / `payment_source=none`。`payments` 里 demonstration 行数仍是 0。库存没有退回也没有多扣 |
| 5c | 生产订单和付款记录没有被这次验收改掉 | PASS | 只读快照在浏览器探测前后一致，见下表 |
| 6 | 未付款保留 30 分钟后释放、取消，且重复执行不重复退库存 | PASS | 只在隔离库。把 `reserve_until` 设到过去再扫。库存回到下单前。状态 `cancelled`，`stock_held=false`，付款仍是 `unpaid`。释放流水 1 条。再扫一次，库存和流水都不变 |
| 7 | 已付款订单不会被过期清理退库存 | PASS | 只在隔离库。预览环境确认演示付款后，即使把 `stock_held` 改回 true 且到期，再扫也不退库存，状态不是 `cancelled`。生产当前 `stock_held=0`，清扫没有可释放的行 |
| 8a | 前台热销不含演示购买 | PASS | 生产首页没有「Often chosen」，也没有旧文案 “including earlier demonstration orders”。只读统计可计入排行的订单为 0 |
| 8b | 报表默认不含演示数据 | PASS（代码和隔离库）/ BLOCKED（生产后台登录） | 四个后台页默认 `useState(false)`，服务端只有 `includeDemo === true` 才计入。隔离库：`includeDemo false` 时订单数 0，打开后大于 0。没有登录生产后台，所以没有亲手看到那个勾选框 |
| 9a | Playwright | PASS | 4 项全过：本地查询页、本地首页、生产凭证查询、生产首页。命令 `npx playwright test` |
| 9b | 单元与隔离集成测试 | PASS | `integrity.test.ts` 与 `gate.integration.test.ts` 共 9 项通过 |
| 9c | 类型检查 | FAIL | `tsc --noEmit` 退出码 2。仅 `src/lib/db.ts` 三处既有 `Uint8Array` 错误。本次新增文件没有新的类型错误 |
| 9d | Lint | FAIL | `eslint .` 1 个既有错误：`src/lib/app-data/client.server.ts` 空代码块。另有 13 个既有 warning。本次验收文件单独 lint 通过 |

无法在生产执行的项目没有写成 PASS。

## 生产部署

| 项 | 值 |
| --- | --- |
| 项目 | `mu` / `prj_RJd2m0IfwLiUvretRDUpFIJksScv` |
| 部署 | `dpl_DNJcZXie4DrCTRAYu9XTd1fLtCCd` |
| 状态 | READY，target production |
| SHA | `180ac8b2ade8a3c45267f6a589cea40340ab4fbb` |
| 上一个生产 SHA | `1c4e442526250ba6906e2761cc0404419a172137` |
| 公开站 | https://mu-omega-nine.vercel.app |

## 生产库只读快照

探测前和探测后相同。探测包含首页和订单查询。查询会跑到期清扫，但当时没有到期保留，所以没有行被改写。

| 项 | 前 | 后 |
| --- | --- | --- |
| `_migrations` | 0001–0006 | 相同，0006 时间不变 |
| 订单 | 123 | 123 |
| 其中演示订单 | 123 | 123 |
| 非演示订单 | 0 | 0 |
| `stock_held` | 0 | 0 |
| 未付款 | 0 | 0 |
| `payment_source=none` | 123 | 123 |
| `payment_source=demonstration` | 0 | 0 |
| `payment_source=gateway` | 0 | 0 |
| 已设置 `reserve_until` | 0 | 0 |
| 付款行 | 123，provider 全是 `sample` | 相同 |
| `rate_buckets` | 0 | 0 |
| `store_settings.owner_email` 已填写 | 否 | 否 |
| 可计入热销的订单 | 0 | 0 |

0006 结构：

| 对象 | 结果 |
| --- | --- |
| `orders.reserve_until` | `timestamptz`，可空 |
| `orders.stock_held` | `boolean not null default false` |
| `orders.payment_source` | `text not null default 'none'` |
| `orders_payment_source_check` | 只允许 `none`、`demonstration`、`gateway` |
| `store_settings.owner_email` | `text`，可空 |
| `rate_buckets` | `bucket`、`hits`、`window_start` |

`owner_email` 仍是空的。生产不会从源码猜店主。这不是本项失败，只是还没有设置 `OWNER_EMAIL`。

## 隔离库前后状态

库是这次测试进程里的新 PGLite，不是 Neon。种子演示单先写入，然后把订单号序列拨到 90000，避免撞上种子单号。

未付款单：

| 时点 | 库存 | 订单 |
| --- | --- | --- |
| 下单前 | N | — |
| 下单后 | N−1 | `unpaid`，`stock_held=true`，`payment_source=none` |
| 生产模式点击演示付款 | N−1 | 仍未付款，没有 demonstration 付款行 |
| 到期清扫一次 | N | `cancelled`，`stock_held=false`，释放流水 1 条 |
| 再清扫一次 | N | 流水仍是 1 条 |

已付款单：演示付款只在 `VERCEL_ENV=preview` 下执行。付款后库存停在保留后的数量。把保留标志强行改回并设为已到期，再清扫，库存不变，订单没有被取消。

报表：只开演示数据时，30 天已付款订单数大于 0；关掉时是 0。插入一笔隔离的 `payment_source=gateway` 且 `is_demo=false` 的订单后，关掉演示数据也能数到 1，净销售额 4200 分，首页排行出现该商品。结账写入的购买事件 `is_demo=true`。

## 明确没做的事

- 没有在生产调用付款。
- 没有在生产创建订单、用户或付款。
- 没有把无法登录的后台勾选框写成已在生产看过。
- 没有把类型检查或 Lint 写成通过。
- 全量 `npm test` 里，模板自带的「空 migrations 目录」和「默认关闭登录」断言在这家店上仍然失败。那是脚手架和现有商店不一致，不是这次验收新引入的。商业规则测试是单独跑过的。
