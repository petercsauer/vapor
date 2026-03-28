"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Download as DownloadIcon, Monitor } from "lucide-react";

const DOWNLOAD_BASE = "https://github.com/petercsauer/vapor/releases/latest/download";

type Arch = "arm64" | "x64";

function detectArch(): Arch {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (!gl) return "arm64";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return "arm64";
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
    if (/Intel/i.test(renderer)) return "x64";
  } catch {
    // detection failed
  }
  return "arm64";
}

const archLabel: Record<Arch, string> = {
  arm64: "Apple Silicon",
  x64: "Intel",
};

const archHint: Record<Arch, string> = {
  arm64: "M1 / M2 / M3 / M4 / M5",
  x64: "Core i5 / i7 / i9",
};

export function Download() {
  const [arch, setArch] = useState<Arch>("arm64");

  useEffect(() => {
    setArch(detectArch());
  }, []);

  const other: Arch = arch === "arm64" ? "x64" : "arm64";

  return (
    <section className="py-32 px-6 relative border-t border-white/10" id="download">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-white/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-5xl md:text-6xl font-bold mb-6 text-white">
            Download Vapor
          </h2>
          <p className="text-xl text-white/60 mb-12 font-light">
            macOS only. Free and open source.
          </p>

          <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
            <a
              href={`${DOWNLOAD_BASE}/Vapor-${arch}.dmg`}
              className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-white text-black hover:bg-white/90 transition-colors rounded-xl font-semibold text-lg font-mono"
            >
              <DownloadIcon className="w-5 h-5" />
              Download for {archLabel[arch]}
            </a>
            <p className="text-white/30 text-sm font-light">
              {archHint[arch]}
            </p>

            <div className="flex items-center gap-2 mt-4 text-white/40 text-sm">
              <Monitor className="w-4 h-4" />
              <span>Not your chip?</span>
              <a
                href={`${DOWNLOAD_BASE}/Vapor-${other}.dmg`}
                className="text-white/60 hover:text-white underline underline-offset-2 transition-colors"
              >
                Download for {archLabel[other]}
              </a>
            </div>
          </div>

          <p className="text-white/20 text-xs mt-8 font-light">
            Not sure which Mac you have? Apple menu → About This Mac.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
