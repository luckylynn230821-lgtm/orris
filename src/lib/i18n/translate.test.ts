import assert from "node:assert/strict";
import test from "node:test";
import { parseLocale } from "./locales.ts";
import { localize } from "./text.ts";
import { translate } from "./translate.ts";

test("locale cookie defaults to English", () => {
  assert.equal(parseLocale(""), "en");
  assert.equal(parseLocale("other=1"), "en");
  assert.equal(parseLocale("orris_locale=zh"), "zh");
  assert.equal(parseLocale("a=1; orris_locale=zh-Hant"), "zh-Hant");
  assert.equal(parseLocale("orris_locale=fr"), "en");
});

test("catalogs fall back to English and interpolate", () => {
  assert.equal(translate("en", "account.title"), "My orders");
  assert.equal(translate("zh", "account.unpaid"), "待付款");
  assert.equal(translate("ja", "stage.toreceive.detail"), "発送済み、配送中です。");
  assert.equal(translate("ko", "event.reviewed", { rating: 4 }), "리뷰를 남겼습니다. 5점 중 4.");
  assert.equal(translate("zh-Hant", "missing.key"), "missing.key");
});

test("stored Chinese events localize", () => {
  const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
  assert.equal(localize("客户确认收货。状态变为待评价。", t), "Delivery confirmed. Status is now to review.");
  assert.match(localize("event.shipped\n" + JSON.stringify({ carrier: "ORRIS", tracking: "1" }), t), /ORRIS/);
});
