// Skeleton while Books pages load.
export default function BooksLoading() {
  return <div className="skeleton" aria-busy="true" aria-label="Loading">
    <div className="skeleton-line skeleton-title" />
    <div className="skeleton-line" />
    <div className="skeleton-line" />
    <div className="skeleton-line skeleton-short" />
  </div>;
}
