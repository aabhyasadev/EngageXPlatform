import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft } from "lucide-react";
import EmailStep from "@/components/signup/email-step";
import BasicInfoStep from "@/components/signup/basic-info-step";
import BusinessInfoStep from "@/components/signup/business-info-step";
import OTPStep from "@/components/signup/otp-step";
import PasswordStep from "@/components/signup/password-step";

export interface SignupData {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  contacts_range: string;
  employees_range: string;
  industry: string;
}

export default function Signup() {
  const [location, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [signupData, setSignupData] = useState<SignupData>({
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    contacts_range: "",
    employees_range: "",
    industry: "",
  });

  const steps = [
    { number: 1, title: "Email Verification", description: "Enter your email address" },
    { number: 2, title: "Basic Information", description: "Tell us about yourself" },
    { number: 3, title: "Business Details", description: "About your business" },
    { number: 4, title: "Email Verification", description: "Verify your email" },
    { number: 5, title: "Set Password", description: "Create your account" },
  ];

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDataUpdate = (data: Partial<SignupData>) => {
    setSignupData(prev => ({ ...prev, ...data }));
  };

  const handleBackToLogin = () => {
    setLocation("/");
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <EmailStep
            email={signupData.email}
            onNext={handleNext}
            onDataUpdate={handleDataUpdate}
          />
        );
      case 2:
        return (
          <BasicInfoStep
            data={{
              first_name: signupData.first_name,
              last_name: signupData.last_name,
              phone: signupData.phone,
            }}
            onNext={handleNext}
            onBack={handleBack}
            onDataUpdate={handleDataUpdate}
          />
        );
      case 3:
        return (
          <BusinessInfoStep
            data={{
              contacts_range: signupData.contacts_range,
              employees_range: signupData.employees_range,
              industry: signupData.industry,
            }}
            onNext={handleNext}
            onBack={handleBack}
            onDataUpdate={handleDataUpdate}
          />
        );
      case 4:
        return (
          <OTPStep
            email={signupData.email}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <PasswordStep
            onBack={handleBack}
            signupData={signupData}
          />
        );
      default:
        return null;
    }
  };

  const progress = (currentStep / 5) * 100;
  const currentStepInfo = steps[currentStep - 1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent p-4">
      <div className="container mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center py-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <i className="fas fa-envelope text-primary-foreground text-xl"></i>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Join EngageX</h1>
          <p className="text-muted-foreground">
            Create your account and start your 14-day free trial
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-muted-foreground">
              Step {currentStep} of 5
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToLogin}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-back-to-login"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Login
            </Button>
          </div>
          <Progress value={progress} className="h-2 mb-4" data-testid="progress-signup" />
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">
              {currentStepInfo.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {currentStepInfo.description}
            </p>
          </div>
        </div>

        {/* Step Content */}
        <Card>
          <CardContent className="p-8">
            {renderStep()}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-8 text-sm text-muted-foreground">
          By continuing, you agree to our{" "}
          <a href="#" className="text-primary hover:underline">Terms of Service</a>
          {" "}and{" "}
          <a href="#" className="text-primary hover:underline">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}