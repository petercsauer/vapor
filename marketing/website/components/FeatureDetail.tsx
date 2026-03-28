"use client";

import { motion } from "framer-motion";
import { useState } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface FeatureDetailProps {
  title: string;
  description: string;
  imageSide: "left" | "right";
  imageAlt: string;
  imageKey: string;
}

export function FeatureDetail({
  title,
  description,
  imageSide,
  imageAlt,
  imageKey,
}: FeatureDetailProps) {
  const isLeft = imageSide === "left";
  const [isHovered, setIsHovered] = useState(false);

  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div
          className={`flex flex-col ${
            isLeft ? "lg:flex-row" : "lg:flex-row-reverse"
          } gap-12 items-center`}
        >
          {/* Image */}
          <motion.div
            layout
            className="relative w-full cursor-pointer"
            style={{
              flex: isHovered ? "1 1 70%" : "1 1 50%",
            }}
            initial={{ opacity: 0, x: isLeft ? -40 : 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{
              opacity: { duration: 0.8 },
              x: { duration: 0.8 },
              flex: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
              layout: { duration: 0.6, ease: [0.4, 0, 0.2, 1] }
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="relative aspect-[3/2] w-full">
              {/* Pure frosted glass blur effect - behind the image */}
              <motion.div
                className="absolute rounded-xl overflow-hidden"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.45)',
                  backdropFilter: 'blur(40px)',
                  WebkitBackdropFilter: 'blur(40px)',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 0,
                  border: '1px solid rgba(128, 128, 128, 0.3)',
                  boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.1), 0 20px 40px rgba(0, 0, 0, 0.5)',
                }}
                animate={{
                  boxShadow: isHovered
                    ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.2), 0 30px 60px rgba(0, 0, 0, 0.7)'
                    : 'inset 0 0 0 1px rgba(255, 255, 255, 0.1), 0 20px 40px rgba(0, 0, 0, 0.5)',
                }}
                transition={{ duration: 0.4 }}
              />
              <img
                src={`${basePath}/screenshots/${imageKey}.webp`}
                alt={imageAlt}
                className="absolute inset-0 w-full h-full object-cover rounded-xl relative"
                style={{ zIndex: 1 }}
              />
            </div>
          </motion.div>

          {/* Text */}
          <motion.div
            layout
            className="w-full"
            style={{
              flex: isHovered ? "0 0 30%" : "1 1 50%",
            }}
            initial={{ opacity: 0, x: isLeft ? 40 : -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            animate={{
              opacity: isHovered ? 0.3 : 1,
            }}
            transition={{
              opacity: { duration: 0.4 },
              x: { duration: 0.8, delay: 0.2 },
              flex: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
              layout: { duration: 0.6, ease: [0.4, 0, 0.2, 1] }
            }}
          >
            <h3 className="text-4xl md:text-5xl font-bold mb-6 text-white">{title}</h3>
            <p className="text-xl text-white/60 leading-relaxed font-light">
              {description}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
