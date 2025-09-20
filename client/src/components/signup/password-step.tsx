import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Eye, EyeOff, Check, X } from "lucide-react";
import type { SignupData } from "@/pages/signup";

interface PasswordStepProps {
  onBack: () => void;
  signupData: SignupData;
}

export default function PasswordStep({ onBack, signupData }: PasswordStepProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const createAccountMutation = useMutation({
    mutationFn: async (data: { password: string; confirm_password: string }) => {
      const response = await apiRequest("POST", "/api/signup/create-account", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Registration successful!",
        description: "Please log in to continue.",
      });
      
      // Redirect to login page
      setLocation("/signin");
    },
    onError: (error: any) => {
      toast({
        title: "Error creating account",
        description: error.message || "Failed to create account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      toast({
        title: "Missing information",
        description: "Please fill in both password fields",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    createAccountMutation.mutate({
      password,
      confirm_password: confirmPassword,
    });
  };

  const getPasswordStrength = () => {
    let score = 0;
    const checks = [
      { test: password.length >= 8, label: "At least 8 characters" },
      { test: /[A-Z]/.test(password), label: "Uppercase letter" },
      { test: /[a-z]/.test(password), label: "Lowercase letter" },
      { test: /\d/.test(password), label: "Number" },
      { test: /[!@#$%^&*(),.?":{}|<>]/.test(password), label: "Special character" },
    ];

    return checks;
  };

  const passwordChecks = getPasswordStrength();
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">Almost Done!</h3>
        <p className="text-muted-foreground">
          Create a secure password to protect your account
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Create a secure password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={createAccountMutation.isPending}
            required
            data-testid="input-password"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>

        {/* Password strength indicator */}
        {password && (
          <div className="mt-3 space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Password requirements:</div>
            <div className="grid grid-cols-1 gap-1">
              {passwordChecks.map((check, index) => (
                <div key={index} className="flex items-center text-xs">
                  {check.test ? (
                    <Check className="w-3 h-3 text-green-600 mr-2" />
                  ) : (
                    <X className="w-3 h-3 text-red-500 mr-2" />
                  )}
                  <span className={check.test ? "text-green-600" : "text-muted-foreground"}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={createAccountMutation.isPending}
            required
            data-testid="input-confirm-password"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            tabIndex={-1}
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>

        {confirmPassword && (
          <div className="flex items-center text-xs mt-2">
            {passwordsMatch ? (
              <>
                <Check className="w-3 h-3 text-green-600 mr-2" />
                <span className="text-green-600">Passwords match</span>
              </>
            ) : (
              <>
                <X className="w-3 h-3 text-red-500 mr-2" />
                <span className="text-red-500">Passwords don't match</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Account preview */}
      <div className="bg-muted/50 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">Account Summary:</h4>
        <div className="space-y-1 text-sm">
          <div><strong>Name:</strong> {signupData.first_name} {signupData.last_name}</div>
          <div><strong>Email:</strong> {signupData.email}</div>
          <div><strong>Industry:</strong> {signupData.industry}</div>
          <div><strong>Company Size:</strong> {signupData.employees_range} employees</div>
          <div><strong>Expected Contacts:</strong> {signupData.contacts_range}</div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={createAccountMutation.isPending}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Button
          type="submit"
          className="flex-1"
          disabled={
            createAccountMutation.isPending ||
            !passwordsMatch ||
            password.length < 8
          }
          data-testid="button-create-account"
        >
          {createAccountMutation.isPending ? "Creating Account..." : "Create Account & Start Trial"}
        </Button>
      </div>
    </form>
  );
}