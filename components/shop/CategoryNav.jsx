import Link from "next/link";

// Category chips: All + top-level categories, then the open branch's sub-categories, each with a count
// ("Diyas · 4"). counts: { [slug]: pieces, all: pieces } (a category's count includes its sub-categories).
export default function CategoryNav({ categories, activeSlug = null, counts = {} }) {
  const active = categories.find((category) => category.slug === activeSlug);
  const topLevel = categories.filter((category) => !category.parentSlug);
  const branchSlug = active?.parentSlug ?? active?.slug;
  const children = categories.filter((category) => branchSlug && category.parentSlug === branchSlug);
  const chip = (href, label, slug, isActive) => <li key={href}>
    <Link href={href} className={`shop-chip${isActive ? " is-active" : slug === branchSlug && !isActive ? " is-parent" : ""}`} aria-current={isActive ? "page" : undefined}>
      <span>{label}</span>{counts[slug] != null && <span className="shop-chip-count">· {counts[slug]}</span>}
    </Link>
  </li>;

  return <nav className="shop-chips" aria-label="Shop categories">
    <ul>
      {chip("/shop", "All", "all", !activeSlug)}
      {topLevel.map((category) => chip(`/shop/${category.slug}`, category.name, category.slug, category.slug === activeSlug))}
    </ul>
    {children.length > 0 && <ul className="shop-chips-sub">
      {children.map((category) => chip(`/shop/${category.slug}`, category.name, category.slug, category.slug === activeSlug))}
    </ul>}
  </nav>;
}
