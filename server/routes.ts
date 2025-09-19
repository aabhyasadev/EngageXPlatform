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

  // Temporary logger to verify any browser request touches Express
  app.all('/api/*', (req, res, next) => {
    console.log(`[express] inbound ${req.method} ${req.url}`);
    next();
  });

  // Temporary stub for signup email check to test POST pathway
  app.post('/api/signup/check-email', (req, res) => {
    console.log(`[express] Stub handling POST /api/signup/check-email`);
    console.log(`[express] Request body:`, req.body);
    res.json({ exists: false, message: "Test stub response" });
  });

  // Proxy all API requests to Django backend - strip /api prefix for Django
  app.use('/api', createProxyMiddleware({
    target: 'http://localhost:8001',
    changeOrigin: true,
    pathRewrite: {
      '^/api': '', // Strip /api prefix before forwarding to Django
    },
    logLevel: 'debug',
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[express] Proxying ${req.method} ${req.url} to Django at localhost:8001`);
      
      // For JSON POST/PUT/PATCH requests, manually write body and end the request
      if (['POST', 'PUT', 'PATCH'].includes(req.method!) && 
          req.headers['content-type']?.includes('application/json') && 
          req.body) {
        const body = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(body));
        proxyReq.write(body);
        proxyReq.end(); // Critical: end the request stream
      }
      
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
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`[express] Response ${proxyRes.statusCode} from Django for ${req.method} ${req.url}`);
    },
    onError: (err, req, res) => {
      console.error(`[express] Proxy Error for ${req.method} ${req.url}:`, err.message);
      console.error('[express] Error stack:', err.stack);
      if (!res.headersSent) {
        res.status(502).json({ 
          error: 'Bad Gateway - Proxy Error', 
          details: err.message,
          target: 'Django backend at localhost:8001'
        });
      }
    }
  }));
  
  const httpServer = createServer(app);
  return httpServer;
}