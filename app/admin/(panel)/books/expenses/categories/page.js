import { addExpenseCategory, setExpenseCategoryStatus, updateExpenseCategory } from "@/app/admin/(panel)/books/expenses/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import SubmitButton from "@/components/admin/SubmitButton";
import { booksGetExpenseCategories, booksGetExpenseCategoryCounts } from "@/src/lib/books/data";

const SAVED = { added: "Category added.", updated: "Category saved.", archived: "Category archived.", active: "Category restored." };

export default async function ExpenseCategoriesPage({ searchParams }) {
  const [categories, counts] = await Promise.all([booksGetExpenseCategories(), booksGetExpenseCategoryCounts()]);
  const active = categories.filter((category) => category.status === "active");
  const archived = categories.filter((category) => category.status === "archived");

  const row = (category) => <tr key={category.id} className={category.status === "archived" ? "is-void" : ""}>
    <td data-label="Category">
      <form action={updateExpenseCategory} className="inline-form">
        <input type="hidden" name="id" value={category.id} />
        <label><small>Name</small><input name="name" defaultValue={category.name} required minLength={2} maxLength={60} aria-label={`Name of ${category.name}`} /></label>
        <label><small>Order</small><input name="sortOrder" type="number" inputMode="numeric" min="0" step="1" defaultValue={category.sort_order} className="order-input" aria-label={`Order of ${category.name}`} /></label>
        <SubmitButton className="stock-save" pendingLabel="…">Save</SubmitButton>
      </form>
    </td>
    <td data-label="Expenses" className="num">{counts[category.id] ?? 0}</td>
    <td className="table-action">
      <form action={setExpenseCategoryStatus}>
        <input type="hidden" name="id" value={category.id} />
        <input type="hidden" name="status" value={category.status === "active" ? "archived" : "active"} />
        {category.status === "active"
          ? <ConfirmSubmit className="text-link" message={`Archive ${category.name}? Its expenses stay as they are; it just won't be offered for new ones.`}>Archive</ConfirmSubmit>
          : <SubmitButton className="text-link" pendingLabel="Saving…">Restore</SubmitButton>}
      </form>
    </td>
  </tr>;

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">BOOKS · EXPENSES</p><h1>Expense categories</h1></div>
      <a className="text-link" href="/admin/books/expenses">All expenses</a>
    </div>
    {searchParams?.saved && <p className="admin-success" role="status">{SAVED[searchParams.saved] ?? "Saved."}</p>}
    {searchParams?.error && <p className="admin-error" role="alert">{searchParams.error}</p>}

    <div className="admin-split">
      <section>
        <table className="admin-table table-cards">
          <thead><tr><th>Category <small className="muted">lower order shows first</small></th><th className="num">Expenses</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{active.map(row)}</tbody>
        </table>
        {archived.length > 0 && <>
          <h2 className="eyebrow books-side-block">ARCHIVED</h2>
          <table className="admin-table table-cards">
            <thead><tr><th>Category</th><th className="num">Expenses</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{archived.map(row)}</tbody>
          </table>
        </>}
      </section>
      <aside className="admin-panel books-side">
        <form action={addExpenseCategory} className="admin-form">
          <h2 className="eyebrow">ADD A CATEGORY</h2>
          <label className="field" htmlFor="cat-name"><span>Name</span><input id="cat-name" name="name" required minLength={2} maxLength={60} placeholder="e.g. Stalls & fairs" /></label>
          <SubmitButton>Add category</SubmitButton>
          <p className="admin-note">Categories are never deleted. Archive one you no longer use; its old expenses keep it.</p>
        </form>
      </aside>
    </div>
  </>;
}
