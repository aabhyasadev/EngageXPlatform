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

  // Add body parsing BEFORE proxy for POST requests
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Setup Django proxy with authentication bridge
  setupDjangoProxy(app);
  
  const httpServer = createServer(app);
  return httpServer;
}