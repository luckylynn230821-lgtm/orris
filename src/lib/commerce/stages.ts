export type StageKey = "unpaid" | "toship" | "toreceive" | "toreview" | "aftersales" | "done" | "cancelled";

export type StageInput = {
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  reviewed: boolean;
  serviceStatus: string;
  isDemo: boolean;
};

export type Stage = {
  key: StageKey;
  label: string;
  detail: string;
  admin: string;
};

export function stageOf(input: StageInput): Stage {
  if (input.status === "cancelled" || input.fulfillmentStatus === "cancelled") {
    return { key: "cancelled", label: "stage.cancelled.label", detail: "stage.cancelled.detail", admin: "stage.cancelled.admin" };
  }
  if (input.serviceStatus === "open") {
    return { key: "aftersales", label: "stage.aftersalesOpen.label", detail: "stage.aftersalesOpen.detail", admin: "stage.aftersalesOpen.admin" };
  }
  if (input.paymentStatus === "refunded") {
    return { key: "aftersales", label: "stage.refunded.label", detail: "stage.refunded.detail", admin: "stage.refunded.admin" };
  }
  if (input.paymentStatus === "partially_refunded") {
    return { key: "aftersales", label: "stage.partial.label", detail: "stage.partial.detail", admin: "stage.partial.admin" };
  }
  if (input.paymentStatus === "unpaid" || input.paymentStatus === "failed") {
    return { key: "unpaid", label: "stage.unpaid.label", detail: "stage.unpaid.detail", admin: "stage.unpaid.admin" };
  }
  if (input.fulfillmentStatus === "shipped") {
    return { key: "toreceive", label: "stage.toreceive.label", detail: "stage.toreceive.detail", admin: "stage.toreceive.admin" };
  }
  if (input.fulfillmentStatus === "fulfilled") {
    if (input.reviewed || input.isDemo) {
      return input.isDemo
        ? { key: "done", label: "stage.doneDemo.label", detail: "stage.doneDemo.detail", admin: "stage.doneDemo.admin" }
        : { key: "done", label: "stage.done.label", detail: "stage.done.detail", admin: "stage.done.admin" };
    }
    return { key: "toreview", label: "stage.toreview.label", detail: "stage.toreview.detail", admin: "stage.toreview.admin" };
  }
  return { key: "toship", label: "stage.toship.label", detail: "stage.toship.detail", admin: "stage.toship.admin" };
}
