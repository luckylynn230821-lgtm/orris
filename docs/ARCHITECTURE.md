# ORRIS 架构说明

这是一套单店电商模板，不是多租户平台。一个部署实例对应一家店。

## 为什么不是 Next.js monorepo

运行与发布环境固定为 TanStack Start 单应用。店面和管理台是同一套代码里的两套路由与权限，共享类型、校验和数据库，可以分别被反向代理到不同域名，但不拆成两个无法在此环境运行的包。

## 站点地图

店面

- `/` 首页（公告、主视觉、分类、畅销、新品、笔记、服务、订阅）
- `/shop` 列表，支持分类、搜索、库存、排序
- `/product/:slug` 详情、规格、库存、加购
- `/cart` `/checkout` `/order/:number` `/orders`
- `/about` `/account` `/login`

商家

- `/admin` 经营总览
- `/admin/products` 商品、批量、CSV 导入
- `/admin/products/:id` 编辑、图片、规格、成本
- `/admin/inventory` 库存与流水
- `/admin/orders` 订单、发货、退款、取消
- `/admin/customers`
- `/admin/analytics` 趋势、商品表、漏斗
- `/admin/intelligence` 规则诊断
- `/admin/reports` CSV
- `/admin/content` 首页文案
- `/admin/settings` 运费、阈值、管理员、审计

## 权限

- 已发布商品、报价、下单、用「订单号 + 邮箱」或下单令牌查单：公开。公开响应不含成本。
- 管理接口要求登录，并且调用者必须是 `store_members` 里的 administrator。
- 店里还没有管理员时，第一个登录的人成为管理员。
- 顾客只能在账户页看到与自己用户或邮箱关联的订单。

## 数据

核心表：`store_settings`、`store_members`、`categories`、`products`、`product_variants`、`product_images`、`customers`、`orders`、`order_items`、`payments`、`refunds`、`fulfillments`、`inventory_movements`、`product_events`、`newsletter_subscribers`、`audit_logs`。

订单保存成交时的单价和单位成本。金额用整数分。库存扣减包在数据库事务里：`update ... where inventory_qty >= qty`，失败则整单回滚。支付幂等键唯一，重复提交返回原订单。

## 支付

`payments.provider = demonstration`。界面写明没有扣卡。不把演示成功伪装成 Stripe 成功。未配置支付密钥时不调用支付商。

## 分析口径

见 README「Books」。转化漏斗里，浏览和加购是「会话-日」去重次数，购买是已付款订单数，页面上分开标注，不混成同一个转化率分母而不说明。

新品、浏览不足时标记 Insufficient data，不把没有记录说成经营差。

## 阶段边界

这一版交付可运行的店面、商品与库存、演示结账、订单、真实聚合的销售与利润、规则型经营建议、内容配置和 CSV。

后续商业版才做：真实 Stripe、税费服务、多管理员邀请、多店、拖拽建站、广告费用归集后的贡献利润。
