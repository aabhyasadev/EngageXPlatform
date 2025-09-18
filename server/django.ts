import { spawn, type ChildProcess } from "child_process";
import { log } from "./vite";

let djangoProcess: ChildProcess | null = null;

/**
 * Start Django server as a child process
 */
export async function startDjangoServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    log("Starting Django backend server...");
    
    djangoProcess = spawn("python", ["manage.py", "runserver", "127.0.0.1:8001", "--noreload"], {
      cwd: "backend",
      stdio: ["ignore", "pipe", "pipe"],
    });

    let startupTimeout: NodeJS.Timeout | null = null;
    let resolved = false;

    djangoProcess.stdout?.on("data", (data) => {
      const output = data.toString();
      log("Django stdout:", output.trim());
      // More flexible startup detection
      if (output.includes("Starting development server") || 
          output.includes("Django version") || 
          output.includes("development server at http://")) {
        log("Django server started on port 8001");
        if (!resolved) {
          resolved = true;
          if (startupTimeout) clearTimeout(startupTimeout);
          resolve();
        }
      }
    });

    djangoProcess.stderr?.on("data", (data) => {
      const error = data.toString();
      log("Django stderr:", error.trim());
      if (error.includes("Error") || error.includes("Exception")) {
        console.error("Django startup error:", error);
        if (!resolved) {
          resolved = true;
          if (startupTimeout) clearTimeout(startupTimeout);
          reject(new Error(`Django startup failed: ${error}`));
        }
      }
    });

    djangoProcess.on("error", (error) => {
      console.error("Failed to start Django process:", error);
      if (!resolved) {
        resolved = true;
        if (startupTimeout) clearTimeout(startupTimeout);
        reject(error);
      }
    });

    djangoProcess.on("exit", (code, signal) => {
      log(`Django process exited with code ${code}, signal ${signal}`);
      djangoProcess = null;
    });

    // Timeout after 30 seconds for debugging
    startupTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        log("Django startup timeout - process may have failed to start");
        djangoProcess?.kill();
        reject(new Error("Django startup timeout"));
      }
    }, 30000);
  });
}

/**
 * Stop Django server
 */
export function stopDjangoServer(): void {
  if (djangoProcess) {
    log("Stopping Django server...");
    djangoProcess.kill();
    djangoProcess = null;
  }
}

/**
 * Graceful shutdown handler
 */
process.on("SIGINT", () => {
  stopDjangoServer();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopDjangoServer();
  process.exit(0);
});