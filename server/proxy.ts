import { createProxyMiddleware } from "http-proxy-middleware";
import type { Express } from "express";
import crypto from "crypto";

const DJANGO_URL = "http://127.0.0.1:8001";
// Require AUTH_SECRET for security
const AUTH_SECRET = process.env.SESSION_SECRET;
if (!AUTH_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required for auth bridge");
}

/**
 * Create signed header for Django authentication with timestamp
 */
function createAuthHeaders(userId: string, userEmail: string, organizationId?: string) {
  const timestamp = Date.now().toString();
  const userData = JSON.stringify({ userId, userEmail, organizationId, timestamp });
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(userData)
    .digest("hex");

  return {
    "X-User-Data": userData,
    "X-User-Signature": signature,
    "X-User-Timestamp": timestamp,
  };
}

/**
 * Setup Django proxy middleware
 */
export function setupDjangoProxy(app: Express) {
  // Proxy /api/* requests to Django with authentication bridge
  const djangoProxy = createProxyMiddleware({
    target: DJANGO_URL,
    changeOrigin: true,
    // pathRewrite not needed - Django expects /api/* routes
    onProxyReq: (proxyReq: any, req: any) => {
      // Forward authentication from Express session to Django
      if (req.user && req.user.claims) {
        const authHeaders = createAuthHeaders(
          req.user.claims.sub,
          req.user.claims.email,
          req.user.organization?.id
        );

        proxyReq.setHeader("X-User-Data", authHeaders["X-User-Data"]);
        proxyReq.setHeader("X-User-Signature", authHeaders["X-User-Signature"]);
        proxyReq.setHeader("X-User-Timestamp", authHeaders["X-User-Timestamp"]);
      }

      // Forward original headers
      proxyReq.setHeader("X-Forwarded-For", req.ip);
      proxyReq.setHeader("X-Real-IP", req.ip);
    },
    onError: (err: any, req: any, res: any) => {
      console.error("Django proxy error:", err);
      // Fallback to Express if Django is unavailable
      res.status(503).json({ 
        error: "Backend temporarily unavailable",
        fallback: true 
      });
    },
  } as any);

  // Apply proxy to /api/* routes that don't match existing Express routes
  // This will only catch unmatched routes since Django proxy is registered AFTER Express routes
  app.use("/api", djangoProxy);
}