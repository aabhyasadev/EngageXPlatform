import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware for potential future use
  await setupAuth(app);

  // Health check endpoint for Express (for monitoring)
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'express-frontend' });
  });

  // All API routes are now handled by Django directly
  // Frontend calls Django at http://127.0.0.1:8001/api/*
  // Express now only serves static files and the React frontend
  
  const httpServer = createServer(app);
  return httpServer;
}