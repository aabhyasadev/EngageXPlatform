import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";

interface UserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UserModal({ open, onOpenChange }: UserModalProps) {
  const { user } = useAuth();
  const { subscription, isTrialUser, daysRemaining } = useSubscription();

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  const handleEditProfile = () => {
    onOpenChange(false);
    // Navigate to profile/settings page
    window.location.href = "/settings";
  };

  const handleViewSubscription = () => {
    onOpenChange(false);
    window.location.href = "/subscription";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          <div className="flex flex-col items-center space-y-4">
            {/* User Avatar */}
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
              {user?.profileImageUrl ? (
                <img 
                  src={user.profileImageUrl} 
                  alt="Profile" 
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <i className="fas fa-user text-white text-2xl"></i>
              )}
            </div>
            
            {/* User Info */}
            <div className="text-center">
              <DialogTitle className="text-xl font-semibold">
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}` 
                  : user?.email || "User"}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {user?.email}
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  {user?.role || "Member"}
                </Badge>
                {subscription && (
                  <Badge 
                    variant={isTrialUser ? "secondary" : subscription.is_expired ? "destructive" : "default"}
                    className="text-xs"
                  >
                    {isTrialUser 
                      ? `Trial (${daysRemaining}d)`
                      : subscription.is_expired 
                      ? "Expired"
                      : subscription.plan_name?.replace(' Monthly', '').replace(' Yearly', '')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <Separator className="my-4" />

        {/* Organization Info */}
        {user?.organization && (
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-building text-primary-foreground text-sm"></i>
              </div>
              <div>
                <p className="font-medium text-sm">Organization</p>
                <p className="text-sm text-muted-foreground">{user.organization.name}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button 
            variant="outline" 
            className="w-full justify-start" 
            onClick={handleEditProfile}
            data-testid="button-edit-profile"
          >
            <i className="fas fa-user-edit mr-3 text-muted-foreground"></i>
            Edit Profile
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full justify-start" 
            onClick={handleViewSubscription}
            data-testid="button-view-subscription"
          >
            <i className="fas fa-credit-card mr-3 text-muted-foreground"></i>
            Manage Subscription
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => window.location.href = "/settings"}
            data-testid="button-settings"
          >
            <i className="fas fa-cog mr-3 text-muted-foreground"></i>
            Settings
          </Button>
          
          <Separator className="my-3" />
          
          <Button 
            variant="outline" 
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <i className="fas fa-sign-out-alt mr-3"></i>
            Sign Out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}