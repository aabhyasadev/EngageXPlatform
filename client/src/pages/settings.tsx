import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [orgSettings, setOrgSettings] = useState({
    name: user?.organization?.name || "",
    industry: user?.organization?.industry || "",
    employeesRange: user?.organization?.employeesRange || "",
    subscriptionPlan: user?.organization?.subscriptionPlan || "free_trial",
  });

  const [emailSettings, setEmailSettings] = useState({
    defaultFromName: user?.organization?.name || "",
    enableDoubleOptIn: true,
    enableUnsubscribeTracking: true,
    enableClickTracking: true,
    enableOpenTracking: true,
  });

  const updateOrgMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", `/api/organizations/${user?.organizationId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Organization settings updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const handleOrgUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrgMutation.mutate(orgSettings);
  };

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

  const industries = [
    "Technology", "Healthcare", "Finance", "Education", "Retail", "Manufacturing", 
    "Real Estate", "Marketing", "Non-profit", "Government", "Other"
  ];

  const employeeRanges = [
    "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"
  ];

  const getCurrentPlan = () => {
    return subscriptionPlans.find(plan => plan.value === orgSettings.subscriptionPlan);
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
              Update your organization details and basic information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleOrgUpdate} className="space-y-4">
              <div>
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  value={orgSettings.name}
                  onChange={(e) => setOrgSettings({ ...orgSettings, name: e.target.value })}
                  placeholder="Your Organization Name"
                  data-testid="input-org-name"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="industry">Industry</Label>
                  <Select 
                    value={orgSettings.industry} 
                    onValueChange={(value) => setOrgSettings({ ...orgSettings, industry: value })}
                  >
                    <SelectTrigger data-testid="select-industry">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {industries.map((industry) => (
                        <SelectItem key={industry} value={industry.toLowerCase()}>
                          {industry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="employees">Number of Employees</Label>
                  <Select 
                    value={orgSettings.employeesRange} 
                    onValueChange={(value) => setOrgSettings({ ...orgSettings, employeesRange: value })}
                  >
                    <SelectTrigger data-testid="select-employees">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeRanges.map((range) => (
                        <SelectItem key={range} value={range}>
                          {range} employees
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" disabled={updateOrgMutation.isPending} data-testid="button-update-org">
                {updateOrgMutation.isPending ? "Updating..." : "Update Organization"}
              </Button>
            </form>
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
                    {orgSettings.subscriptionPlan === 'free_trial' && (
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
                    {orgSettings.subscriptionPlan === 'yearly' ? '/year' : '/month'}
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
                        plan.value === orgSettings.subscriptionPlan 
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
                        {plan.value !== orgSettings.subscriptionPlan && (
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
