import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import SubscriptionStatus from '@/components/subscription/SubscriptionStatus';
import PlanCard from '@/components/subscription/PlanCard';
import BillingHistory from '@/components/subscription/BillingHistory';
import CardsManager from '@/components/subscription/CardsManager';
import AddCardModal from '@/components/subscription/AddCardModal';
import { PageHeader } from '@/components/ui/page-header';
import { StatsGrid, StatCard } from '@/components/ui/stats-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, BarChart, Mail, Settings, CreditCard, Receipt, AlertTriangle, RefreshCw } from 'lucide-react';

// Format price from cents to currency display
const formatPrice = (cents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
};

export default function SubscriptionPage() {
  const { toast } = useToast();
  const [showYearly, setShowYearly] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  // Fetch available subscription plans with detailed features
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['/api/subscription/plans-detailed/'],
    staleTime: 10 * 60 * 1000, // 10 minutes - plans don't change often
    retry: 3,
  });

  // Fetch current subscription
  const { data: currentSubscription, isLoading: subscriptionLoading, refetch: refetchSubscription } = useQuery({
    queryKey: ['/api/subscription/current/'],
    staleTime: 2 * 60 * 1000, // 2 minutes for subscription status
    retry: 3,
  });

  // Fetch billing history
  const { data: billingHistory, isLoading: billingLoading } = useQuery({
    queryKey: ['/api/subscription/billing-history/'],
    enabled: true, // Enable to fetch billing history
    staleTime: 5 * 60 * 1000, // 5 minutes for billing history
    retry: 3,
  });

  // Fetch cards
  const { data: cardsData, isLoading: cardsLoading, refetch: refetchCards } = useQuery({
    queryKey: ['/api/cards/'],
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutes for payment methods
    retry: 3,
  });

  // Get default card - handle both paginated and non-paginated responses
  const cardsArray = (cardsData as any)?.results || cardsData || [];
  const defaultCard = Array.isArray(cardsArray) ? cardsArray.find?.((card: any) => card.is_default) : null;

  // Create checkout session for new subscriptions
  const createCheckoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await apiRequest('POST', '/api/subscription/create-checkout-session', { 
        plan_id: planId,
        success_url: window.location.href + '?success=true',
        cancel_url: window.location.href
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
      setProcessingAction(null);
    },
  });

  // Manage subscription mutation (upgrade/downgrade/cancel/resume)
  const manageSubscriptionMutation = useMutation({
    mutationFn: async ({ action, newPlanId }: { action: string; newPlanId?: string }) => {
      const response = await apiRequest('POST', '/api/subscription/manage', { 
        action,
        new_plan_id: newPlanId,
        immediate: false
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Success",
        description: data.message || `Subscription ${variables.action} successful`,
      });
      refetchSubscription();
      setProcessingAction(null);
      if (variables.action === 'cancel') {
        setShowCancelDialog(false);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to manage subscription",
        variant: "destructive",
      });
      setProcessingAction(null);
    },
  });

  // Create billing portal session
  const createBillingPortalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/subscription/billing-portal', {
        return_url: window.location.href
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.portal_url) {
        window.location.href = data.portal_url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal",
        variant: "destructive",
      });
    },
  });

  // Delete card mutation
  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const response = await apiRequest('DELETE', `/api/cards/${cardId}/`);
      return response.json();
    },
    onSuccess: () => {
      // Silently delete - no toast notification
      refetchCards();
      refetchSubscription();
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to remove card",
        variant: "destructive",
      });
    },
  });

  // Update card mutation
  const updateCardMutation = useMutation({
    mutationFn: async ({ cardId, data }: { cardId: string; data: any }) => {
      const response = await apiRequest('PATCH', `/api/cards/${cardId}/`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Card updated successfully",
      });
      refetchCards();
      refetchSubscription();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update card",
        variant: "destructive",
      });
    },
  });

  const handleSelectPlan = (planId: string) => {
    const currentPlan = (currentSubscription as any)?.subscription?.plan;
    
    if (currentPlan && currentPlan !== 'free_trial') {
      // Existing subscription - upgrade/downgrade
      const currentValue = getPlanValue(currentPlan);
      const newValue = getPlanValue(planId);
      const action = newValue > currentValue ? 'upgrade' : 'downgrade';
      
      setProcessingAction(planId);
      manageSubscriptionMutation.mutate({ action, newPlanId: planId });
    } else {
      // New subscription
      setProcessingAction(planId);
      createCheckoutMutation.mutate(planId);
    }
  };

  const getPlanValue = (planId: string): number => {
    const planValues: { [key: string]: number } = {
      'basic_monthly': 1,
      'basic_yearly': 2,
      'pro_monthly': 3,
      'pro_yearly': 4,
      'premium_monthly': 5,
      'premium_yearly': 6,
    };
    return planValues[planId] || 0;
  };

  const handleCancelSubscription = () => {
    setProcessingAction('cancel');
    manageSubscriptionMutation.mutate({ action: 'cancel' });
    setShowCancelDialog(false);
  };

  const handleResumeSubscription = () => {
    setProcessingAction('resume');
    manageSubscriptionMutation.mutate({ action: 'resume' });
  };

  const handleManagePayment = () => {
    createBillingPortalMutation.mutate();
  };

  const handleUpdateCard = (card: any) => {
    // For now, just open billing portal for complex updates
    createBillingPortalMutation.mutate();
  };

  const handleAddCard = () => {
    // Open modal to add new card
    setShowAddCardModal(true);
  };

  const handleDeleteCard = (card: any) => {
    // Delete card directly without confirmation alert
    deleteCardMutation.mutate(card.id);
  };

  const handleSetDefaultCard = (cardToSetAsDefault: any) => {
    // First, set all cards as non-default, then set the selected card as default
    const updatePromises = cardsArray.map((card: any) => {
      if (card.id === cardToSetAsDefault.id) {
        // Set this card as default
        return updateCardMutation.mutateAsync({ 
          cardId: card.id, 
          data: { is_default: true } 
        });
      } else if (card.is_default) {
        // Remove default status from currently default cards
        return updateCardMutation.mutateAsync({ 
          cardId: card.id, 
          data: { is_default: false } 
        });
      }
      return Promise.resolve();
    });

    // Execute all updates
    Promise.all(updatePromises).then(() => {
      // Refresh the cards data to reflect changes
      refetchCards();
    }).catch((error) => {
      console.error('Error updating default card:', error);
    });
  };

  const handleDownloadInvoice = (invoiceUrl: string) => {
    window.open(invoiceUrl, '_blank');
  };

  // Check for success query parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      toast({
        title: "Payment Successful!",
        description: "Your subscription has been activated.",
      });
      refetchSubscription();
      // Remove the success parameter from URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Get the appropriate plans based on billing toggle
  const plans = (plansData as any)?.plans || [];
  const filteredPlans = plans.filter((plan: any) => {
    // Skip free trial plan
    if (plan.id === 'free_trial') return false;
    return plan.is_yearly === showYearly;
  });

  // Group plans by tier for better presentation
  const basicPlan = filteredPlans.find((p: any) => p.id.includes('basic'));
  const proPlan = filteredPlans.find((p: any) => p.id.includes('pro'));
  const premiumPlan = filteredPlans.find((p: any) => p.id.includes('premium'));
  const orderedPlans = [basicPlan, proPlan, premiumPlan].filter(Boolean);

  const subscription = (currentSubscription as any)?.subscription;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <PageHeader
          title="Subscription Management"
          description="Manage your subscription, billing, and payment methods"
          primaryAction={
            subscription && !subscription.is_trial ? (
              <Button 
                onClick={handleManagePayment}
                disabled={createBillingPortalMutation.isPending}
                data-testid="button-manage-billing"
              >
                <Settings className="h-4 w-4 mr-2" />
                {createBillingPortalMutation.isPending ? "Loading..." : "Manage Billing"}
              </Button>
            ) : undefined
          }
        />

        {/* Tabs for different sections */}
        <Tabs defaultValue="overview" className="space-y-6" data-testid="tabs-subscription">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Receipt className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="plans" data-testid="tab-plans">
              <BarChart className="h-4 w-4 mr-2" />
              Plans
            </TabsTrigger>
            <TabsTrigger value="billing" data-testid="tab-billing">
              <CreditCard className="h-4 w-4 mr-2" />
              Billing
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6" data-testid="content-overview">
            {/* Error State for Overview */}
            {subscriptionLoading && !currentSubscription && (
              <div className="text-center py-8">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-muted rounded w-48 mx-auto"></div>
                  <div className="h-4 bg-muted rounded w-32 mx-auto"></div>
                </div>
              </div>
            )}
            
            {!subscriptionLoading && !currentSubscription && (
              <Alert data-testid="alert-subscription-error">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load subscription data. 
                  <Button 
                    variant="link" 
                    className="p-0 h-auto font-normal"
                    onClick={() => window.location.reload()}
                    data-testid="button-retry-subscription"
                  >
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {/* Current Subscription Status */}
            {subscription && (
              <div data-testid="section-subscription-status" className="space-y-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold">Current Subscription</h3>
                  <StatusBadge 
                    status={subscription.is_active ? "active" : subscription.is_trial ? "trial" : "inactive"}
                    data-testid="badge-subscription-status"
                  />
                </div>
                <SubscriptionStatus
                  subscription={{
                    ...subscription,
                    current_period_end: subscription.current_period_end || subscription.subscription_ends_at
                  }}
                  onCancel={() => setShowCancelDialog(true)}
                  onResume={handleResumeSubscription}
                  onManagePayment={handleManagePayment}
                  isProcessing={processingAction === 'cancel' || processingAction === 'resume'}
                />
              </div>
            )}

            {/* Payment Cards */}
            <div className="grid gap-4 md:grid-cols-1">
              <CardsManager
                cards={cardsArray || []}
                onAdd={handleAddCard}
                onDelete={handleDeleteCard}
                onSetDefault={handleSetDefaultCard}
                isProcessing={
                  createBillingPortalMutation.isPending ||
                  deleteCardMutation.isPending ||
                  updateCardMutation.isPending ||
                  cardsLoading
                }
              />

              {/* Usage Summary */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Current Usage</h3>
                <StatsGrid className="grid-cols-1 md:grid-cols-3">
                  <StatCard
                    title="Contacts Used"
                    value={`0 / ${subscription?.contacts_limit?.toLocaleString() || '1,000'}`}
                    description="Active contacts"
                    icon={<Users className="h-6 w-6 text-blue-600" />}
                    testId="stat-contacts-usage"
                  />
                  <StatCard
                    title="Campaigns Created"
                    value={`0 / ${subscription?.campaigns_limit?.toLocaleString() || '10'}`}
                    description="Total campaigns"
                    icon={<BarChart className="h-6 w-6 text-green-600" />}
                    testId="stat-campaigns-usage"
                  />
                  <StatCard
                    title="Emails Sent"
                    value="0"
                    description="This month"
                    icon={<Mail className="h-6 w-6 text-purple-600" />}
                    testId="stat-emails-usage"
                  />
                </StatsGrid>
              </div>
            </div>
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-6" data-testid="content-plans">
            {/* Error State for Plans */}
            {!plansLoading && (!plansData || orderedPlans.length === 0) && (
              <Alert data-testid="alert-plans-error">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load subscription plans. 
                  <Button 
                    variant="link" 
                    className="p-0 h-auto font-normal"
                    onClick={() => window.location.reload()}
                    data-testid="button-retry-plans"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refresh
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 py-4" data-testid="section-billing-toggle">
              <Label htmlFor="billing-toggle" className={!showYearly ? 'font-semibold' : 'text-muted-foreground'} data-testid="label-monthly">
                Monthly
              </Label>
              <Switch
                id="billing-toggle"
                checked={showYearly}
                onCheckedChange={setShowYearly}
                data-testid="switch-billing-toggle"
              />
              <Label htmlFor="billing-toggle" className={showYearly ? 'font-semibold' : 'text-muted-foreground'} data-testid="label-yearly">
                Yearly
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full" data-testid="badge-yearly-savings">
                  Save 17%
                </span>
              </Label>
            </div>

            {/* Plans Grid */}
            <div className="grid gap-6 md:grid-cols-3" data-testid="grid-subscription-plans">
              {plansLoading ? (
                // Loading skeleton
                [...Array(3)].map((_, i) => (
                  <div key={i} className="h-96 bg-muted rounded-lg animate-pulse" data-testid={`skeleton-plan-${i}`} />
                ))
              ) : (
                orderedPlans.map((plan: any) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    isCurrentPlan={subscription?.plan === plan.id}
                    isPopular={plan.id.includes('pro')}
                    onSelect={handleSelectPlan}
                    isProcessing={processingAction === plan.id || manageSubscriptionMutation.isPending}
                    processingPlanId={processingAction}
                  />
                ))
              )}
            </div>

            {/* Plan Comparison Grid */}
            <div className="mt-8" data-testid="section-plan-comparison">
              <h3 className="text-lg font-semibold mb-4 text-center">Plan Comparison</h3>
              <StatsGrid className="grid-cols-1 md:grid-cols-3">
                <StatCard
                  title="Basic Plan"
                  value={showYearly ? "$290/year" : "$29/month"}
                  description="Perfect for small teams"
                  icon={<Users className="h-6 w-6 text-blue-600" />}
                  testId="stat-basic-plan"
                  extra={
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <div>5,000 contacts</div>
                      <div>50 campaigns</div>
                      <div>Basic analytics</div>
                    </div>
                  }
                />
                <StatCard
                  title="Pro Plan"
                  value={showYearly ? "$790/year" : "$79/month"}
                  description="Most popular choice"
                  icon={<BarChart className="h-6 w-6 text-green-600" />}
                  testId="stat-pro-plan"
                  extra={
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <div>25,000 contacts</div>
                      <div>200 campaigns</div>
                      <div>Advanced analytics</div>
                      <div>Automation</div>
                    </div>
                  }
                />
                <StatCard
                  title="Premium Plan"
                  value={showYearly ? "$1,190/year" : "$119/month"}
                  description="Enterprise features"
                  icon={<Settings className="h-6 w-6 text-purple-600" />}
                  testId="stat-premium-plan"
                  extra={
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <div>Unlimited contacts</div>
                      <div>Unlimited campaigns</div>
                      <div>White-label options</div>
                      <div>Priority support</div>
                    </div>
                  }
                />
              </StatsGrid>
            </div>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6" data-testid="content-billing">
            {/* Error State for Billing */}
            {!billingLoading && !billingHistory && (
              <Alert data-testid="alert-billing-error">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load billing history. 
                  <Button 
                    variant="link" 
                    className="p-0 h-auto font-normal"
                    onClick={() => window.location.reload()}
                    data-testid="button-retry-billing"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refresh
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <div data-testid="section-billing-history">
              <BillingHistory
                payments={(billingHistory as any)?.items}
                isLoading={billingLoading}
                onDownloadInvoice={handleDownloadInvoice}
              />
            </div>

            <div data-testid="section-cards-manager">
              <CardsManager
                cards={cardsArray || []}
                onAdd={handleAddCard}
                onDelete={handleDeleteCard}
                onSetDefault={handleSetDefaultCard}
                isProcessing={
                  createBillingPortalMutation.isPending ||
                  deleteCardMutation.isPending ||
                  updateCardMutation.isPending ||
                  cardsLoading
                }
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Cancel Subscription Dialog */}
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog} data-testid="dialog-cancel-subscription">
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle data-testid="title-cancel-dialog">Cancel Subscription</AlertDialogTitle>
              <AlertDialogDescription data-testid="description-cancel-dialog">
                Are you sure you want to cancel your subscription? You'll continue to have access until the end of your current billing period.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-dialog-cancel">
                Keep Subscription
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleCancelSubscription}
                className="bg-red-600 hover:bg-red-700"
                data-testid="button-cancel-dialog-confirm"
                disabled={processingAction === 'cancel'}
              >
                {processingAction === 'cancel' ? 'Canceling...' : 'Yes, Cancel Subscription'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Card Modal */}
        <div data-testid="modal-add-card">
          <AddCardModal
            open={showAddCardModal}
            onOpenChange={setShowAddCardModal}
            onSuccess={() => {
              refetchCards();
              refetchSubscription();
            }}
            onRefetch={refetchCards}
          />
        </div>
      </div>
    </div>
  );
}