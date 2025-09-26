import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/page-header";
import { StatsGrid, StatCard } from "@/components/ui/stats-grid";
import { StatusBadge } from "@/components/ui/status-badge";
import { Building2, Settings as SettingsIcon, Mail, Eye, MousePointer, Shield, Users, Calendar, Clock, AlertTriangle, RefreshCw, Trash2, Save, CreditCard } from "lucide-react";

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

  const emailSettingsSchema = z.object({
    defaultFromName: z.string().min(1, "From name is required"),
    enableDoubleOptIn: z.boolean(),
    enableUnsubscribeTracking: z.boolean(),
    enableClickTracking: z.boolean(),
    enableOpenTracking: z.boolean(),
  });

  const form = useForm<z.infer<typeof emailSettingsSchema>>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: emailSettings,
  });

  const onSubmitEmailSettings = (values: z.infer<typeof emailSettingsSchema>) => {
    setEmailSettings(values);
    toast({
      title: "Email Settings Updated",
      description: "Your email settings have been updated successfully.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <PageHeader
          title="Settings"
          description="Manage your organization settings, preferences, and security"
          primaryAction={
            <Button data-testid="button-save-all-settings">
              <Save className="h-4 w-4 mr-2" />
              Save All Changes
            </Button>
          }
        />

        <div className="space-y-6">
        {/* Organization Information */}
        <Card data-testid="card-organization-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Information
            </CardTitle>
            <CardDescription>
              View your organization details and basic information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatsGrid className="grid-cols-1 md:grid-cols-3 mb-6">
              <StatCard
                title="Organization Name"
                value={user?.organization?.name || "Not Available"}
                description="Your organization's display name"
                icon={<Building2 className="h-6 w-6 text-blue-600" />}
                testId="stat-org-name"
              />
              <StatCard
                title="Industry"
                value={user?.organization?.industry || "Not Specified"}
                description="Business sector"
                icon={<Users className="h-6 w-6 text-green-600" />}
                testId="stat-org-industry"
              />
              <StatCard
                title="Team Size"
                value={user?.organization?.employeesRange ? `${user.organization.employeesRange} employees` : "Not Specified"}
                description="Number of employees"
                icon={<Users className="h-6 w-6 text-purple-600" />}
                testId="stat-org-employees"
              />
            </StatsGrid>
            
            {user?.organization?.trialEndsAt && (
              <div className="flex items-center gap-3 p-4 border border-amber-200 bg-amber-50 rounded-lg" data-testid="trial-status-banner">
                <Clock className="h-5 w-5 text-amber-600" />
                <div className="flex-1">
                  <p className="font-medium text-amber-800">Trial Account</p>
                  <p className="text-sm text-amber-700">
                    {getTrialDaysLeft()} days remaining in your free trial
                  </p>
                </div>
                <StatusBadge status="trial" data-testid="badge-trial-status" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription & Billing */}
        <Card data-testid="card-subscription-billing">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription & Billing
            </CardTitle>
            <CardDescription>
              Manage your subscription plan and billing information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Current Plan */}
              <div className="flex items-center justify-between p-4 border border-border rounded-lg" data-testid="current-plan-display">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-foreground">{getCurrentPlan()?.label}</h3>
                    {subscriptionPlan === 'free_trial' && (
                      <StatusBadge status="trial" data-testid="badge-plan-status" />
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
                          <Button 
                            className="w-full mt-3" 
                            size="sm"
                            data-testid={`button-${plan.value === 'free_trial' ? 'downgrade' : 'upgrade'}-plan-${plan.value}`}
                          >
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
        <Card data-testid="card-email-settings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Settings
            </CardTitle>
            <CardDescription>
              Configure default email settings and tracking preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitEmailSettings)} className="space-y-6">
              <FormField
                control={form.control}
                name="defaultFromName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default From Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your Organization Name"
                        data-testid="input-from-name"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      This name will appear as the sender in your email campaigns
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium text-foreground">Tracking Settings</h4>
                
                <FormField
                  control={form.control}
                  name="enableOpenTracking"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0">
                      <div className="space-y-0.5">
                        <FormLabel>Open Tracking</FormLabel>
                        <FormDescription>
                          Track when recipients open your emails
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-open-tracking"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enableClickTracking"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0">
                      <div className="space-y-0.5">
                        <FormLabel>Click Tracking</FormLabel>
                        <FormDescription>
                          Track when recipients click links in your emails
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-click-tracking"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enableUnsubscribeTracking"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0">
                      <div className="space-y-0.5">
                        <FormLabel>Unsubscribe Tracking</FormLabel>
                        <FormDescription>
                          Automatically handle unsubscribe requests
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-unsubscribe-tracking"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enableDoubleOptIn"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0">
                      <div className="space-y-0.5">
                        <FormLabel>Double Opt-in</FormLabel>
                        <FormDescription>
                          Require confirmation when contacts subscribe
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-double-optin"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" data-testid="button-update-email-settings">
                <SettingsIcon className="h-4 w-4 mr-2" />
                Update Email Settings
              </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Account Security */}
        <Card data-testid="card-account-security">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Account Security
            </CardTitle>
            <CardDescription>
              Manage your account security and authentication settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between" data-testid="security-2fa">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <div>
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status="inactive" data-testid="badge-2fa-status" />
                  <Button variant="outline" size="sm" data-testid="button-enable-2fa">
                    Enable
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between" data-testid="security-sessions">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-green-600" />
                  <div>
                    <Label>Login Sessions</Label>
                    <p className="text-sm text-muted-foreground">
                      Manage active login sessions
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" data-testid="button-view-sessions">
                  <Eye className="h-4 w-4 mr-2" />
                  View Sessions
                </Button>
              </div>

              <div className="flex items-center justify-between" data-testid="security-api-keys">
                <div className="flex items-center gap-3">
                  <SettingsIcon className="h-5 w-5 text-purple-600" />
                  <div>
                    <Label>API Keys</Label>
                    <p className="text-sm text-muted-foreground">
                      Manage API keys for integrations
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" data-testid="button-manage-keys">
                  <SettingsIcon className="h-4 w-4 mr-2" />
                  Manage Keys
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive" data-testid="card-danger-zone">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4" data-testid="alert-danger-warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                These actions cannot be undone. Please proceed with caution.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between" data-testid="danger-delete-org">
                <div className="flex items-center gap-3">
                  <Trash2 className="h-5 w-5 text-red-600" />
                  <div>
                    <Label>Delete Organization</Label>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your organization and all data
                    </p>
                  </div>
                </div>
                <Button variant="destructive" size="sm" data-testid="button-delete-organization">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Organization
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
