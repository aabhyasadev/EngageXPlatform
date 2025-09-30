import { useEffect } from "react";
import { useLocation } from "wouter";

export default function RedirectToSignIn() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/signin");
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting to sign in...</p>
      </div>
    </div>
  );
}