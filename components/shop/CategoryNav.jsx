import Link from "next/link";

// Top-level categories, plus a second row for the active branch's sub-categories.
export default function CategoryNav({ categories, activeSlug = null }) {
  const active = categories.find((category) => category.slug === activeSlug);
  const topLevel = categories.filter((category) => !category.parentSlug);
  const branchSlug = active?.parentSlug ?? active?.slug;
  const children = categories.filter((category) => branchSlug && category.parentSlug === branchSlug);
  // is-parent marks the top-level category when one of its sub-categories is open.
  const stateClass = (slug) => (slug === activeSlug ? "is-active" : slug === branchSlug ? "is-parent" : "");

  return <nav className="category-nav" aria-label="Shop categories">
    <ul>
      <li><Link href="/shop" className={!activeSlug ? "is-active" : ""} aria-current={!activeSlug ? "page" : undefined}>All</Link></li>
      {topLevel.map((category) => <li key={category.slug}><Link href={`/shop/${category.slug}`} className={stateClass(category.slug)} aria-current={category.slug === activeSlug ? "page" : undefined}>{category.name}</Link></li>)}
    </ul>
    {children.length > 0 && <ul className="category-nav-sub">
      {children.map((category) => <li key={category.slug}><Link href={`/shop/${category.slug}`} className={stateClass(category.slug)} aria-current={category.slug === activeSlug ? "page" : undefined}>{category.name}</Link></li>)}
    </ul>}
  </nav>;
}
