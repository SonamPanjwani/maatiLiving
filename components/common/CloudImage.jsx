"use client";

// next-cloudinary's CldImage has no "use client" directive of its own, so it
// can't be rendered directly from a server component. Import this instead.
export { CldImage as default } from "next-cloudinary";
