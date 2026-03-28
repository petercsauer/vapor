"use client";

import { motion } from "framer-motion";

const technologies = [
  {
    name: "Electron",
    icon: (
      <svg viewBox="0 0 256 256" className="w-8 h-8">
        <circle cx="128" cy="128" r="128" fill="currentColor" opacity="0.1"/>
        <path d="M175.216 171.272c-5.992 3.38-16.88 4.776-27.92 4.776-11.04 0-21.928-1.396-27.92-4.776-5.992-3.38-5.992-8.852 0-12.232 5.992-3.38 16.88-4.776 27.92-4.776 11.04 0 21.928 1.396 27.92 4.776 5.992 3.38 5.992 8.852 0 12.232z" fill="currentColor"/>
      </svg>
    )
  },
  {
    name: "TypeScript",
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M8 8h8M12 8v8"/>
      </svg>
    )
  },
  {
    name: "xterm.js",
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="16" rx="2"/>
        <path d="M7 8l3 3-3 3M12 14h4"/>
      </svg>
    )
  },
  {
    name: "Monaco",
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="16" y2="17"/>
      </svg>
    )
  },
  {
    name: "Zustand",
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="5"/>
        <path d="M12 14v8M8 18h8"/>
      </svg>
    )
  },
];

export function TechStack() {
  return (
    <section className="py-24 px-6 relative border-t border-white/10">
      <div className="max-w-6xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            Built with
          </h2>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-6">
          {technologies.map((tech, index) => (
            <motion.div
              key={tech.name}
              className="border border-white/10 px-6 py-4 rounded-lg hover:border-white/30 hover:bg-white/5 transition-all flex items-center gap-3"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              whileHover={{ scale: 1.05 }}
            >
              <div className="text-white">
                {tech.icon}
              </div>
              <span className="font-semibold text-white">{tech.name}</span>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-16 border border-white/10 rounded-2xl p-8 inline-block"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="flex flex-col md:flex-row gap-8 text-left">
            <div>
              <div className="text-3xl font-bold text-white mb-2">
                MIT License
              </div>
              <div className="text-white/60 font-light">Do whatever you want with it</div>
            </div>
            <div className="border-l border-white/20 pl-8">
              <div className="text-3xl font-bold text-white mb-2">
                macOS
              </div>
              <div className="text-white/60 font-light">ARM and Intel</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
