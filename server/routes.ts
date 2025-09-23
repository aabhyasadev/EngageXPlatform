import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./replitAuth";
import { setupDjangoProxy } from "./proxy";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication with Replit OIDC
  await setupAuth(app);

  // Health check endpoint for Express (for monitoring)
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'express-frontend' });
  });

  // Setup Django proxy with authentication bridge
  setupDjangoProxy(app);

  // Add body parsing AFTER proxy to avoid interference
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  
  const httpServer = createServer(app);
  return httpServer;
}