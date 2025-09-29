import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, Clock, Mail, Building, UserCheck } from "lucide-react";

interface InvitationData {
  id: string;
  email: string;
  role: string;
  role_display: string;
  organization_name: string;
  invited_by_name: string;
  expires_at: string;
  is_expired: boolean;
}

export default function InvitationPage() {
  const [match, params] = useRoute("/invite/:token");
  const [showModal, setShowModal] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const token = params?.token;

  // Query to fetch invitation details
  const { data: invitation, isLoading, error } = useQuery<InvitationData>({
    queryKey: ['/api/invitations', token, 'verify'],
    queryFn: async () => {
      const response = await fetch(`/api/invitations/${token}/verify/`);
      if (!response.ok) {
        throw new Error('Invalid or expired invitation');
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  // Mutation to accept invitation
  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/invitations/${token}/accept/`);
      return response.json();
    },
    onSuccess: (data) => {
      setAccepted(true);
      
      // Show success toast
      toast({
        title: "Invitation Accepted!",
        description: `Welcome to ${data.organization}! You can now sign in to access your account.`,
      });

      // Invalidate relevant queries to update UI for all users in the organization
      // This ensures the team page shows the new member immediately
      queryClient.invalidateQueries({ queryKey: ['/api/users/'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invitations/'] });
      
      // Invalidate notifications to update the notification dropdown
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/notifications'] });
      
      // Show a secondary toast for team members who might be viewing the team page
      setTimeout(() => {
        toast({
          title: "Team Updated",
          description: "A new member has joined your organization!",
        });
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to decline invitation
  const declineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/invitations/${token}/decline/`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation Declined",
        description: "You have declined the invitation.",
      });
      
      // Invalidate invitation queries to update any pending invitations lists
      queryClient.invalidateQueries({ queryKey: ['/api/invitations/'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/notifications'] });
      
      // Redirect to landing page after a short delay
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAccept = () => {
    setShowModal(true);
  };

  const confirmAccept = () => {
    acceptMutation.mutate();
    setShowModal(false);
  };

  const handleDecline = () => {
    declineMutation.mutate();
  };

  const handleSignIn = () => {
    window.location.href = '/signin';
  };

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              onClick={() => window.location.href = '/'}
              data-testid="button-go-home"
            >
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
  }

  // Show success state after acceptance
  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-green-600">Welcome to the Team!</CardTitle>
            <CardDescription>
              Your invitation has been accepted. You can now sign in to access your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">You're now part of:</p>
              <div className="flex items-center justify-center space-x-2">
                <Building className="h-4 w-4" />
                <span className="font-semibold">{invitation?.organization_name}</span>
              </div>
            </div>
            <Button 
              onClick={handleSignIn}
              className="w-full"
              data-testid="button-sign-in"
            >
              Sign In to Your Account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show invitation details
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>
            Join {invitation?.organization_name} on EngageX
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Email</span>
              </div>
              <span className="text-sm font-medium">{invitation?.email}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Organization</span>
              </div>
              <span className="text-sm font-medium">{invitation?.organization_name}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Role</span>
              </div>
              <Badge variant="secondary" data-testid="badge-role">
                {invitation?.role_display}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Invited by</span>
              </div>
              <span className="text-sm font-medium">{invitation?.invited_by_name}</span>
            </div>
          </div>

          {/* Expiration warning */}
          {invitation?.expires_at && (
            <div className="p-3 bg-orange-50 dark:bg-orange-950/50 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-xs text-orange-800 dark:text-orange-200">
                This invitation expires on {new Date(invitation.expires_at).toLocaleDateString()} at {new Date(invitation.expires_at).toLocaleTimeString()}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={handleAccept}
              className="w-full"
              disabled={acceptMutation.isPending || invitation?.is_expired}
              data-testid="button-accept-invitation"
            >
              {acceptMutation.isPending ? "Accepting..." : "Accept Invitation"}
            </Button>
            <Button 
              onClick={handleDecline}
              variant="outline"
              className="w-full"
              disabled={declineMutation.isPending}
              data-testid="button-decline-invitation"
            >
              {declineMutation.isPending ? "Declining..." : "Decline"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent data-testid="modal-confirm-acceptance">
          <DialogHeader>
            <DialogTitle>Accept Invitation?</DialogTitle>
            <DialogDescription>
              You're about to join <strong>{invitation?.organization_name}</strong> as a <strong>{invitation?.role_display}</strong>. 
              You'll be able to sign in and access the platform immediately after accepting.
            </DialogDescription>
          </DialogHeader>
          <div className="flex space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              className="flex-1"
              data-testid="button-cancel-acceptance"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmAccept}
              className="flex-1"
              data-testid="button-confirm-acceptance"
            >
              Accept & Join
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}