// Marketing landing page. The page itself lives as a self-contained static file
// (public/landing.html) and is embedded full-screen via an iframe so its custom
// fonts, CSS, and three.js animation are fully isolated from the app's styles.
// Its CTA links use target="_top" so they navigate the SPA (e.g. /#/marketplace).
export default function Landing() {
  return (
    <iframe
      src="/landing.html"
      title="HyperShopIndia"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 0 }}
    />
  );
}
