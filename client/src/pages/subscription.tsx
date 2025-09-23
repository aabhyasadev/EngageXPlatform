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
import Card from '@/components/subscription/Card';
import AddCardModal from '@/components/subscription/AddCardModal';

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
    queryKey: ['/api/subscription/plans-detailed'],
  });

  // Fetch current subscription
  const { data: currentSubscription, isLoading: subscriptionLoading, refetch: refetchSubscription } = useQuery({
    queryKey: ['/api/subscription/current'],
  });

  // Fetch billing history
  const { data: billingHistory, isLoading: billingLoading } = useQuery({
    queryKey: ['/api/subscription/billing-history'],
    enabled: true, // Enable to fetch billing history
  });

  // Fetch cards
  const { data: cardsData, isLoading: cardsLoading, refetch: refetchCards } = useQuery({
    queryKey: ['/api/cards/'],
    enabled: true,
  });

  // Get default card - handle both paginated and non-paginated responses
  const cardsArray = cardsData?.results || cardsData || [];
  const defaultCard = cardsArray.find?.((card: any) => card.is_default);

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
      const response = await apiRequest('DELETE', `/api/cards/${cardId}/delete_card`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Card removed successfully",
      });
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
    const currentPlan = currentSubscription?.subscription?.plan;
    
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
    if (window.confirm(`Are you sure you want to remove this ${card.brand} ending in ${card.last4}?`)) {
      deleteCardMutation.mutate(card.id);
    }
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
  const plans = plansData?.plans || [];
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

  const subscription = currentSubscription?.subscription;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-subscription-title">
            Subscription Management
          </h1>
          <p className="text-muted-foreground">
            Manage your subscription, billing, and payment methods
          </p>
        </div>

        {/* Tabs for different sections */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="plans" data-testid="tab-plans">Plans</TabsTrigger>
            <TabsTrigger value="billing" data-testid="tab-billing">Billing</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Current Subscription Status */}
            {subscription && (
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
            )}

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card
                card={defaultCard}
                onUpdate={handleUpdateCard}
                onAdd={handleAddCard}
                onDelete={handleDeleteCard}
                isProcessing={
                  createBillingPortalMutation.isPending ||
                  deleteCardMutation.isPending ||
                  updateCardMutation.isPending ||
                  cardsLoading
                }
              />

              {/* Usage Summary */}
              <div className="bg-card border rounded-lg p-6 space-y-4">
                <h3 className="font-semibold text-lg">Current Usage</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Contacts</span>
                    <span className="font-medium" data-testid="text-contacts-usage">
                      0 / {subscription?.contacts_limit?.toLocaleString() || '1,000'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Campaigns</span>
                    <span className="font-medium" data-testid="text-campaigns-usage">
                      0 / {subscription?.campaigns_limit?.toLocaleString() || '10'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Emails Sent (This Month)</span>
                    <span className="font-medium" data-testid="text-emails-usage">0</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-6">
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 py-4">
              <Label htmlFor="billing-toggle" className={!showYearly ? 'font-semibold' : 'text-muted-foreground'}>
                Monthly
              </Label>
              <Switch
                id="billing-toggle"
                checked={showYearly}
                onCheckedChange={setShowYearly}
                data-testid="switch-billing-toggle"
              />
              <Label htmlFor="billing-toggle" className={showYearly ? 'font-semibold' : 'text-muted-foreground'}>
                Yearly
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  Save 17%
                </span>
              </Label>
            </div>

            {/* Plans Grid */}
            <div className="grid gap-6 md:grid-cols-3">
              {plansLoading ? (
                // Loading skeleton
                [...Array(3)].map((_, i) => (
                  <div key={i} className="h-96 bg-muted rounded-lg animate-pulse" />
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

            {/* Feature Comparison */}
            <div className="mt-8 text-center">
              <Button variant="link" className="text-primary">
                View detailed feature comparison →
              </Button>
            </div>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <BillingHistory
              payments={billingHistory?.items}
              isLoading={billingLoading}
              onDownloadInvoice={handleDownloadInvoice}
            />

            <Card
              card={subscription?.stripe_payment_method_id ? {
                id: 'demo-card',
                brand: 'Visa',
                last4: '4242',
                exp_month: 12,
                exp_year: 2025,
                is_default: true,
                stripe_payment_method_id: subscription.stripe_payment_method_id,
                created_at: '',
                updated_at: ''
              } : undefined}
              onUpdate={handleAddCard}
              onAdd={handleAddCard}
              onManageBilling={handleManagePayment}
              isProcessing={createBillingPortalMutation.isPending}
            />
          </TabsContent>
        </Tabs>

        {/* Cancel Subscription Dialog */}
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
              <AlertDialogDescription>
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
              >
                Yes, Cancel Subscription
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Card Modal */}
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
  );
}