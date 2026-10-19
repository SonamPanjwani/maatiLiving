"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CldImage } from "next-cloudinary";
import { heroSlides } from "@/src/data/hero";
import { isCloudinaryConfigured } from "@/src/config/cloudinary";

function FallbackImage({ slide }) {
  return <div className={`textile textile-${slide.variant}`} role="img" aria-label={slide.alt} />;
}

export default function Hero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % heroSlides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [shouldReduceMotion]);

  const activeSlide = heroSlides[activeIndex];
  const publicId = activeSlide.mobilePublicId || activeSlide.publicId;

  return <section className="hero">
    <div className="hero-image">
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={activeSlide.id}
          className="hero-slide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, scale: shouldReduceMotion ? 1 : 1.03 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: shouldReduceMotion ? 0.25 : 1.5 }, scale: { duration: 6.5, ease: "linear" } }}
        >
          {isCloudinaryConfigured && activeSlide.publicId
            ? <CldImage src={publicId} alt={activeSlide.alt} fill priority={activeIndex === 0} loading={activeIndex === 0 ? "eager" : "lazy"} sizes="100vw" crop="fill" gravity="auto" format="auto" quality="auto" />
            : <FallbackImage slide={activeSlide} />}
        </motion.div>
      </AnimatePresence>
    </div>
    <div className="hero-copy">
      <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }} className="hero-brand">Maati <em>Living</em></motion.p>
      <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35 }}>Thoughtfully chosen.<br /><em>Naturally better.</em></motion.h1>
      <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .5 }} className="hero-description">Discover things made with thought, meant for everyday life.</motion.p>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .65 }} className="hero-actions"><a className="button button-light" href="#collection">Explore the collection <ArrowUpRight size={16} /></a><a className="text-link" href="#story">Our story</a></motion.div>
    </div>
    <div className="hero-foot"><span>NATURAL · HANDCRAFTED · THOUGHTFUL</span><ArrowDown size={17} /></div>
  </section>;
}
