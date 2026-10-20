# ORRIS Security & Commerce Integrity Audit Report

日期：2026-10-20  
仓库：`luckylynn230821-lgtm/orris`  
范围：在现有 TanStack Start 店面与后台上做增量整改。没有重做项目，没有换技术栈，没有删除商品、订单、库存、分析或后台功能。  
这仍是测试模板，不是已接入真实收款的商店。演示付款不是支付网关。

## 风险分级（改前）

| 文件 | 等级 | 问题 |
| --- | --- | --- |
| `src/lib/commerce/customer.server.ts` | 高 | 订单号加邮箱即可打开订单；演示付款在任何环境都能写成已付款 |
| `src/routes/orders.tsx`、`src/routes/order/$number.tsx` | 高 | 查询表单把邮箱当成凭证 |
| `src/lib/commerce/checkout.server.ts` | 高 | 未付款库存没有到期；结账限流只在单进程内存里 |
| `src/lib/commerce/admin.server.ts`、`src/lib/commerce/access.ts` | 高 | 店主邮箱写死在源码里；绑定账号不存在时会把现有店主降级 |
| `src/lib/commerce/analytics.server.ts`、`src/lib/commerce/fns.ts`、`src/routes/admin/*.tsx` | 高 | 报表默认计入演示订单；模拟购买事件在排除演示时仍可能留下 |
| `src/lib/commerce/catalog.server.ts` | 高 | 首页排行把演示订单的已付款件数算进去 |
| `src/lib/commerce/admin.server.ts` `saveImage` | 中 | 图片只看 data URL 前缀，不核对文件头；存在数据库，不是对象存储 |
| `src/lib/commerce/fns.ts` 后台函数 | 中 | 已在服务端走 `requireDesk` / `assertAdminThen`。概览货架对有商品读权限的人展示在手数量 |
| `src/lib/commerce/metrics.ts` | 低 | 销售、毛利、退款口径本身一致，但客单价含运费和税，净销售额不含 |
| 全库 | 中 | 没有 Vitest / Playwright。回归测试是 Node 自带测试 |

## 已修复

1. **订单身份。** 游客只能用结账发给的 `access_token`。已登录顾客只能用会话邮箱，且必须与订单邮箱一致。表单里另填的邮箱不再授权。旧的 `?email=` 链接不再打开订单。
2. **演示付款与正式付款。** `VERCEL_ENV=production` 时，顾客确认演示付款会拒绝，订单保持未付款，不写 `payments`。预览和本地仍可记一笔 `provider = demonstration`、`payment_source = demonstration`，文案写明没有扣卡。没有支付网关，没有 `gateway` 入账。
3. **库存预留。** 新订单 `stock_held = true`，`reserve_until` 为 30 分钟。首页、商店、下单、查看订单、演示付款都会扫到期单。释放时先把 `stock_held` 改为 false 并 `returning`，再退库存，重复执行不会多退。已付款会清掉 `stock_held`，到期逻辑不会把已付款库存加回去。
4. **店主绑定。** 生产环境只认 `store_settings.owner_email`，否则认环境变量 `OWNER_EMAIL`。两者都没有时，不会用源码里的邮箱去降级现有店主。`OWNER_EMAIL` 只在字段为空时写入一次。绑定邮箱还没有注册用户时，不改现有店主。预览在两者都空时，仍回退到这个测试模板的店主邮箱，避免空后台被任意账号领走。`FOUNDER_EMAIL` 常量已从权限模块删除。
5. **结账限流。** `rate_buckets` 表，同一邮箱 10 分钟内第 9 次新结账被拒绝。同一 `idempotency_key` 的重放不占额度。进程重启不会把计数清掉。
6. **后台 API。** 抽查全部 `admin*` 服务函数：都先过登录中间件，再在服务端 `requireDesk`、`assertAdminThen`（报表要求 `money:read`，只有店主）或承运列表的履约/设置校验。藏菜单不是授权。
7. **口径（未改公式）。** 金额是整数分。计入销售：`payment_status` 为 paid、partially_refunded、refunded。净销售额 = 行金额合计 − 折扣 − 已退款，不含运费和税。成本 = 未退数量 × 单位成本。毛利 = 净销售额 − 成本。退款率 = 已退款 / 行金额合计。客单价 =（订单总额 − 已退款）/ 销售单数，所以客单价含运费和税，和净销售额不是同一个数。商品报表按净销售额排序。首页「经常被选」按未退件数排序，并且排除演示单和演示付款。库存是变体在手数量；预留写 `sale` 负向流水，到期写 `release` 正向流水。
8. **报表排除演示。** 订单查询要求 `is_demo = false` 且 `payment_source <> demonstration`，除非后台把「包含演示」勾上。该勾选默认关闭，省略参数时服务端也按关闭处理。结账写入的购买事件 `is_demo = true`，排除演示时不会进入漏斗。
9. **图片。** 上传仍须有商品编辑权限（店主或管理员，店员不行）。JPEG / PNG / WebP 要与文件头一致，解码后约 12 字节到 900 KB，字符串不超过约 1.2 MB。`/catalog/` 里已有的模板图仍可沿用。
10. **测试。** 新增 `src/lib/commerce/integrity.test.ts`，并挂进 `npm test` 的 Node 测试列表。没有安装 Playwright，本报告不声称浏览器测试已通过。没有改用 Vitest。

迁移：`migrations/0006_integrity.sql`（只加列和表，不改已有订单行）。回滚：`docs/audit/rollback-0006.sql`（删这些列和限流表，不删订单）。下一笔生产部署在构建时跑迁移。本次没有在沙箱里对 Neon 手工执行 SQL。

## 未修复（需要另一次授权或人工决定）

- 没有真实支付网关，也没有签名 Webhook。生产环境现在不能把订单标成已付款。这是故意的。
- 没有定时任务。没人访问首页、商店、结账或订单页时，到期库存要等到下一次这类请求才退回。
- 0006 之前已经存在的未付款订单 `stock_held` 默认为 false，不会被自动释放。没有去改这些行。
- 图片仍存在数据库的 `product_images.url`，不是私有对象存储。
- 没有管理员 MFA。进程内的读写防护在冷启动后清零；只有结账额度进了数据库。
- Vercel 防火墙上仍只有一条登录/注册限流。本轮没有再改防火墙。
- 管理员概览货架对有商品读取权的人显示在手数量和零售金额，不含成本。库存调整页仍只有店主。这是原有功能，没有收掉。
- 公开的关于页和后台门口仍写出这个测试模板的店主邮箱。授权不再读源码常量。
- 预览环境在没有 `OWNER_EMAIL`、也没有已保存店主邮箱时，仍回退到测试店主邮箱。
- 全量 `npm test` 里，脚手架自带的若干检查（空 migrations 目录、模板关闭登录）在这家店上本来就会失败，因为商店已经有自己的迁移和登录。本轮商业与文案测试单独通过。
- 没有 Playwright。

## 测试

通过（2026-10-20，`node --experimental-strip-types --test`）：

- `src/lib/commerce/integrity.test.ts`
- `src/lib/commerce/metrics.test.ts`
- `src/lib/commerce/stages.test.ts`
- `src/lib/commerce/access.test.ts`
- `src/lib/i18n/translate.test.ts`

框架 `@tanstack/react-start` 版本为 1.168.60，没有低于安全线。  
本地预览重启后首页返回 200，页面含 MU 与 Test template。重启是为了让本地嵌入库应用 0006；不重启时首页会因缺少 `stock_held` 报错。

未跑：Playwright、对生产 Neon 的查询、真实扣款。

## 请人工看一眼

- 用结账凭证打开订单；只用订单号和邮箱应打不开。
- 生产站点上点「确认演示付款」应看到尚未接入真实收款，订单仍是未付款。
- 预览里下一笔新订单，30 分钟后打开首页，库存应回到可售，订单变为取消。已付款的演示单不应被加回库存。
- 后台报表默认不含演示。勾上之后才会看到样本单。
- 首页排行在没有非演示成交时可以为空。精选商品仍在。
- 若要固定生产店主，在 Vercel 设置 `OWNER_EMAIL` 后再部署。不要把邮箱写回源码。
