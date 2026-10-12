"use client";

import { useFormState } from "react-dom";
import { saveCategory } from "@/app/admin/actions";
import ImageManager from "./ImageManager";
import SubmitButton from "./SubmitButton";

export default function CategoryForm({ category, categories }) {
  const [state, formAction] = useFormState(saveCategory, { error: null });
  const c = category ?? { sortOrder: categories.length + 1 };
  const initialImages = c.image?.publicId ? [{ publicId: c.image.publicId, alt: c.image.alt }] : [];

  return <form action={formAction} className="admin-form" key={c.id ?? "new"}>
    {c.id && <input type="hidden" name="id" value={c.id} />}
    <label className="field"><span>Name</span><input name="name" defaultValue={c.name} required /></label>
    <label className="field"><span>Slug <small>leave blank to generate</small></span><input name="slug" defaultValue={c.slug} /></label>
    <label className="field"><span>Inside category <small>optional</small></span>
      <select name="parentId" defaultValue={c.parentId ?? ""}>
        <option value="">— None (top level) —</option>
        {categories.filter((option) => option.id !== c.id).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
    <label className="field"><span>Description</span><textarea name="description" rows={2} defaultValue={c.description} /></label>
    <label className="field"><span>Display order</span><input name="sortOrder" type="number" step="1" defaultValue={c.sortOrder} /></label>
    <div className="field"><span>Photo</span><ImageManager name="image" initialImages={initialImages} folder="maati-living/categories" multiple={false} /></div>
    {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
    <div className="admin-form-actions"><SubmitButton>{c.id ? "Save category" : "Add category"}</SubmitButton>{c.id && <a className="text-link" href="/admin/categories">Cancel</a>}</div>
  </form>;
}
