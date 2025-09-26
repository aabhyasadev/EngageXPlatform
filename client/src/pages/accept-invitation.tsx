import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";

const acceptInvitationSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100, "First name too long"),
  last_name: z.string().min(1, "Last name is required").max(100, "Last name too long"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100, "Password too long"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AcceptInvitationFormData = z.infer<typeof acceptInvitationSchema>;

export default function AcceptInvitation() {
  const [location, navigate] = useLocation();
  const [invitationStatus, setInvitationStatus] = useState<'loading' | 'valid' | 'invalid' | 'expired'>('loading');
  const [invitationData, setInvitationData] = useState<{
    email: string;
    role: string;
    organization_name: string;
    invited_by_name: string;
  } | null>(null);

  const { toast } = useToast();
  
  // Get token from URL search params
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const form = useForm<AcceptInvitationFormData>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Check invitation validity on component mount
  useEffect(() => {
    const validateInvitation = async () => {
      if (!token) {
        setInvitationStatus('invalid');
        return;
      }

      try {
        setInvitationStatus('loading');
        
        const response = await fetch(`/api/invitations/validate/?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (response.ok && data.valid) {
          setInvitationStatus('valid');
          setInvitationData({
            email: data.email,
            role: data.role,
            organization_name: data.organization_name,
            invited_by_name: data.invited_by_name
          });
        } else {
          if (data.status === 'expired') {
            setInvitationStatus('expired');
          } else {
            setInvitationStatus('invalid');
          }
        }
      } catch (error) {
        console.error('Error validating invitation:', error);
        setInvitationStatus('invalid');
      }
    };

    validateInvitation();
  }, [token]);

  const acceptInvitationMutation = useMutation({
    mutationFn: async (formData: AcceptInvitationFormData) => {
      const response = await apiRequest("POST", "/api/invitations/accept/", {
        token: token,
        first_name: formData.first_name,
        last_name: formData.last_name,
        password: formData.password,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Welcome to the team!",
        description: "Your account has been created successfully. You can now log in.",
      });
      // Redirect to signin page
      navigate('/signin');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to accept invitation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAcceptInvitation = (data: AcceptInvitationFormData) => {
    acceptInvitationMutation.mutate(data);
  };

  // Loading state
  if (invitationStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="animate-pulse space-y-6 w-full max-w-md">
          <div className="h-8 bg-muted rounded w-64 mx-auto"></div>
          <div className="h-96 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (invitationStatus === 'invalid' || !token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-xl">Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Please contact your organization administrator for a new invitation.
            </p>
            <Button onClick={() => navigate('/')} data-testid="button-go-home">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <UserPlus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-xl">Join EngageX</CardTitle>
          <CardDescription>
            Complete your profile to join the team
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          {invitationData && (
            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
              <Mail className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">You've been invited to join {invitationData.organization_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Email: {invitationData.email} • Role: {invitationData.role.replace('_', ' ')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Invited by: {invitationData.invited_by_name}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Accept Invitation Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAcceptInvitation)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="John"
                          data-testid="input-first-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Doe"
                          data-testid="input-last-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Choose a secure password"
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Confirm your password"
                        data-testid="input-confirm-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col space-y-2 pt-4">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={acceptInvitationMutation.isPending}
                  data-testid="button-accept-invitation"
                >
                  {acceptInvitationMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Accept Invitation
                    </>
                  )}
                </Button>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/')}
                  data-testid="button-decline-invitation"
                >
                  Decline
                </Button>
              </div>
            </form>
          </Form>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              By accepting this invitation, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}