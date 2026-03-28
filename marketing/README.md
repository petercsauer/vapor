# Vapor Marketing

Marketing website and automated screenshot generation for Vapor terminal.

## Structure

```
marketing/
├── website/          # Next.js marketing site
└── screenshots/      # Playwright screenshot automation
```

## Quick Start

### Marketing Website

```bash
cd website
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Screenshot Generation

```bash
# First, build Vapor
npm run package

# Then generate screenshots
cd marketing/screenshots
npm install
npm run generate
```

Screenshots are automatically processed and saved to `website/public/screenshots/`.

## Deployment

### Website

The marketing site is configured for static export and can be deployed to:
- Vercel (recommended)
- Netlify
- GitHub Pages
- Any static host

```bash
cd website
npm run build
# Output in website/out/
```

### Automated Screenshots

Screenshots can be generated locally or integrated into CI:

## Features

### Marketing Website
- Modern single-page design
- Glass morphism aesthetic
- Fully responsive
- Framer Motion animations
- Automated screenshot integration

### Screenshot Automation
- Fully automated with Playwright
- Multiple scenarios (hero, split-panes, etc.)
- Consistent configuration
- Multi-format output (@2x, webp, thumbnails)
- CI/CD integration

## Documentation

- [Website README](website/README.md) - Website setup and customization
- [Screenshots README](screenshots/README.md) - Screenshot system documentation

## Adding New Screenshots

1. Create scenario in `screenshots/scenarios/`
2. Add to `screenshots/generate.ts`
3. Run `npm run generate`
4. Commit processed screenshots

## License

MIT
