import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Eye, EyeOff, ArrowLeft, Building2, Mail, User, Shield, MessageSquare } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Step 1: Organization ID & Email validation
const step1Schema = z.object({
  organization_id: z.string().min(1, "Organization ID is required"),
  email: z.string().email("Please enter a valid email address")
});

// Step 2: Username & Password authentication  
const step2Schema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});

// Step 3: MFA/OTP/SSO verification
const step3Schema = z.object({
  verification_code: z.string()
    .min(6, "Verification code must be 6 digits")
    .max(6, "Verification code must be 6 digits")
    .regex(/^\d{6}$/, "Verification code must contain only digits")
});

// Forgot account form with proper email validation
const forgotAccountSchema = z.object({
  email: z.string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
});

export default function SignInPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [showForgotAccount, setShowForgotAccount] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Form data for multi-step process
  const [step1Data, setStep1Data] = useState({ organization_id: "", email: "" });
  const [organizationName, setOrganizationName] = useState("");
  const [verificationInfo, setVerificationInfo] = useState({ mfa_enabled: false, sso_enabled: false });

  // Form instances
  const step1Form = useForm({
    resolver: zodResolver(step1Schema),
    defaultValues: { organization_id: "", email: "" }
  });

  const step2Form = useForm({
    resolver: zodResolver(step2Schema),
    defaultValues: { username: "", password: "" }
  });

  const step3Form = useForm({
    resolver: zodResolver(step3Schema),
    defaultValues: { verification_code: "" }
  });

  const forgotAccountForm = useForm({
    resolver: zodResolver(forgotAccountSchema),
    defaultValues: { email: "" }
  });

  // Ref for direct DOM access to email input (for test compatibility)
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Reset error when changing steps
  useEffect(() => {
    setError("");
  }, [currentStep, showForgotAccount]);

  // Pre-fill username if available from recent signup
  useEffect(() => {
    const signupUsername = localStorage.getItem('signup_username');
    if (signupUsername && currentStep === 2) {
      step2Form.setValue('username', signupUsername);
      // Clear the stored username after using it
      localStorage.removeItem('signup_username');
    }
  }, [currentStep, step2Form]);

  // Step 1: Validate Organization ID & Email
  const onStep1Submit = async (values: z.infer<typeof step1Schema>) => {
    setIsLoading(true);
    setError("");
    
    try {
      const response = await apiRequest("POST", "/api/signin/validate-org-email", values);
      
      if (response.ok) {
        const data = await response.json();
        setStep1Data(values);
        setOrganizationName("your organization"); // Generic name for security
        setCurrentStep(2);
      } else {
        const error = await response.json();
        setError(error.error || "Validation failed");
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Authenticate with Username & Password
  const onStep2Submit = async (values: z.infer<typeof step2Schema>) => {
    setIsLoading(true);
    setError("");
    
    try {
      const response = await apiRequest("POST", "/api/signin/authenticate", values);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.requires_verification) {
          // MFA/OTP/SSO required
          setVerificationInfo({
            mfa_enabled: data.mfa_enabled,
            sso_enabled: data.sso_enabled
          });
          setCurrentStep(3);
        } else {
          // Login successful - redirect to dashboard
          toast({ title: "Login successful", description: "Welcome back!" });
          navigate("/dashboard");
        }
      } else {
        const error = await response.json();
        setError(error.error || "Authentication failed");
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Verify MFA/OTP/SSO
  const onStep3Submit = async (values: z.infer<typeof step3Schema>) => {
    setIsLoading(true);
    setError("");
    
    try {
      const response = await apiRequest("POST", "/api/signin/verify", values);
      
      if (response.ok) {
        const data = await response.json();
        toast({ title: "Login successful", description: "Welcome back!" });
        navigate("/dashboard");
      } else {
        const error = await response.json();
        setError(error.error || "Verification failed");
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission with robust email detection
  const handleForgotAccountSubmit = async () => {
    setIsLoading(true);
    setError("");
    
    // Get email value from multiple sources for maximum compatibility
    let emailValue = forgotAccountForm.getValues("email");
    
    // Fallback to direct DOM access if React state is empty (for automated tests)
    if ((!emailValue || emailValue.trim() === "") && emailInputRef.current) {
      emailValue = emailInputRef.current.value;
      console.log("Debug: Using DOM value fallback:", emailValue);
      
      // Update React Hook Form state with DOM value
      forgotAccountForm.setValue("email", emailValue);
    }
    
    console.log("Debug: Form submission with email:", emailValue);
    console.log("Debug: Form getValues:", forgotAccountForm.getValues());
    
    if (!emailValue || emailValue.trim() === "") {
      console.log("Debug: Email validation failed - empty value");
      setError("Email is required");
      setIsLoading(false);
      return;
    }
    
    try {
      console.log("Debug: Sending request with email:", emailValue);
      const response = await apiRequest("POST", "/api/signin/forgot-account", { email: emailValue });
      
      console.log("Debug: Request successful");
      toast({ 
        title: "Organization ID sent", 
        description: `We've sent your Organization ID to ${emailValue}` 
      });
      setShowForgotAccount(false);
      forgotAccountForm.reset();
    } catch (err: any) {
      console.log("Debug: Request error:", err);
      
      // Try to extract error message from the API response
      let errorMessage = "Network error. Please check your connection and try again.";
      
      if (err && typeof err === 'object') {
        // Check if it's an API error with a specific message
        if (err.message && err.message.includes('400:')) {
          try {
            // Extract JSON from error message like "400: {\"error\":\"No account found with this email.\"}"
            const jsonMatch = err.message.match(/400: (.+)$/);
            if (jsonMatch) {
              const errorData = JSON.parse(jsonMatch[1]);
              errorMessage = errorData.error || "Failed to send Organization ID";
            }
          } catch (parseErr) {
            console.log("Debug: Failed to parse error JSON:", parseErr);
          }
        } else if (err.error) {
          errorMessage = err.error;
        } else if (err.message) {
          errorMessage = err.message;
        }
      }
      
      console.log("Debug: Setting error message:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot Account: Send Organization ID via email
  const onForgotAccountSubmit = async (values: z.infer<typeof forgotAccountSchema>) => {
    console.log("Debug: React Hook Form submit with values:", values);
    
    // If React Hook Form has the email, use normal flow
    if (values.email && values.email.trim() !== "") {
      return handleForgotAccountSubmit();
    }
    
    // Otherwise, use the robust handler that checks DOM values
    return handleForgotAccountSubmit();
  };

  const goBackToStep1 = () => {
    setCurrentStep(1);
    setStep1Data({ organization_id: "", email: "" });
    setOrganizationName("");
    step2Form.reset();
  };

  const goBackToStep2 = () => {
    setCurrentStep(2);
    step3Form.reset();
  };

  if (showForgotAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <Card>
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl font-bold">Forgot Account</CardTitle>
              <CardDescription>
                Enter your email to receive your Organization ID
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...forgotAccountForm}>
                <form onSubmit={forgotAccountForm.handleSubmit(onForgotAccountSubmit)} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <FormField
                    control={forgotAccountForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              data-testid="input-forgot-email"
                              placeholder="your.email@company.com"
                              className="pl-10"
                              type="email"
                              value={field.value || ""}
                              name={field.name}
                              ref={emailInputRef}
                              onChange={(e) => {
                                field.onChange(e.target.value);
                                // Clear any existing error when user starts typing
                                if (error) setError("");
                              }}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          Please enter your email address to receive your Organization ID
                        </p>
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    data-testid="button-send-org-id"
                    type="button"
                    className="w-full" 
                    disabled={isLoading}
                    onClick={async (e) => {
                      e.preventDefault();
                      console.log("Debug: Button clicked");
                      
                      // Always sync DOM value to form state (including empty values)
                      const domEmail = emailInputRef.current?.value || "";
                      const reactEmail = forgotAccountForm.getValues("email") || "";
                      console.log("Debug: DOM email value:", domEmail);
                      console.log("Debug: React email before sync:", reactEmail);
                      
                      // Always sync DOM to React state
                      forgotAccountForm.setValue("email", domEmail);
                      
                      // Wait a tick for state to update
                      await new Promise(resolve => setTimeout(resolve, 0));
                      
                      const formValues = forgotAccountForm.getValues();
                      console.log("Debug: Form values after sync:", formValues);
                      
                      // Directly call our handler instead of relying on form submission
                      await handleForgotAccountSubmit();
                    }}
                  >
                    {isLoading ? "Sending..." : "Send Organization ID"}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter>
              <Button 
                data-testid="button-back-to-signin"
                variant="ghost" 
                className="w-full" 
                onClick={() => setShowForgotAccount(false)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Step 1: Organization ID & Email */}
        {currentStep === 1 && (
          <Card>
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl font-bold">Sign In to EngageX</CardTitle>
              <CardDescription>
                Step 1 of {currentStep === 1 ? "2 or 3" : "3"}: Enter your organization and email
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...step1Form}>
                <form onSubmit={step1Form.handleSubmit(onStep1Submit)} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <FormField
                    control={step1Form.control}
                    name="organization_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization ID</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              data-testid="input-organization-id"
                              placeholder="Enter your organization ID"
                              className="pl-10"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={step1Form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              data-testid="input-email"
                              placeholder="your.email@company.com"
                              className="pl-10"
                              type="email"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    data-testid="button-validate-step1"
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Validating..." : "Continue"}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <Button 
                data-testid="button-forgot-account"
                variant="ghost" 
                className="w-full" 
                onClick={() => setShowForgotAccount(true)}
              >
                Don't know your Organization ID?
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/signup" className="text-primary hover:underline" data-testid="link-signup">
                  Sign up
                </Link>
              </div>
            </CardFooter>
          </Card>
        )}

        {/* Step 2: Username & Password */}
        {currentStep === 2 && (
          <Card>
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
              <CardDescription>
                Step 2 of {verificationInfo.mfa_enabled || verificationInfo.sso_enabled ? "3" : "2"}: 
                Sign in to {organizationName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...step2Form}>
                <form onSubmit={step2Form.handleSubmit(onStep2Submit)} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <FormField
                    control={step2Form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              data-testid="input-username"
                              placeholder="Enter your username"
                              className="pl-10"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={step2Form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              data-testid="input-password"
                              placeholder="Enter your password"
                              type={showPassword ? "text" : "password"}
                              className="pr-10"
                              {...field}
                            />
                            <Button
                              data-testid="button-toggle-password"
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full w-10"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    data-testid="button-signin-step2"
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing In..." : "Sign In"}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter>
              <Button 
                data-testid="button-back-to-step1"
                variant="ghost" 
                className="w-full" 
                onClick={goBackToStep1}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Organization & Email
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 3: MFA/OTP/SSO Verification */}
        {currentStep === 3 && (
          <Card>
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl font-bold">Verification Required</CardTitle>
              <CardDescription>
                Step 3 of 3: Enter your verification code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...step3Form}>
                <form onSubmit={step3Form.handleSubmit(onStep3Submit)} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="text-center space-y-2 mb-4">
                    {verificationInfo.mfa_enabled && (
                      <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                        <Shield className="h-4 w-4" />
                        <span>MFA Enabled</span>
                      </div>
                    )}
                    {verificationInfo.sso_enabled && (
                      <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                        <MessageSquare className="h-4 w-4" />
                        <span>SSO Enabled</span>
                      </div>
                    )}
                  </div>
                  
                  <FormField
                    control={step3Form.control}
                    name="verification_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Verification Code</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-verification-code"
                            placeholder="Enter 6-digit code"
                            className="text-center text-lg letter-spacing-wider"
                            maxLength={6}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                        <div className="text-xs text-muted-foreground text-center">
                          Enter the 6-digit verification code from your authenticator app or SMS
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    data-testid="button-verify-code"
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Verifying..." : "Verify & Sign In"}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter>
              <Button 
                data-testid="button-back-to-step2"
                variant="ghost" 
                className="w-full" 
                onClick={goBackToStep2}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Credentials
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}