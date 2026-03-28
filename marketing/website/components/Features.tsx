"use client";

import { motion } from "framer-motion";
import { Sparkles, Columns, Brain, FileCode, Save, Zap } from "lucide-react";

const features = [
  {
    icon: Columns,
    title: "Pane rearranging",
    description:
      "Toggle move mode and drag panes wherever you want. Alt+Shift+arrows moves focus between them. Each tab has a minimap that updates as you rearrange things.",
  },
  {
    icon: Brain,
    title: "Tabs name themselves",
    description:
      "Open a terminal in a git repo and the tab says the repo name. SSH somewhere, it shows the remote directory with the hostname as a badge. Double-click to override.",
  },
  {
    icon: Sparkles,
    title: "One config file",
    description:
      "Font family, size, ligatures, shell path, background opacity, theme. All in config.json. Cmd+comma opens it.",
  },
  {
    icon: Save,
    title: "Workspace save and restore",
    description:
      "Saves every tab and split and pane position to disk under a name you pick. Reopen it later or delete it.",
  },
  {
    icon: FileCode,
    title: "Tab reordering",
    description:
      "Drag to reorder. Swipe the trackpad to flip between them. When you've got multiple panes in a tab, a minimap shows up so you can see the layout at a glance.",
  },
  {
    icon: Zap,
    title: "Exit code on the tab",
    description:
      "Green dot if the last command worked, red if it didn't. Directory tracking via OSC 7. Works with zsh and bash.",
  },
];

export function Features() {
  return (
    <section className="py-32 px-6 relative" id="features">
      <div className="max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-5xl md:text-6xl font-bold mb-6 text-white">
            Features
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                className="rounded-2xl p-8 transition-all duration-300 group overflow-hidden relative"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.45)',
                  backdropFilter: 'blur(40px)',
                  WebkitBackdropFilter: 'blur(40px)',
                  border: '1px solid rgba(128, 128, 128, 0.3)',
                  boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.1), 0 20px 40px rgba(0, 0, 0, 0.5)',
                }}
              >
                <div className="mb-4 group-hover:scale-110 transition-transform">
                  <Icon className="w-12 h-12 text-white" strokeWidth={1.5} />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-white">{feature.title}</h3>
                <p className="text-white/60 leading-relaxed font-light">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
