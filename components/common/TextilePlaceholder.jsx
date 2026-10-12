export default function TextilePlaceholder({ variant = "indigo", label = "Image placeholder" }) {
  return <div className={`textile textile-${variant}`} role="img" aria-label={`${label} — replace with final photography`}><span>TEXTILE STUDY / REPLACE WITH FINAL IMAGE</span></div>;
}
