"use client";

import { motion } from "framer-motion";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-black">
      {/* Background video - fixed */}
      <div className="fixed inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src={`${basePath}/steam.mov`} />
        </video>
      </div>

      <div className="relative z-10 w-full max-w-[1800px] mx-auto px-6 md:px-12 py-12 md:py-20 flex flex-col lg:flex-row items-center gap-8 md:gap-16">
        {/* Left side - Large screenshot */}
        <motion.div
          className="flex-1 w-full"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1 }}
        >
          <div className="relative">
            <div className="relative">
              {/* Pure frosted glass blur effect - behind the image */}
              <div
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
              />
              <img
                src={`${basePath}/screenshots/hero-hq.webp`}
                alt="Vapor terminal showing split panes"
                className="w-full h-auto relative"
                style={{ maxWidth: '100%', display: 'block', zIndex: 1, filter: 'drop-shadow(0 40px 80px rgba(0, 0, 0, 0.8)) drop-shadow(0 20px 40px rgba(0, 0, 0, 0.6))' }}
              />
            </div>
          </div>
        </motion.div>

        {/* Right side - Hero content */}
        <motion.div
          className="flex-1 w-full lg:max-w-xl"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
        >
          <div className="w-full lg:max-w-xl">
            <div className="mb-6 md:mb-8">
              <div className="flex items-center gap-4 md:gap-6">
                <img src={`${basePath}/icon.png`} alt="Vapor icon" className="w-16 h-16 md:w-24 md:h-24" />
                <h1 className="text-5xl md:text-8xl font-bold tracking-tight text-white font-mono">
                  vapor
                </h1>
              </div>
            </div>

            <h2 className="text-2xl md:text-3xl font-normal mb-4 md:mb-6 tracking-tight text-white/90 font-mono">
              A terminal with an editor in it.
            </h2>

            <p className="text-base md:text-lg text-white/60 mb-8 md:mb-12 font-normal leading-relaxed font-mono">
              Panes split in any direction. There&apos;s a Monaco editor and a file tree built in, and it picks up SSH and Docker sessions on its own. macOS only.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:gap-4 max-w-sm lg:max-w-none mx-auto lg:mx-0">
            <a
              href="#download"
              className="px-6 md:px-8 py-3 md:py-4 bg-white text-black hover:bg-white/90 transition-colors rounded-lg font-semibold text-base md:text-lg text-center font-mono"
            >
              Download
            </a>
            <a
              href="https://github.com/petersauer/vapor"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 md:px-8 py-3 md:py-4 border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all rounded-lg font-semibold text-base md:text-lg text-center font-mono"
              style={{
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
              }}
            >
              View on GitHub
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
