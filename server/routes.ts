import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { createProxyMiddleware } from 'http-proxy-middleware';
import crypto from 'crypto';

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware removed - Django handles all authentication

  // Health check endpoint for Express (for monitoring)
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'express-frontend' });
  });

  // Mount proxy BEFORE body parsing to avoid stream interference

  app.use('/api', createProxyMiddleware({
    target: 'http://localhost:8001',
    changeOrigin: true,
    pathRewrite: {
      '^/api': '', // Strip /api prefix before forwarding to Django
    },
    logLevel: 'debug',
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[express] Proxying ${req.method} ${req.url} to Django`);
      
      // No authentication headers needed - Django handles OIDC directly
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`[express] Response ${proxyRes.statusCode} from Django`);
    },
    onError: (err, req, res) => {
      console.error(`[express] Proxy Error:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({ 
          error: 'Bad Gateway - Proxy Error', 
          details: err.message,
          target: 'Django backend'
        });
      }
    }
  }));

  // Add body parsing AFTER proxy to avoid interference
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  
  const httpServer = createServer(app);
  return httpServer;
}