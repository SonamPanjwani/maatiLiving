"use client";

import { useFormState } from "react-dom";
import { saveProduct } from "@/app/admin/actions";
import ImageManager from "./ImageManager";
import SubmitButton from "./SubmitButton";

export default function ProductForm({ product, categories }) {
  const [state, formAction] = useFormState(saveProduct, { error: null });
  const p = product ?? { available: true, featured: false, images: [], materials: [] };

  return <form action={formAction} className="admin-form admin-form-wide">
    {p.id && <input type="hidden" name="id" value={p.id} />}

    <fieldset>
      <legend className="eyebrow">Photos</legend>
      <ImageManager initialImages={p.images} folder="maati-living/products" />
    </fieldset>

    <fieldset>
      <legend className="eyebrow">Basics</legend>
      <label className="field"><span>Name</span><input name="name" defaultValue={p.name} required /></label>
      <div className="field-row">
        <label className="field"><span>Category</span>
          <select name="categoryId" defaultValue={p.category?.id ?? ""} required>
            <option value="" disabled>Choose a category</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.parentSlug ? `${categories.find((c) => c.slug === category.parentSlug)?.name ?? ""} › ` : ""}{category.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Price (₹)</span><input name="price" type="number" min="1" step="1" defaultValue={p.price != null ? p.price / 100 : ""} required /></label>
        {p.id
          ? <div className="field"><span>Stock</span><p className="stock-readonly"><strong>{p.stock}</strong> <a className="inline-link" href={`/admin/inventory/${p.id}`}>Adjust stock</a> <small>(save other changes first)</small></p></div>
          : <label className="field"><span>Initial stock</span><input name="stock" type="number" min="0" step="1" defaultValue={0} required /></label>}
      </div>
      <div className="field-row">
        <label className="field"><span>Slug <small>web address — leave blank to generate</small></span><input name="slug" defaultValue={p.slug} /></label>
        <label className="field"><span>SKU</span><input name="sku" defaultValue={p.sku} /></label>
      </div>
      <div className="field-checks">
        <label><input type="checkbox" name="available" defaultChecked={p.available} /> Visible in shop</label>
        <label><input type="checkbox" name="featured" defaultChecked={p.featured} /> Featured on home page</label>
      </div>
    </fieldset>

    <fieldset>
      <legend className="eyebrow">Story & details</legend>
      <label className="field"><span>Short description</span><textarea name="shortDescription" rows={2} defaultValue={p.shortDescription} /></label>
      <label className="field"><span>Sourcing note <small>one line under the name, e.g. “Hand carved in Kerala”</small></span><input name="sourcingNote" defaultValue={p.sourcingNote} /></label>
      <label className="field"><span>Materials <small>one per line or comma separated</small></span><textarea name="materials" rows={3} defaultValue={p.materials.join("\n")} /></label>
      <div className="field-row">
        <label className="field"><span>Artisan / maker</span><input name="artisan" defaultValue={p.artisan} /></label>
        <label className="field"><span>Region</span><input name="region" defaultValue={p.region} /></label>
      </div>
      <label className="field"><span>Care</span><textarea name="care" rows={2} defaultValue={p.care} /></label>
    </fieldset>

    {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
    <div className="admin-form-actions"><SubmitButton>{p.id ? "Save changes" : "Add product"}</SubmitButton><a className="text-link" href="/admin/products">Cancel</a></div>
  </form>;
}
