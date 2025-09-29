import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";

export default function Landing() {
  const [, setLocation] = useLocation();


  const handleCustomSignin = () => {
    setLocation("/signin");
  };

  const handleSignup = () => {
    setLocation("/signup");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center">
              <i className="fas fa-envelope text-primary-foreground text-2xl"></i>
            </div>
          </div>
          <h1 className="text-5xl font-bold text-foreground mb-4">EngageX</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            The complete email marketing platform for organizations. Create, send, and track campaigns with enterprise-grade security and multi-tenant architecture.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg" 
              onClick={handleSignup}
              className="text-lg px-8 py-3"
              data-testid="button-signup"
            >
              Start Free Trial
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={handleCustomSignin}
              className="text-lg px-6 py-3"
              data-testid="button-custom-signin"
            >
              Sign In
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-users text-blue-600 text-xl"></i>
              </div>
              <CardTitle>Multi-Tenant Organizations</CardTitle>
              <CardDescription>
                Secure organization management with unique IDs and role-based access control.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-globe text-green-600 text-xl"></i>
              </div>
              <CardTitle>Domain Verification</CardTitle>
              <CardDescription>
                Verify your sending domains with DKIM, DMARC, and SPF records for maximum deliverability.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-chart-bar text-purple-600 text-xl"></i>
              </div>
              <CardTitle>Advanced Analytics</CardTitle>
              <CardDescription>
                Track open rates, click rates, bounces, and unsubscribes with detailed campaign analytics.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground mb-8">Why Choose EngageX?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-edit text-blue-600 text-2xl"></i>
              </div>
              <h3 className="font-semibold text-foreground mb-2">Drag & Drop Editor</h3>
              <p className="text-sm text-muted-foreground">Create beautiful emails with our intuitive drag-and-drop interface</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-code text-purple-600 text-2xl"></i>
              </div>
              <h3 className="font-semibold text-foreground mb-2">HTML Editor</h3>
              <p className="text-sm text-muted-foreground">Advanced customization with full HTML and CSS control</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-upload text-green-600 text-2xl"></i>
              </div>
              <h3 className="font-semibold text-foreground mb-2">Excel Import</h3>
              <p className="text-sm text-muted-foreground">Bulk import contacts from Excel files with smart validation</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-shield-alt text-yellow-600 text-2xl"></i>
              </div>
              <h3 className="font-semibold text-foreground mb-2">Enterprise Security</h3>
              <p className="text-sm text-muted-foreground">Role-based access, MFA, and complete data isolation</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
