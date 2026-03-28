# Vapor Marketing Website

Modern, single-page marketing site for Vapor terminal built with Next.js 14, TypeScript, Tailwind CSS, and Framer Motion.

## Features

- Glass morphism design matching Vapor's aesthetic
- Smooth scroll animations with Framer Motion
- Fully responsive (mobile, tablet, desktop)
- Optimized for performance
- Automated screenshot integration

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Export static site
npm run build
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

## Structure

```
marketing/website/
├── app/
│   ├── layout.tsx       # Root layout with metadata
│   ├── page.tsx         # Main landing page
│   └── globals.css      # Global styles
├── components/
│   ├── Hero.tsx         # Hero section with CTA
│   ├── Features.tsx     # Features grid
│   ├── FeatureDetail.tsx # Detailed feature sections
│   ├── TechStack.tsx    # Technology showcase
│   ├── Download.tsx     # Download CTA section
│   └── Footer.tsx       # Footer
├── public/
│   └── screenshots/     # Generated screenshots
└── tailwind.config.ts   # Tailwind configuration
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project to Vercel
3. Deploy automatically

### Manual Build

```bash
npm run build
# Output in /out directory
```

## Screenshots

Screenshots are automatically generated and placed in `public/screenshots/` by the screenshot automation system.

## Customization

### Colors

Edit `tailwind.config.ts`:

```typescript
colors: {
  vapor: {
    accent: "#0095FF",
    green: "#4CD964",
    // ...
  },
}
```

### Content

Edit component files in `components/` to update copy and descriptions.

## License

MIT
