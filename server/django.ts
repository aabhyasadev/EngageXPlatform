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

    // Robust health polling - poll /health endpoint every 500ms for up to 60s
    const pollHealth = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8001/health");
        if (response.ok && !resolved) {
          log("Django health check passed - server ready");
          resolved = true;
          if (startupTimeout) clearTimeout(startupTimeout);
          resolve();
        }
      } catch (error) {
        // Health check failed - continue polling
      }
    };

    // Start polling immediately and every 500ms
    const pollInterval = setInterval(pollHealth, 500);
    pollHealth(); // Initial poll

    // Timeout after 60 seconds
    startupTimeout = setTimeout(() => {
      clearInterval(pollInterval);
      if (!resolved) {
        resolved = true;
        log("Django startup timeout - health check never succeeded");
        djangoProcess?.kill();
        reject(new Error("Django startup timeout"));
      }
    }, 60000);
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