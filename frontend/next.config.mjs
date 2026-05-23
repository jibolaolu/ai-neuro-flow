/** Proxies browser calls from same-origin `/api/v1/*` to FastAPI (avoids HTTPS→HTTP mixed content). */
const backend = process.env.BACKEND_URL || "http://127.0.0.1:8004";
const backendTrim = backend.replace(/\/$/, "");
const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendTrim}/api/v1/:path*`,
      },
      {
        source: "/health",
        destination: `${backendTrim}/health`,
      },
      {
        source: "/ready",
        destination: `${backendTrim}/ready`,
      },
    ];
  },
  async headers() {
    const securityHeaders = [
      { key: "X-DNS-Prefetch-Control", value: "on" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];
    if (isProd) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
