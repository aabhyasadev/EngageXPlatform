import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface EmailStepProps {
  email: string;
  onNext: () => void;
  onDataUpdate: (data: { email: string }) => void;
}

export default function EmailStep({ email, onNext, onDataUpdate }: EmailStepProps) {
  const [inputEmail, setInputEmail] = useState(email);
  const { toast } = useToast();

  const checkEmailMutation = useMutation({
    mutationFn: async (emailToCheck: string) => {
      const response = await apiRequest("POST", "/api/signup/check-email", {
        email: emailToCheck,
      });
      return response.json();
    },
    onSuccess: () => {
      onDataUpdate({ email: inputEmail.toLowerCase().trim() });
      toast({
        title: "Email available",
        description: "Great! This email is available for registration.",
      });
      onNext();
    },
    onError: (error: any) => {
      if (error.message.includes('409')) {
        toast({
          title: "Email already registered",
          description: "This email is already registered. Please use a different email or try logging in.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to check email availability",
          variant: "destructive",
        });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailToCheck = inputEmail.toLowerCase().trim();
    
    if (!emailToCheck) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToCheck)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    checkEmailMutation.mutate(emailToCheck);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email address"
          value={inputEmail}
          onChange={(e) => setInputEmail(e.target.value)}
          disabled={checkEmailMutation.isPending}
          required
          data-testid="input-email"
        />
        <p className="text-sm text-muted-foreground">
          We'll use this email for account verification and important updates.
        </p>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={checkEmailMutation.isPending}
        data-testid="button-check-email"
      >
        {checkEmailMutation.isPending ? "Checking..." : "Continue"}
      </Button>
    </form>
  );
}