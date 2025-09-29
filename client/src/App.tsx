import { Switch, Route } from "wouter";
import { Suspense, lazy } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/main-layout";
import RedirectToSignIn from "@/components/auth/redirect-to-signin";
import LoadingFallback from "@/components/ui/loading-fallback";
import PermissionRoute from "@/components/auth/permission-route";

// Lazy load pages for better performance
const NotFound = lazy(() => import("@/pages/not-found"));
const Landing = lazy(() => import("@/pages/landing"));
const Signup = lazy(() => import("@/pages/signup"));
const SignIn = lazy(() => import("@/pages/signin"));
const SubscriptionPage = lazy(() => import("@/pages/subscription"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Contacts = lazy(() => import("@/pages/contacts"));
const Campaigns = lazy(() => import("@/pages/campaigns"));
const Templates = lazy(() => import("@/pages/templates"));
const Domains = lazy(() => import("@/pages/domains"));
const Analytics = lazy(() => import("@/pages/analytics"));
const Team = lazy(() => import("@/pages/team"));
const Settings = lazy(() => import("@/pages/settings"));
const OrganizationSetup = lazy(() => import("@/components/onboarding/organization-setup"));
const InvitationPage = lazy(() => import("@/pages/invitation"));

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
      <Suspense fallback={<LoadingFallback message="Loading page..." />}>
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/signup" component={Signup} />
          <Route path="/signin" component={SignIn} />
          <Route path="/subscription" component={SubscriptionPage} />
          <Route path="/invite/:token" component={InvitationPage} />
          <Route component={RedirectToSignIn} />
        </Switch>
      </Suspense>
    );
  }

  // Handle authenticated users without organization
  if (!user?.organization?.id) {
    return (
      <Suspense fallback={<LoadingFallback message="Loading page..." />}>
        <Switch>
          <Route path="/" component={OrganizationSetup} />
          <Route path="/subscription" component={SubscriptionPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    );
  }

  // Handle authenticated users with organization
  return (
    <MainLayout>
      <Suspense fallback={<LoadingFallback message="Loading page..." />}>
        <Switch>
          <Route path="/" >
            <PermissionRoute permissions={['dashboard']}>
              <Dashboard />
            </PermissionRoute>
          </Route>
          <Route path="/dashboard" >
            <PermissionRoute permissions={['dashboard']}>
              <Dashboard />
            </PermissionRoute>
          </Route>
          <Route path="/contacts" >
            <PermissionRoute permissions={['contacts:read']}>
              <Contacts />
            </PermissionRoute>
          </Route>
          <Route path="/campaigns" >
            <PermissionRoute permissions={['campaigns:read']}>
              <Campaigns />
            </PermissionRoute>
          </Route>
          <Route path="/templates" >
            <PermissionRoute permissions={['templates:read']}>
              <Templates />
            </PermissionRoute>
          </Route>
          <Route path="/domains" >
            <PermissionRoute permissions={['domains:read']}>
              <Domains />
            </PermissionRoute>
          </Route>
          <Route path="/analytics" >
            <PermissionRoute permissions={['analytics:read']}>
              <Analytics />
            </PermissionRoute>
          </Route>
          <Route path="/team" >
            <PermissionRoute permissions={['team:read']}>
              <Team />
            </PermissionRoute>
          </Route>
          <Route path="/settings" >
            <PermissionRoute permissions={['settings:read']}>
              <Settings />
            </PermissionRoute>
          </Route>
          <Route path="/subscription" >
            <PermissionRoute permissions={['subscription:read']}>
              <SubscriptionPage />
            </PermissionRoute>
          </Route>
          <Route path="/invite/:token" component={InvitationPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
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
