# Deployment Guide

## Marketing Website Deployment

### Option 1: Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git add marketing/
   git commit -m "Add marketing website"
   git push
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your repository
   - Configure:
     - Framework Preset: `Next.js`
     - Root Directory: `marketing/website`
     - Build Command: `npm run build`
     - Output Directory: `out`

3. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy automatically
   - Get your URL: `https://vapor-terminal.vercel.app`

4. **Custom Domain** (Optional)
   - In Vercel project settings
   - Add custom domain
   - Update DNS records as instructed

### Option 2: Netlify

1. **Push to GitHub** (same as above)

2. **Import to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site"
   - Import from Git
   - Configure:
     - Base directory: `marketing/website`
     - Build command: `npm run build`
     - Publish directory: `out`

3. **Deploy**
   - Netlify builds and deploys
   - Get your URL: `https://vapor-terminal.netlify.app`

### Option 3: GitHub Pages

1. **Build locally**
   ```bash
   cd marketing/website
   npm run build
   ```

2. **Update next.config.mjs**
   ```javascript
   const nextConfig = {
     output: 'export',
     basePath: '/vapor', // Your repo name
     images: {
       unoptimized: true,
     },
   };
   ```

3. **Deploy to gh-pages branch**
   ```bash
   npm install --save-dev gh-pages
   npx gh-pages -d out
   ```

4. **Enable GitHub Pages**
   - Repository Settings → Pages
   - Source: Deploy from branch
   - Branch: `gh-pages` / `root`
   - Save

5. **Access**: `https://yourusername.github.io/vapor/`

### Option 4: Self-Hosted

1. **Build**
   ```bash
   cd marketing/website
   npm run build
   ```

2. **Serve static files**
   ```bash
   # Using any static server
   npx serve out

   # Or copy to web server
   scp -r out/* user@server:/var/www/vapor/
   ```

## Screenshot Automation Deployment

### GitHub Actions

Screenshot automation can be configured as a GitHub Actions workflow.

**Triggers:**
- Weekly: Every Monday at midnight
- On release: When you publish a new release
- Manual: Can trigger from Actions tab

**What it does:**
1. Builds Vapor
2. Generates screenshots
3. Processes images
4. Commits to repository
5. Triggers Vercel rebuild (if configured)

### Manual Local Generation

```bash
# Build Vapor first
npm run package

# Generate screenshots
cd marketing/screenshots
npm install
npm run generate
```

Screenshots saved to `marketing/website/public/screenshots/`

## Environment Variables

### For Vercel

No environment variables needed for the basic setup.

If you want analytics:

```bash
vercel env add NEXT_PUBLIC_GA_ID
# Enter your Google Analytics ID
```

### For Screenshot Generation

Set in GitHub Actions secrets (if needed):
- `VERCEL_DEPLOY_HOOK` - Webhook URL to trigger Vercel rebuild

## Post-Deployment

### 1. Test the site

Visit your deployment URL and check:
- [ ] All sections load correctly
- [ ] Animations work smoothly
- [ ] Links are functional
- [ ] Responsive on mobile/tablet
- [ ] Download buttons point to correct locations

### 2. Update download links

Edit `marketing/website/components/Download.tsx`:

```typescript
<a href="https://github.com/vapor/vapor/releases/latest/download/Vapor.dmg">
  Download for macOS
</a>
```

### 3. Configure custom domain

If using a custom domain (e.g., `vapor.dev`):

**Vercel:**
1. Project Settings → Domains
2. Add domain
3. Update DNS:
   - A record: `76.76.21.21`
   - CNAME: `cname.vercel-dns.com`

**Netlify:**
1. Domain Settings → Add custom domain
2. Update DNS:
   - CNAME: `yoursite.netlify.app`

### 4. Setup analytics (optional)

**Google Analytics:**

```typescript
// marketing/website/app/layout.tsx
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**Plausible Analytics:**

```typescript
// Simpler, privacy-focused alternative
<Script
  defer
  data-domain="yourdomain.com"
  src="https://plausible.io/js/script.js"
/>
```

### 5. Enable automatic deployments

**For Vercel/Netlify:**
- Automatic on every push to `main`
- Configure in deployment settings

**For screenshot updates:**
- Already configured via GitHub Actions
- Runs weekly and on releases

## Troubleshooting

### Build fails on Vercel

**Issue:** `npm ERR! code ENOENT`

**Solution:** Check `Root Directory` is set to `marketing/website`

### Screenshots not generating

**Issue:** Vapor.app not found

**Solution:** Ensure `npm run package` was run and output exists at:
```
out/Vapor-darwin-arm64/Vapor.app
```

### Images not loading

**Issue:** 404 on screenshot images

**Solution:**
1. Check screenshots exist in `public/screenshots/`
2. Rebuild and redeploy
3. Clear cache

### Custom domain not working

**Issue:** DNS not resolving

**Solution:**
1. Wait 24-48 hours for DNS propagation
2. Check DNS records with `dig yourdomain.com`
3. Verify SSL certificate is provisioned

## Maintenance

### Update screenshots

**Weekly automated** via GitHub Actions

**Manual update:**
```bash
cd marketing/screenshots
npm run generate
git add ../website/public/screenshots/
git commit -m "chore: update screenshots"
git push
```

### Update content

Edit component files in `marketing/website/components/`

```bash
cd marketing/website
# Make changes
git commit -am "Update content"
git push
```

Vercel/Netlify will automatically rebuild.

### Monitor performance

**Lighthouse:**
```bash
cd marketing/website
npm run build
npx serve out
# In browser: DevTools → Lighthouse → Run
```

**Target scores:**
- Performance: 95+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 100

## Support

For issues:
1. Check [Marketing README](README.md)
2. Check [Screenshot README](screenshots/README.md)
3. Open issue on GitHub
