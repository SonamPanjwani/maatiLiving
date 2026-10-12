"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from "lucide-react";
import { CldImage, CldUploadWidget } from "next-cloudinary";
import { isCloudinaryUploadConfigured } from "@/src/config/cloudinary";

// Manages an ordered list of Cloudinary images ({ publicId, alt }) and submits it
// as JSON in a hidden input. The first image is the cover.
export default function ImageManager({ name = "images", initialImages = [], folder, multiple = true }) {
  const [images, setImages] = useState(initialImages);

  const move = (from, to) => setImages((current) => {
    if (to < 0 || to >= current.length) return current;
    const next = [...current];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  });
  const update = (index, alt) => setImages((current) => current.map((image, i) => (i === index ? { ...image, alt } : image)));
  const remove = (index) => setImages((current) => current.filter((_, i) => i !== index));
  const add = (publicId) => setImages((current) => (multiple ? [...current, { publicId, alt: "" }] : [{ publicId, alt: current[0]?.alt ?? "" }]));

  return <div className="image-manager">
    <input type="hidden" name={name} value={JSON.stringify(images)} />

    {images.length > 0 && <ol className="image-grid">
      {images.map((image, index) => <li key={`${image.publicId}-${index}`} className="image-tile">
        <div className="image-thumb">
          <CldImage src={image.publicId} alt={image.alt || "Product photo"} width={240} height={240} crop="fill" gravity="auto" format="auto" quality="auto" />
          {multiple && index === 0 && <span className="image-badge">Cover</span>}
        </div>
        <input type="text" value={image.alt} onChange={(event) => update(index, event.target.value)} placeholder="Describe this photo" aria-label={`Description for photo ${index + 1}`} />
        <div className="image-actions">
          {multiple && <>
            <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} aria-label="Move left"><ArrowLeft size={14} /></button>
            <button type="button" onClick={() => move(index, 0)} disabled={index === 0} aria-label="Make cover photo"><Star size={14} /></button>
            <button type="button" onClick={() => move(index, index + 1)} disabled={index === images.length - 1} aria-label="Move right"><ArrowRight size={14} /></button>
          </>}
          <button type="button" onClick={() => remove(index)} aria-label="Remove photo"><Trash2 size={14} /></button>
        </div>
      </li>)}
    </ol>}

    {isCloudinaryUploadConfigured
      ? <CldUploadWidget
          signatureEndpoint="/api/cloudinary/sign"
          options={{ folder, multiple, maxFiles: multiple ? 20 : 1, sources: ["local", "camera", "url"], clientAllowedFormats: ["jpg", "jpeg", "png", "webp", "heic"], maxFileSize: 10_000_000 }}
          onSuccess={(result) => { if (result?.info?.public_id) add(result.info.public_id); }}
        >
          {({ open }) => <button type="button" className="admin-upload" onClick={() => open()}><ImagePlus size={16} />{multiple ? (images.length ? "Add more photos" : "Upload photos") : (images.length ? "Replace photo" : "Upload photo")}</button>}
        </CldUploadWidget>
      : <p className="admin-note">Photo uploads need NEXT_PUBLIC_CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env.local.</p>}
    {multiple && images.length > 1 && <p className="admin-note">The first photo is the cover. Use ★ to make a photo the cover, arrows to reorder.</p>}
  </div>;
}
