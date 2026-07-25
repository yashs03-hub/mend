"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { landingCopy, PRODUCT_SURFACES } from "./copy";
import { useLandingMotion } from "./motion";

export function Surfaces() {
  const { fadeUp, staggerContainer, viewportOnce, reduce, initial } =
    useLandingMotion();
  const c = landingCopy.surfaces;

  return (
    <section
      id="product"
      className="scroll-mt-8 border-t border-line px-6 py-20 sm:px-10 sm:py-28 lg:px-14"
    >
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial={initial}
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.p variants={fadeUp} className="eyebrow">
          {c.eyebrow}
        </motion.p>
        <motion.h2
          variants={fadeUp}
          className="mt-4 font-heading text-heading tracking-tight text-ink"
        >
          {c.title}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-4 max-w-xl font-serif text-lede text-ink-secondary"
        >
          {c.support}
        </motion.p>
        <nav aria-label="Product surfaces" className="mt-12 flex flex-col">
          {PRODUCT_SURFACES.map((surface) => (
            <motion.div key={surface.href} variants={fadeUp}>
              <Link
                href={surface.href}
                className={`group flex min-h-14 items-baseline justify-between gap-6 border-t border-line py-5 transition-transform last:border-b ${
                  reduce ? "" : "hover:translate-x-1"
                } ${"quiet" in surface && surface.quiet ? "opacity-80" : ""}`}
              >
                <span className="font-heading text-subhead text-ink group-hover:text-ink-secondary">
                  {surface.label}
                </span>
                <span className="text-label text-ink-tertiary">{surface.note}</span>
              </Link>
            </motion.div>
          ))}
        </nav>
      </motion.div>
    </section>
  );
}
