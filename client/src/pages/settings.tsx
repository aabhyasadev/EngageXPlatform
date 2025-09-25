import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [subscriptionPlan] = useState("free_trial");

  const [emailSettings, setEmailSettings] = useState({
    defaultFromName: user?.organization?.name || "",
    enableDoubleOptIn: true,
    enableUnsubscribeTracking: true,
    enableClickTracking: true,
    enableOpenTracking: true,
  });


  const handleEmailSettingsUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Email Settings",
      description: "Email settings would be updated (not implemented in this demo)",
    });
  };

  const subscriptionPlans = [
    { value: "free_trial", label: "Free Trial", price: "$0", contacts: "1,000", campaigns: "10" },
    { value: "monthly", label: "Monthly", price: "$29", contacts: "10,000", campaigns: "Unlimited" },
    { value: "yearly", label: "Yearly", price: "$290", contacts: "50,000", campaigns: "Unlimited" },
  ];


  const getCurrentPlan = () => {
    return subscriptionPlans.find(plan => plan.value === subscriptionPlan);
  };

  const getTrialDaysLeft = () => {
    if (!user?.organization?.trialEndsAt) return 0;
    const trialEnd = new Date(user.organization.trialEndsAt);
    const now = new Date();
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  return (
    <div className="p-6 bg-background max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure your organization settings and preferences.
        </p>
      </div>

      <div className="space-y-6">
        {/* Organization Information */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Information</CardTitle>
            <CardDescription>
              View your organization details and basic information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Organization Name</Label>
                <p className="text-foreground font-medium mt-1" data-testid="text-org-name">
                  {user?.organization?.name || "Not Available"}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Industry</Label>
                  <p className="text-foreground font-medium mt-1 capitalize" data-testid="text-org-industry">
                    {user?.organization?.industry || "Not Specified"}
                  </p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Number of Employees</Label>
                  <p className="text-foreground font-medium mt-1" data-testid="text-org-employees">
                    {user?.organization?.employeesRange ? `${user.organization.employeesRange} employees` : "Not Specified"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription & Billing */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription & Billing</CardTitle>
            <CardDescription>
              Manage your subscription plan and billing information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Current Plan */}
              <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-foreground">{getCurrentPlan()?.label}</h3>
                    {subscriptionPlan === 'free_trial' && (
                      <Badge variant="outline">
                        {getTrialDaysLeft()} days left
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {getCurrentPlan()?.contacts} contacts • {getCurrentPlan()?.campaigns} campaigns
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-foreground" data-testid="text-current-price">
                    {getCurrentPlan()?.price}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {subscriptionPlan === 'yearly' ? '/year' : '/month'}
                  </div>
                </div>
              </div>

              {/* Available Plans */}
              <div>
                <h4 className="font-medium text-foreground mb-3">Available Plans</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {subscriptionPlans.map((plan) => (
                    <div 
                      key={plan.value}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        plan.value === subscriptionPlan 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      data-testid={`plan-${plan.value}`}
                    >
                      <div className="text-center">
                        <h5 className="font-semibold text-foreground">{plan.label}</h5>
                        <div className="text-2xl font-bold text-foreground my-2">{plan.price}</div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>{plan.contacts} contacts</div>
                          <div>{plan.campaigns} campaigns</div>
                        </div>
                        {plan.value !== subscriptionPlan && (
                          <Button className="w-full mt-3" size="sm">
                            {plan.value === 'free_trial' ? 'Downgrade' : 'Upgrade'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Email Settings</CardTitle>
            <CardDescription>
              Configure default email settings and tracking preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailSettingsUpdate} className="space-y-6">
              <div>
                <Label htmlFor="defaultFromName">Default From Name</Label>
                <Input
                  id="defaultFromName"
                  value={emailSettings.defaultFromName}
                  onChange={(e) => setEmailSettings({ ...emailSettings, defaultFromName: e.target.value })}
                  placeholder="Your Organization Name"
                  data-testid="input-from-name"
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium text-foreground">Tracking Settings</h4>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Open Tracking</Label>
                    <p className="text-sm text-muted-foreground">
                      Track when recipients open your emails
                    </p>
                  </div>
                  <Switch
                    checked={emailSettings.enableOpenTracking}
                    onCheckedChange={(checked) => 
                      setEmailSettings({ ...emailSettings, enableOpenTracking: checked })
                    }
                    data-testid="switch-open-tracking"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Click Tracking</Label>
                    <p className="text-sm text-muted-foreground">
                      Track when recipients click links in your emails
                    </p>
                  </div>
                  <Switch
                    checked={emailSettings.enableClickTracking}
                    onCheckedChange={(checked) => 
                      setEmailSettings({ ...emailSettings, enableClickTracking: checked })
                    }
                    data-testid="switch-click-tracking"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Unsubscribe Tracking</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically handle unsubscribe requests
                    </p>
                  </div>
                  <Switch
                    checked={emailSettings.enableUnsubscribeTracking}
                    onCheckedChange={(checked) => 
                      setEmailSettings({ ...emailSettings, enableUnsubscribeTracking: checked })
                    }
                    data-testid="switch-unsubscribe-tracking"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Double Opt-in</Label>
                    <p className="text-sm text-muted-foreground">
                      Require confirmation when contacts subscribe
                    </p>
                  </div>
                  <Switch
                    checked={emailSettings.enableDoubleOptIn}
                    onCheckedChange={(checked) => 
                      setEmailSettings({ ...emailSettings, enableDoubleOptIn: checked })
                    }
                    data-testid="switch-double-optin"
                  />
                </div>
              </div>

              <Button type="submit" data-testid="button-update-email-settings">
                Update Email Settings
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Account Security */}
        <Card>
          <CardHeader>
            <CardTitle>Account Security</CardTitle>
            <CardDescription>
              Manage your account security and authentication settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <Badge variant="outline">Not Enabled</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Login Sessions</Label>
                  <p className="text-sm text-muted-foreground">
                    Manage active login sessions
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  View Sessions
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>API Keys</Label>
                  <p className="text-sm text-muted-foreground">
                    Manage API keys for integrations
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Manage Keys
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Delete Organization</Label>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your organization and all data
                  </p>
                </div>
                <Button variant="destructive" size="sm">
                  Delete Organization
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
