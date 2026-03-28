export function Footer() {
  return (
    <footer className="border-t border-white/10 py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-white/40 font-light text-sm">
            <p>© 2026 Vapor. Open source under MIT License.</p>
          </div>

          <div className="flex gap-6">
            <a
              href="https://github.com/petersauer/vapor"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white transition-colors text-sm font-light"
            >
              GitHub
            </a>
            <a
              href="https://github.com/petersauer/vapor/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white transition-colors text-sm font-light"
            >
              Issues
            </a>
            <a
              href="https://github.com/petersauer/vapor/blob/main/README.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white transition-colors text-sm font-light"
            >
              Docs
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
