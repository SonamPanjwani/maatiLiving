"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import CloudImage from "@/components/common/CloudImage";
import TextilePlaceholder from "@/components/common/TextilePlaceholder";
import { isCloudinaryConfigured } from "@/src/config/cloudinary";

// Swipeable (scroll-snap) main image with thumbnails; arrows on desktop.
export default function ProductGallery({ images, name }) {
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);
  const photos = isCloudinaryConfigured ? images.filter((image) => image.publicId) : [];

  if (photos.length === 0) {
    return <div className="gallery"><div className="gallery-track"><div className="gallery-slide"><TextilePlaceholder variant="rust" label={images[0]?.alt ?? name} /></div></div></div>;
  }

  const goTo = (index) => {
    const track = trackRef.current;
    const clamped = Math.max(0, Math.min(photos.length - 1, index));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track?.scrollTo({ left: clamped * track.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
  };
  const onScroll = (event) => {
    const track = event.currentTarget;
    setActive(Math.round(track.scrollLeft / track.clientWidth));
  };

  return <div className="gallery" role="region" aria-roledescription="carousel" aria-label={`${name} photos`}>
    <div className="gallery-main">
      <div className="gallery-track" ref={trackRef} onScroll={onScroll}>
        {photos.map((image, index) => <div className="gallery-slide" key={`${image.publicId}-${index}`} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${photos.length}`}>
          <CloudImage src={image.publicId} alt={image.alt || name} fill sizes="(max-width: 700px) 100vw, 55vw" crop="fill" gravity="auto" format="auto" quality="auto" priority={index === 0} />
        </div>)}
      </div>
      {photos.length > 1 && <>
        <span className="gallery-count">{String(active + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}</span>
        <button type="button" className="gallery-arrow gallery-prev" onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="Previous photo"><ArrowLeft size={18} /></button>
        <button type="button" className="gallery-arrow gallery-next" onClick={() => goTo(active + 1)} disabled={active === photos.length - 1} aria-label="Next photo"><ArrowRight size={18} /></button>
      </>}
    </div>
    {photos.length > 1 && <div className="gallery-thumbs">
      {photos.map((image, index) => <button type="button" key={`${image.publicId}-${index}`} className={index === active ? "is-active" : ""} onClick={() => goTo(index)} aria-label={`Show photo ${index + 1}`} aria-current={index === active ? "true" : undefined}>
        <CloudImage src={image.publicId} alt="" width={160} height={200} crop="fill" gravity="auto" format="auto" quality="auto" />
      </button>)}
    </div>}
  </div>;
}
