import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminError, useDeskAccess } from "@/components/admin/frame";
import { Button, Field } from "@/components/ui";
import { adminGetProduct, adminProducts, adminSaveImage, adminSaveProduct, adminUpdateImage } from "@/lib/commerce/fns";
import { centsToInput, dollarsToCents } from "@/lib/format";
import { localize } from "@/lib/i18n/text";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/admin/products/$id")({
  component: Editor,
  head: () => ({ meta: [{ title: "Edit product — Merchant desk" }] }),
});

type VariantDraft = {
  id?: string;
  sku: string;
  title: string;
  option1Name: string;
  option1Value: string;
  option2Name: string;
  option2Value: string;
  price: string;
  compare: string;
  cost: string;
  inventory: string;
};

function blankVariant(): VariantDraft {
  return { sku: "", title: "Default", option1Name: "", option1Value: "", option2Name: "", option2Value: "", price: "0.00", compare: "", cost: "0.00", inventory: "0" };
}

function Editor() {
  const { id } = Route.useParams();
  const { t, tx } = useT();
  const seeCost = useDeskAccess()?.permissions.money ?? false;
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [story, setStory] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>([blankVariant()]);
  const [images, setImages] = useState<{ id: string; url: string; alt: string; isCover: boolean }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void adminProducts().then((catalog) => {
      setCategories(catalog.categories);
      if (!categoryId && catalog.categories[0]) setCategoryId(catalog.categories[0].id);
    });
    if (id === "new") return;
    void adminGetProduct({ data: { id } })
      .then((product) => {
        if (!product) {
          setError(t("desk.notFoundProduct"));
          return;
        }
        setName(product.name);
        setSlug(product.slug);
        setDescription(product.description);
        setStory(product.story);
        setCategoryId(product.categoryId);
        setTags(product.tags.join(", "));
        setStatus((product.status as "draft" | "published" | "archived") || "draft");
        setSeoTitle(product.seoTitle);
        setSeoDescription(product.seoDescription);
        setImages(product.images);
        setVariants(
          product.variants.map((variant) => ({
            id: variant.id,
            sku: variant.sku,
            title: variant.title,
            option1Name: variant.option1Name ?? "",
            option1Value: variant.option1Value ?? "",
            option2Name: variant.option2Name ?? "",
            option2Value: variant.option2Value ?? "",
            price: centsToInput(variant.priceCents),
            compare: variant.compareAtCents ? centsToInput(variant.compareAtCents) : "",
            cost: centsToInput("costCents" in variant ? Number(variant.costCents) : 0),
            inventory: String(variant.inventoryQty),
          })),
        );
      })
      .catch((err: unknown) => setError(err instanceof Error ? localize(err.message, tx) : t("admin.failed")));
  }, [id]);

  return (
    <form
      className="max-w-3xl space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        void adminSaveProduct({
          data: {
            id: id === "new" ? undefined : id,
            name,
            slug,
            description,
            story,
            categoryId,
            tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
            status,
            seoTitle,
            seoDescription,
            variants: variants.map((variant) => ({
              id: variant.id,
              sku: variant.sku,
              title: variant.title,
              option1Name: variant.option1Name || null,
              option1Value: variant.option1Value || null,
              option2Name: variant.option2Name || null,
              option2Value: variant.option2Value || null,
              priceCents: dollarsToCents(variant.price),
              compareAtCents: variant.compare ? dollarsToCents(variant.compare) : null,
              costCents: dollarsToCents(variant.cost),
              inventoryQty: Number(variant.inventory) || 0,
            })),
          },
        })
          .then((result) => {
            toast(t("desk.saved"));
            if (id === "new") void navigate({ to: "/admin/products/$id", params: { id: result.id } });
          })
          .catch((err: unknown) => setError(err instanceof Error ? localize(err.message, tx) : t("admin.failed")))
          .finally(() => setSaving(false));
      }}
    >
      <h1 className="text-4xl">{id === "new" ? t("admin.newProduct") : t("admin.editProduct")}</h1>
      {error ? <AdminError message={error} /> : null}
      <Field label={t("desk.productName")} value={name} onChange={(event) => setName(event.target.value)} required />
      <Field label={t("desk.slug")} value={slug} onChange={(event) => setSlug(event.target.value)} placeholder={t("desk.slugHint")} />
      <label className="block text-sm">
        <span className="mb-1.5 block text-xs tracking-[0.14em] text-ash uppercase">{t("desk.description")}</span>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="h-28 w-full border border-line bg-paper p-3" />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block text-xs tracking-[0.14em] text-ash uppercase">{t("desk.care")}</span>
        <textarea value={story} onChange={(event) => setStory(event.target.value)} className="h-24 w-full border border-line bg-paper p-3" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1.5 block text-xs tracking-[0.14em] text-ash uppercase">{t("desk.category")}</span>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="h-11 w-full border border-line bg-paper px-3">
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block text-xs tracking-[0.14em] text-ash uppercase">{t("desk.status")}</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-11 w-full border border-line bg-paper px-3">
            <option value="draft">{t("desk.draft")}</option>
            <option value="published">{t("desk.published")}</option>
            <option value="archived">{t("desk.archived")}</option>
          </select>
        </label>
      </div>
      <Field label={t("desk.tags")} value={tags} onChange={(event) => setTags(event.target.value)} />
      <Field label={t("desk.seoTitle")} value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
      <Field label={t("desk.seoDescription")} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl">{t("desk.variants")}</h2>
          <button type="button" className="text-sm underline" onClick={() => setVariants((current) => [...current, blankVariant()])}>{t("desk.addVariant")}</button>
        </div>
        {variants.map((variant, index) => (
          <div key={variant.id ?? index} className="grid gap-3 border border-line bg-paper p-3 sm:grid-cols-4">
            <Field label={t("desk.sku")} value={variant.sku} onChange={(event) => update(setVariants, index, { sku: event.target.value })} />
            <Field label={t("desk.variantTitle")} value={variant.title} onChange={(event) => update(setVariants, index, { title: event.target.value })} />
            <Field label={t("desk.price")} value={variant.price} onChange={(event) => update(setVariants, index, { price: event.target.value })} />
            <Field label={t("desk.compareAt")} value={variant.compare} onChange={(event) => update(setVariants, index, { compare: event.target.value })} />
            {seeCost ? <Field label={t("desk.cost")} value={variant.cost} onChange={(event) => update(setVariants, index, { cost: event.target.value })} /> : null}
            <Field label={t("desk.stock")} value={variant.inventory} onChange={(event) => update(setVariants, index, { inventory: event.target.value })} />
            <Field label={t("desk.option")} value={variant.option1Name} onChange={(event) => update(setVariants, index, { option1Name: event.target.value })} placeholder={t("desk.sizeHint")} />
            <Field label={t("desk.optionValue")} value={variant.option1Value} onChange={(event) => update(setVariants, index, { option1Value: event.target.value })} />
          </div>
        ))}
      </div>
      {id !== "new" ? (
        <div>
          <h2 className="text-2xl">{t("desk.images")}</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {images.map((image) => (
              <figure key={image.id} className="bg-paper p-2">
                <img src={image.url} alt={image.alt} className="aspect-[3/4] w-full object-cover" />
                <div className="mt-2 flex gap-2 text-xs">
                  <button type="button" onClick={() => void adminUpdateImage({ data: { id: image.id, cover: true } }).then(() => toast(t("desk.coverSet")))}>{t("desk.cover")}</button>
                  <button type="button" onClick={() => void adminUpdateImage({ data: { id: image.id, delete: true } }).then(() => setImages((current) => current.filter((item) => item.id !== image.id)))}>{t("desk.remove")}</button>
                </div>
              </figure>
            ))}
          </div>
          <label className="mt-3 block text-sm">
            {t("desk.uploadHint")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-2 block"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file || id === "new") return;
                const reader = new FileReader();
                reader.onload = () => {
                  const dataUrl = String(reader.result || "");
                  void adminSaveImage({ data: { productId: id, dataUrl, alt: name } })
                    .then((saved) => setImages((current) => [...current, { id: saved.id, url: dataUrl, alt: name, isCover: current.length === 0 }]))
                    .catch((err: unknown) => toast(err instanceof Error ? localize(err.message, tx) : t("admin.failed")));
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
        </div>
      ) : (
        <p className="text-sm text-ash">{t("desk.saveFirst")}</p>
      )}
      <Button type="submit" disabled={saving}>{saving ? t("desk.saving") : t("desk.saveProduct")}</Button>
    </form>
  );
}

function update<T>(set: (fn: (current: T[]) => T[]) => void, index: number, patch: Partial<T>) {
  set((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
}
