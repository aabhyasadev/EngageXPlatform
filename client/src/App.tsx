import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import Contacts from "@/pages/contacts";
import Campaigns from "@/pages/campaigns";
import Templates from "@/pages/templates";
import Domains from "@/pages/domains";
import Analytics from "@/pages/analytics";
import Team from "@/pages/team";
import Settings from "@/pages/settings";
import MainLayout from "@/components/layout/main-layout";
import OrganizationSetup from "@/components/onboarding/organization-setup";

function Router() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Handle unauthenticated users
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/signup" component={Signup} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Handle authenticated users without organization
  if (!user?.organizationId) {
    return (
      <Switch>
        <Route path="/" component={OrganizationSetup} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Handle authenticated users with organization
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/campaigns" component={Campaigns} />
        <Route path="/templates" component={Templates} />
        <Route path="/domains" component={Domains} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/team" component={Team} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
