/** @type {import('next').NextConfig} */
module.exports = {
  output: 'export',          // writes static site to app/out
  images: { unoptimized: true },
  trailingSlash: true,       // adds trailing slash for static hosting
  distDir: 'out',            // output directory
  skipTrailingSlashRedirect: true,
  // Disable API routes for static export
  experimental: {
    appDir: true,
  }
};
