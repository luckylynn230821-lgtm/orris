import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { isCommerceError } from "./errors";

const optionalUser = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    assertSameSiteRequest();
    const user = await getSessionUser(context.bearerToken as string | undefined);
    return next({ context: { userId: user?.id ?? null, email: user?.email ?? null } });
  });

function guard<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((error: unknown) => {
    if (isCommerceError(error)) throw error;
    console.error(error);
    throw new Error("err.generic");
  });
}

const lineSchema = z.object({
  variantId: z.string().min(1),
  qty: z.number().int().min(1).max(10),
});

export const getChrome = createServerFn({ method: "GET" }).handler(async () => {
  const { loadChrome } = await import("./catalog.server");
  return loadChrome();
});

export const getHome = createServerFn({ method: "GET" }).handler(async () => {
  const { loadHome } = await import("./catalog.server");
  return loadHome();
});

export const getShop = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        q: z.string().optional(),
        category: z.string().optional(),
        pet: z.enum(["dog", "cat"]).optional(),
        sort: z.string().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        inStock: z.boolean().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { loadShop } = await import("./catalog.server");
    return loadShop(data);
  });

export const getProduct = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { loadProduct } = await import("./catalog.server");
    return loadProduct(data.slug);
  });

export const quoteCart = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ lines: z.array(lineSchema).max(30) }).parse(input))
  .handler(async ({ data }) => {
    const { quoteLines } = await import("./catalog.server");
    return quoteLines(data.lines);
  });

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ email: z.string().trim().toLowerCase().email() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { subscribeEmail } = await import("./catalog.server");
    return subscribeEmail(data.email);
  });

export const trackEvent = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        productId: z.string().min(1),
        event: z.enum(["view", "add_to_cart", "checkout_started"]),
        sessionKey: z.string().min(8).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { trackEvent: track } = await import("./catalog.server");
    return track(data);
  });

export const lookupOrder = createServerFn({ method: "POST" })
  .middleware([optionalUser])
  .validator((input: unknown) =>
    z
      .object({
        number: z.string().min(3).max(40),
        email: z.string().optional(),
        token: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { viewOrder } = await import("./customer.server");
    return viewOrder({ ...data, sessionEmail: context.email });
  });

export const checkout = createServerFn({ method: "POST" })
  .middleware([optionalUser])
  .validator((input: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email(),
        name: z.string().trim().min(2).max(80),
        line1: z.string().trim().min(3).max(120),
        city: z.string().trim().min(2).max(80),
        region: z.string().trim().min(2).max(80),
        postal: z.string().trim().min(2).max(20),
        country: z.string().trim().min(2).max(80),
        shippingMethod: z.enum(["standard", "express"]),
        lines: z.array(lineSchema).min(1).max(20),
        idempotencyKey: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { placeOrder } = await import("./checkout.server");
    return guard(() => placeOrder(data, context.userId));
  });

export const myOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listMyOrders } = await import("./customer.server");
    return listMyOrders(context.userId);
  });

const proofSchema = z.object({
  number: z.string().min(3).max(40),
  token: z.string().optional(),
});

function proofOf(data: { token?: string }, email: string | null) {
  return { email, token: data.token ?? null };
}

export const customerPay = createServerFn({ method: "POST" })
  .middleware([optionalUser])
  .validator((input: unknown) => proofSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { payOrder } = await import("./customer.server");
    return guard(() => payOrder(data.number, proofOf(data, context.email)));
  });

export const customerReceive = createServerFn({ method: "POST" })
  .middleware([optionalUser])
  .validator((input: unknown) => proofSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { receiveOrder } = await import("./customer.server");
    return guard(() => receiveOrder(data.number, proofOf(data, context.email)));
  });

export const customerReview = createServerFn({ method: "POST" })
  .middleware([optionalUser])
  .validator((input: unknown) =>
    proofSchema.extend({ rating: z.number().int().min(1).max(5), body: z.string().max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { reviewOrder } = await import("./customer.server");
    return guard(() => reviewOrder(data.number, proofOf(data, context.email), data.rating, data.body));
  });

export const customerService = createServerFn({ method: "POST" })
  .middleware([optionalUser])
  .validator((input: unknown) => proofSchema.extend({ reason: z.string().trim().min(2).max(300) }).parse(input))
  .handler(async ({ data, context }) => {
    const { requestService } = await import("./customer.server");
    return guard(() => requestService(data.number, proofOf(data, context.email), data.reason));
  });

const rangeSchema = z.object({
  range: z.enum(["today", "yesterday", "7d", "30d", "month", "last_month", "year", "custom"]),
  from: z.string().optional(),
  to: z.string().optional(),
  includeDemo: z.boolean().optional(),
});

export const adminSession = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { deskSession } = await import("./admin.server");
    return guard(() => deskSession(context.userId));
  });

export const adminTeam = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listTeam } = await import("./admin.server");
    return guard(() => listTeam(context.userId));
  });

export const adminGrant = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ email: z.string().trim().email().max(160), role: z.enum(["manager", "staff"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { grantSeat } = await import("./admin.server");
    return guard(() => grantSeat(context.userId, data));
  });

export const adminRevoke = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ email: z.string().trim().email().max(160) }).parse(input))
  .handler(async ({ data, context }) => {
    const { revokeSeat } = await import("./admin.server");
    return guard(() => revokeSeat(context.userId, data.email));
  });

export const adminAnalytics = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => rangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdminThen } = await import("./admin.server");
    await assertAdminThen(context.userId);
    const { loadAnalytics } = await import("./analytics.server");
    return loadAnalytics({ ...data, includeDemo: data.includeDemo !== false });
  });

export const adminProducts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { adminCatalog } = await import("./admin.server");
    return guard(() => adminCatalog(context.userId));
  });

export const adminGetProduct = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { adminProduct } = await import("./admin.server");
    return guard(() => adminProduct(context.userId, data.id));
  });

const variantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1).max(40),
  title: z.string().max(80),
  option1Name: z.string().nullable().optional(),
  option1Value: z.string().nullable().optional(),
  option2Name: z.string().nullable().optional(),
  option2Value: z.string().nullable().optional(),
  priceCents: z.number().int().min(0),
  compareAtCents: z.number().int().min(0).nullable().optional(),
  costCents: z.number().int().min(0),
  inventoryQty: z.number().int().min(0),
});

export const adminSaveProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().optional(),
        name: z.string().min(1).max(140),
        slug: z.string().max(80),
        description: z.string().max(4000),
        story: z.string().max(4000),
        categoryId: z.string().min(1),
        tags: z.array(z.string()).max(20),
        status: z.enum(["draft", "published", "archived"]),
        seoTitle: z.string().max(160),
        seoDescription: z.string().max(300),
        variants: z.array(variantSchema).min(1).max(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { saveProduct } = await import("./admin.server");
    return guard(() => saveProduct(context.userId, data));
  });

export const adminBulk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        ids: z.array(z.string()).min(1).max(100),
        action: z.enum(["publish", "draft", "archive", "category", "price"]),
        categoryId: z.string().optional(),
        percent: z.number().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { bulkProducts } = await import("./admin.server");
    return guard(() => bulkProducts(context.userId, data));
  });

export const adminSaveImage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        productId: z.string().min(1),
        dataUrl: z.string().optional(),
        url: z.string().optional(),
        alt: z.string().max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { saveImage } = await import("./admin.server");
    return guard(() => saveImage(context.userId, data));
  });

export const adminUpdateImage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().min(1),
        alt: z.string().optional(),
        cover: z.boolean().optional(),
        delete: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { updateImage } = await import("./admin.server");
    return guard(() => updateImage(context.userId, data));
  });

export const adminFloor = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { managerFloor } = await import("./admin.server");
    return guard(() => managerFloor(context.userId));
  });

export const adminInventory = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listInventory } = await import("./admin.server");
    return guard(() => listInventory(context.userId));
  });

export const adminAdjustStock = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ variantId: z.string(), delta: z.number().int(), note: z.string().max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { adjustStock } = await import("./admin.server");
    return guard(() => adjustStock(context.userId, data));
  });

export const adminOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ q: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { listOrders } = await import("./admin.server");
    return guard(() => listOrders(context.userId, data.q ?? ""));
  });

export const adminOrder = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { orderDetail } = await import("./admin.server");
    return guard(() => orderDetail(context.userId, data.id));
  });

export const adminFulfill = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ id: z.string(), carrier: z.string().max(80), tracking: z.string().max(80), carrierId: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { fulfillOrder } = await import("./admin.server");
    return guard(() => fulfillOrder(context.userId, data));
  });

export const adminRefund = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string(),
        amountCents: z.number().int().positive(),
        reason: z.string().max(200),
        restock: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { refundOrder } = await import("./admin.server");
    return guard(() => refundOrder(context.userId, data));
  });

export const adminCancel = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { cancelOrder } = await import("./admin.server");
    return guard(() => cancelOrder(context.userId, data.id));
  });

export const adminResolveService = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ id: z.string().min(1), action: z.enum(["refund", "reject"]), restock: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveService } = await import("./admin.server");
    return guard(() => resolveService(context.userId, data));
  });

export const adminAccept = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { acceptOrder } = await import("./admin.server");
    return guard(() => acceptOrder(context.userId, data.id));
  });

export const adminAcceptMany = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ ids: z.array(z.string().min(1)).max(50) }).parse(input))
  .handler(async ({ data, context }) => {
    const { acceptOrders } = await import("./admin.server");
    return guard(() => acceptOrders(context.userId, data.ids));
  });

export const adminCarriers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listCarriers } = await import("./admin.server");
    return guard(() => listCarriers(context.userId));
  });

export const adminSaveCarrier = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({
      id: z.string().min(1).optional(),
      name: z.string().trim().min(1).max(80),
      trackingUrl: z.string().trim().max(300),
      costCents: z.number().int().min(0),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { saveCarrier } = await import("./admin.server");
    return guard(() => saveCarrier(context.userId, data));
  });

export const adminBroadcast = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ subject: z.string().trim().min(2).max(140), body: z.string().trim().min(2).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { broadcastCustomers } = await import("./admin.server");
    return guard(() => broadcastCustomers(context.userId, data));
  });

export const adminCustomers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listCustomers } = await import("./admin.server");
    return guard(() => listCustomers(context.userId));
  });

export const adminSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { loadSettings } = await import("./admin.server");
    return guard(() => loadSettings(context.userId));
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.record(z.string(), z.unknown()).parse(input))
  .handler(async ({ data, context }) => {
    const { saveSettings } = await import("./admin.server");
    return guard(() => saveSettings(context.userId, data as never));
  });

export const adminImport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ csv: z.string().max(200_000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { importCsv } = await import("./admin.server");
    return guard(() => importCsv(context.userId, data.csv));
  });

export const publishedSlugs = createServerFn({ method: "GET" }).handler(async () => {
  const { loadPublished, readSettings } = await import("./catalog.server");
  const [products, settings] = await Promise.all([loadPublished(), readSettings()]);
  return {
    brand: settings.brandName,
    slugs: products.map((product) => product.slug),
  };
});
