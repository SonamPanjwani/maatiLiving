// Woven-textile pattern used wherever a real photo isn't uploaded yet.
export default function TextilePlaceholder({ variant = "indigo", label = "Image placeholder" }) {
  return <div className={`textile textile-${variant}`} role="img" aria-label={label} />;
}
