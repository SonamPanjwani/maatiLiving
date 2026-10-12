import CategoryForm from "@/components/admin/CategoryForm";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import { deleteCategory } from "@/app/admin/actions";
import { adminCountProductsByCategory, adminGetCategories } from "@/src/lib/admin-catalog";

export default async function AdminCategoriesPage({ searchParams }) {
  const [categories, counts] = await Promise.all([adminGetCategories(), adminCountProductsByCategory()]);
  const editing = categories.find((category) => category.id === searchParams?.edit) ?? null;
  const nameOf = (slug) => categories.find((category) => category.slug === slug)?.name;

  return <>
    <div className="admin-heading"><div><p className="eyebrow">CATALOGUE</p><h1>Categories</h1></div></div>
    {searchParams?.saved && <p className="admin-success" role="status">Saved “{searchParams.saved}”.</p>}
    {searchParams?.error && <p className="admin-error" role="alert">{searchParams.error}</p>}

    <div className="admin-split">
      <div>
        {categories.length === 0
          ? <p className="admin-empty">No categories yet — add one with the form.</p>
          : <table className="admin-table">
              <thead><tr><th>Order</th><th>Name</th><th>Inside</th><th>Products</th><th /></tr></thead>
              <tbody>
                {categories.map((category) => <tr key={category.id} className={category.id === editing?.id ? "is-editing" : ""}>
                  <td>{category.sortOrder}</td>
                  <td><a href={`/admin/categories?edit=${category.id}`}><strong>{category.name}</strong></a><small>/{category.slug}</small></td>
                  <td>{category.parentSlug ? nameOf(category.parentSlug) : "—"}</td>
                  <td>{counts[category.id] ?? 0}</td>
                  <td className="admin-table-actions">
                    <a className="text-link" href={`/admin/categories?edit=${category.id}`}>Edit</a>
                    <form action={deleteCategory}><input type="hidden" name="id" value={category.id} /><ConfirmSubmit message={`Delete the “${category.name}” category?`}>Delete</ConfirmSubmit></form>
                  </td>
                </tr>)}
              </tbody>
            </table>}
      </div>
      <aside className="admin-panel">
        <p className="eyebrow">{editing ? "EDIT CATEGORY" : "NEW CATEGORY"}</p>
        <CategoryForm category={editing} categories={categories} />
      </aside>
    </div>
  </>;
}
