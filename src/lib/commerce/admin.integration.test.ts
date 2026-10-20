import assert from "node:assert/strict";
import test from "node:test";

test("isolated desk: login binding, roles, catalog, orders, and books", async (t) => {
  if (process.env.DATABASE_URL?.trim()) {
    t.skip("DATABASE_URL is set; this write test must not touch Neon");
    return;
  }
  process.env.VERCEL_ENV = "test";
  delete process.env.OWNER_EMAIL;

  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  try {
    const { getSql } = await vite.ssrLoadModule("/src/lib/db.ts");
    const { ensureSeeded } = await vite.ssrLoadModule("/src/lib/commerce/seed.server.ts");
    const {
      adminCatalog,
      deskSession,
      grantSeat,
      listOrders,
      loadSettings,
      refundOrder,
      saveProduct,
    } = await vite.ssrLoadModule("/src/lib/commerce/admin.server.ts");
    const { loadAnalytics } = await vite.ssrLoadModule("/src/lib/commerce/analytics.server.ts");
    const sql = (await getSql()) as {
      query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
    };
    await ensureSeeded();

    const addUser = async (id: string, email: string, verified: boolean, providerId: string) => {
      await sql.query(
        `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
         values ($1, $2, $3, $4, now(), now())`,
        [id, email, email, verified],
      );
      await sql.query(
        `insert into account (id, "accountId", "providerId", "userId", "createdAt", "updatedAt")
         values ($1, $2, $3, $4, now(), now())`,
        [`acc_${id}`, `sub_${id}`, providerId, id],
      );
    };

    const ownerEmail = "luckylynn230821@gmail.com";
    await addUser("user_owner", ownerEmail, false, "grok-google");
    await assert.rejects(() => deskSession("user_owner"), /err\.notOnDesk/);
    const membersAfterReject = await sql.query(`select count(*)::int as n from store_members`);
    assert.equal(Number(membersAfterReject[0]?.n), 0);

    await sql.query(`update "user" set "emailVerified" = true where id = $1`, ["user_owner"]);
    const owner = await deskSession("user_owner");
    assert.equal(owner.role, "owner");
    assert.equal(owner.permissions.money, true);
    assert.equal(owner.permissions.settings, true);

    await addUser("user_x", "x-only@example.com", true, "grok-x");
    await assert.rejects(() => deskSession("user_x"), /err\.notOnDesk/);

    await addUser("user_staff", "staff-desk@example.com", true, "grok-google");
    await addUser("user_manager", "manager-desk@example.com", true, "grok-google");
    await grantSeat("user_owner", { email: "staff-desk@example.com", role: "staff" });
    await grantSeat("user_owner", { email: "manager-desk@example.com", role: "manager" });

    const staff = await deskSession("user_staff");
    assert.equal(staff.role, "staff");
    assert.equal(staff.permissions.money, false);
    assert.equal(staff.permissions.refund, false);
    assert.equal(staff.permissions.catalog, false);
    assert.equal(staff.permissions.fulfill, true);

    const manager = await deskSession("user_manager");
    assert.equal(manager.permissions.catalog, true);
    assert.equal(manager.permissions.money, false);
    assert.equal(manager.permissions.settings, false);
    await assert.rejects(() => loadSettings("user_manager"), /err\.forbidden/);

    const orders = await listOrders("user_owner", "");
    assert.ok(orders.length > 0);
    const sample = orders[0];
    const before = await sql.query(`select refunded_cents from orders where id = $1`, [sample.id]);
    await assert.rejects(
      () => refundOrder("user_staff", { id: sample.id, amountCents: 100, reason: "no", restock: false }),
      /err\.forbidden/,
    );
    const after = await sql.query(`select refunded_cents from orders where id = $1`, [sample.id]);
    assert.equal(Number(after[0]?.refunded_cents), Number(before[0]?.refunded_cents));

    const saved = await saveProduct("user_manager", {
      name: "Desk test bowl",
      slug: "desk-test-bowl",
      description: "A bowl for the isolated desk test.",
      story: "",
      categoryId: "cat_textiles",
      tags: ["test"],
      status: "published",
      seoTitle: "",
      seoDescription: "",
      variants: [
        {
          sku: "DESK-BOWL-1",
          title: "One",
          priceCents: 1800,
          costCents: 400,
          inventoryQty: 4,
        },
      ],
    });
    const catalog = await adminCatalog("user_owner");
    const product = catalog.products.find((item: { id: string }) => item.id === saved.id);
    assert.equal(product?.status, "published");
    await assert.rejects(
      () =>
        saveProduct("user_staff", {
          name: "Staff cannot publish",
          slug: "staff-cannot-publish",
          description: "no",
          story: "",
          categoryId: "cat_textiles",
          tags: [],
          status: "published",
          seoTitle: "",
          seoDescription: "",
          variants: [{ sku: "NO-STAFF", title: "One", priceCents: 100, costCents: 10, inventoryQty: 1 }],
        }),
      /err\.forbidden/,
    );

    const settings = await loadSettings("user_owner");
    assert.equal(typeof settings.brandName, "string");

    const hidden = await loadAnalytics({ range: "30d", includeDemo: false });
    const shown = await loadAnalytics({ range: "30d", includeDemo: true });
    assert.ok(shown.kpis.orders > hidden.kpis.orders);
  } finally {
    await vite.close();
  }
});
