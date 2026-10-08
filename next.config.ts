import type { NextConfig } from "next";

/**
 * Where the API server lives. The frontend never serves `/api/*` itself — it
 * forwards every such request to the server (see /server), so the browser keeps
 * talking to one origin and the session cookie just works. Evaluated when the
 * app is built, so set API_URL in the host's build environment too.
 */
const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Next buffers request bodies it proxies (10 MB by default and truncates beyond that);
  // raise it so audio and document uploads forwarded to the API server arrive whole.
  experimental: { proxyClientMaxBodySize: "100mb" },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
