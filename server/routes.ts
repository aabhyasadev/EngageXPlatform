import type { Express } from "express";
import { createServer, type Server } from "http";
import { createProxyMiddleware } from 'http-proxy-middleware';
import { setupAuth } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware for potential future use
  await setupAuth(app);

  // Health check endpoint for Express (for monitoring)
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'express-frontend' });
  });

  // Proxy all API requests to Django backend
  app.use('/api', createProxyMiddleware({
    target: 'http://127.0.0.1:8001',
    changeOrigin: true,
    // Don't rewrite the path - keep /api prefix as Django expects it
    logLevel: 'debug'
  }));
  
  const httpServer = createServer(app);
  return httpServer;
}