import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Mail, Clock, RefreshCw } from "lucide-react";

interface OTPStepProps {
  email: string;
  onNext: () => void;
  onBack: () => void;
}

export default function OTPStep({ email, onNext, onBack }: OTPStepProps) {
  const [otpCode, setOtpCode] = useState("");
  const [timeLeft, setTimeLeft] = useState(1200); // 20 minutes in seconds
  const [otpSent, setOtpSent] = useState(false);
  const [autoSendComplete, setAutoSendComplete] = useState(false);
  const { toast } = useToast();

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/signup/send-otp", {});
      return response.json();
    },
    onSuccess: () => {
      setOtpSent(true);
      setTimeLeft(1200); // Reset timer
      toast({
        title: "Verification code sent",
        description: "Check your email for the 6-digit verification code.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send verification code",
        variant: "destructive",
      });
    },
  });

  const resendOtpMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/signup/resend-otp", {});
      return response.json();
    },
    onSuccess: () => {
      setTimeLeft(1200); // Reset timer for new code
      setOtpCode(""); // Clear any previously entered code
      toast({
        title: "Verification code resent",
        description: "A new verification code has been sent to your email.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resend verification code",
        variant: "destructive",
      });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/signup/verify-otp", {
        otp_code: code,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email verified",
        description: "Your email has been successfully verified!",
      });
      onNext();
    },
    onError: (error: any) => {
      if (error.message.includes('expired')) {
        toast({
          title: "Code expired",
          description: "Your verification code has expired. Please request a new one.",
          variant: "destructive",
        });
      } else if (error.message.includes('Invalid')) {
        toast({
          title: "Invalid code",
          description: "Please check your code and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to verify code",
          variant: "destructive",
        });
      }
    },
  });

  // Automatically send OTP when component mounts
  useEffect(() => {
    if (!autoSendComplete && !otpSent) {
      sendOtpMutation.mutate();
      setAutoSendComplete(true);
    }
  }, []);

  useEffect(() => {
    if (timeLeft > 0 && otpSent) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, otpSent]);

  const handleResendOtp = () => {
    resendOtpMutation.mutate();
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otpCode || otpCode.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the 6-digit verification code",
        variant: "destructive",
      });
      return;
    }

    verifyOtpMutation.mutate(otpCode);
  };

  const isExpired = timeLeft <= 0;
  const isPending = sendOtpMutation.isPending || resendOtpMutation.isPending || verifyOtpMutation.isPending;

  if (!otpSent) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Sending Verification Code</h3>
          <p className="text-muted-foreground mb-4">
            We're sending a verification code to:
          </p>
          <p className="font-medium text-foreground mb-6">{email}</p>
          
          {sendOtpMutation.isPending && (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span className="text-sm text-muted-foreground">Sending...</span>
            </div>
          )}
          
          {sendOtpMutation.isError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm mb-3">
                Failed to send verification code. Please try again.
              </p>
              <Button
                onClick={() => sendOtpMutation.mutate()}
                variant="outline"
                size="sm"
                data-testid="button-retry-send"
              >
                Retry Sending
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isPending}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleVerifyOtp} className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Check Your Email</h3>
        <p className="text-muted-foreground mb-4">
          We've sent a 6-digit verification code to:
        </p>
        <p className="font-medium text-foreground mb-6">{email}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="otpCode">Verification Code</Label>
        <Input
          id="otpCode"
          type="text"
          placeholder="Enter 6-digit code"
          value={otpCode}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '').slice(0, 6);
            setOtpCode(value);
          }}
          disabled={isPending}
          maxLength={6}
          className="text-center text-2xl font-mono tracking-widest"
          data-testid="input-otp-code"
        />
        
        <div className="flex items-center justify-between text-sm">
          {!isExpired ? (
            <div className="flex items-center text-muted-foreground">
              <Clock className="w-4 h-4 mr-1" />
              Expires in {formatTime(timeLeft)}
            </div>
          ) : (
            <div className="text-red-600">Code expired</div>
          )}
          
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResendOtp}
            disabled={isPending}
            className="text-primary hover:text-primary"
            data-testid="button-resend-otp"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Resend Code
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isPending}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Button
          type="submit"
          className="flex-1"
          disabled={isPending || otpCode.length !== 6 || isExpired}
          data-testid="button-verify-otp"
        >
          {verifyOtpMutation.isPending ? "Verifying..." : "Verify & Continue"}
        </Button>
      </div>
    </form>
  );
}