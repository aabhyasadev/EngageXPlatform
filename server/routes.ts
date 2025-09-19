import type { Express } from "express";
import { createServer, type Server } from "http";
import { createProxyMiddleware } from 'http-proxy-middleware';
import { setupAuth } from "./replitAuth";
import crypto from 'crypto';

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware for potential future use
  await setupAuth(app);

  // Health check endpoint for Express (for monitoring)
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'express-frontend' });
  });

  // Proxy all API requests to Django backend - keep full path including /api
  app.use('/api', createProxyMiddleware({
    target: 'http://127.0.0.1:8001',
    changeOrigin: true,
    // Remove pathRewrite - let Django receive full path including /api prefix
    logLevel: 'debug',
    onProxyReq: (proxyReq, req, res) => {
      // Inject signed user headers for Django authentication bridge
      if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        const user = req.user as any;
        
        // Create user data payload for Django
        const userData = JSON.stringify({
          sub: user.claims?.sub,
          email: user.claims?.email,
          first_name: user.claims?.first_name,
          last_name: user.claims?.last_name,
          profile_image_url: user.claims?.profile_image_url
        });
        
        // Sign the user data with HMAC
        const signature = crypto
          .createHmac('sha256', process.env.SESSION_SECRET!)
          .update(userData)
          .digest('hex');
        
        // Add headers for Django middleware
        proxyReq.setHeader('X-Replit-User', userData);
        proxyReq.setHeader('X-Replit-User-Signature', signature);
      }
    }
  }));
  
  const httpServer = createServer(app);
  return httpServer;
}