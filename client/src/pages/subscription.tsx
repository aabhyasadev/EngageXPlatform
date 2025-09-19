import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, CreditCard, AlertTriangle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe with properly prefixed environment variables
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLIC_KEY || import.meta.env.VITE_TESTING_STRIPE_PUBLIC_KEY!
);

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  contacts_limit: number;
  campaigns_limit: number;
  features: string[];
  is_yearly: boolean;
}

interface CurrentSubscription {
  plan: string;
  plan_name: string;
  is_trial: boolean;
  trial_ends_at?: string;
  subscription_ends_at?: string;
  is_active: boolean;
  is_expired: boolean;
  contacts_limit: number;
  campaigns_limit: number;
  features: string[];
}

function PaymentForm({ clientSecret, onSuccess }: { clientSecret: string; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + '/subscription?success=true',
      },
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payment Successful",
        description: "Your subscription has been activated!",
      });
      onSuccess();
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="payment-form">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing}
        className="w-full"
        data-testid="button-complete-payment"
      >
        {isProcessing ? 'Processing...' : 'Complete Payment'}
      </Button>
    </form>
  );
}

export default function SubscriptionPage() {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [showYearly, setShowYearly] = useState(false);

  // Fetch available subscription plans
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['/api/subscription/plans'],
  });

  // Fetch current subscription
  const { data: currentSubscription, isLoading: subscriptionLoading, refetch: refetchSubscription } = useQuery<{ subscription: CurrentSubscription }>({
    queryKey: ['/api/subscription/current'],
  });

  // Create subscription mutation
  const createSubscriptionMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await apiRequest('POST', '/api/subscription/create', { plan_id: planId });
      return response.json();
    },
    onSuccess: (data) => {
      setClientSecret(data.client_secret);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create subscription",
        variant: "destructive",
      });
    },
  });

  // Cancel subscription mutation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/subscription/cancel');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Subscription Canceled",
        description: "Your subscription will end at the current billing period.",
      });
      refetchSubscription();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    },
  });

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    createSubscriptionMutation.mutate(planId);
  };

  const handlePaymentSuccess = () => {
    setClientSecret(null);
    setSelectedPlan(null);
    queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
    toast({
      title: "Success!",
      description: "Your subscription has been activated.",
    });
  };

  const formatPrice = (price: number, isYearly: boolean) => {
    if (isYearly) {
      const monthlyEquivalent = price / 12;
      return `$${price}/year ($${monthlyEquivalent.toFixed(0)}/month)`;
    }
    return `$${price}/month`;
  };

  const getTimeRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Expired';
    if (diffDays === 1) return '1 day remaining';
    return `${diffDays} days remaining`;
  };

  const getProgressPercentage = (endDate: string, isYearly = false) => {
    const end = new Date(endDate);
    const now = new Date();
    const totalDays = isYearly ? 365 : (currentSubscription?.subscription.is_trial ? 14 : 30);
    const start = new Date(end.getTime() - (totalDays * 24 * 60 * 60 * 1000));
    
    const totalTime = end.getTime() - start.getTime();
    const remainingTime = end.getTime() - now.getTime();
    
    return Math.max(0, Math.min(100, ((totalTime - remainingTime) / totalTime) * 100));
  };

  if (plansLoading || subscriptionLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-2">
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="h-4 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const plans: SubscriptionPlan[] = plansData?.plans || [];
  const filteredPlans = plans.filter(plan => plan.is_yearly === showYearly);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4" data-testid="text-subscription-title">Subscription Plans</h1>
        <p className="text-gray-600 mb-6">Choose the plan that best fits your email marketing needs</p>
        
        {/* Billing Toggle */}
        <div className="flex items-center justify-center space-x-4 mb-8">
          <span className={`${!showYearly ? 'font-semibold' : 'text-gray-500'}`}>Monthly</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowYearly(!showYearly)}
            data-testid="button-billing-toggle"
          >
            {showYearly ? 'Switch to Monthly' : 'Switch to Yearly'}
          </Button>
          <span className={`${showYearly ? 'font-semibold' : 'text-gray-500'}`}>
            Yearly <Badge variant="secondary" className="ml-1">Save 17%</Badge>
          </span>
        </div>
      </div>

      {/* Current Subscription Status */}
      {currentSubscription?.subscription && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Current Subscription
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold" data-testid="text-current-plan">
                    {currentSubscription.subscription.plan_name}
                  </h3>
                  {currentSubscription.subscription.is_trial && (
                    <Badge variant="outline">Trial</Badge>
                  )}
                  {currentSubscription.subscription.is_expired && (
                    <Badge variant="destructive">Expired</Badge>
                  )}
                  {currentSubscription.subscription.is_active && !currentSubscription.subscription.is_expired && (
                    <Badge variant="secondary">Active</Badge>
                  )}
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div>Contacts: {currentSubscription.subscription.contacts_limit.toLocaleString()}</div>
                  <div>Campaigns: {currentSubscription.subscription.campaigns_limit.toLocaleString()}</div>
                </div>

                {(currentSubscription.subscription.trial_ends_at || currentSubscription.subscription.subscription_ends_at) && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium" data-testid="text-time-remaining">
                        {getTimeRemaining(
                          currentSubscription.subscription.trial_ends_at || 
                          currentSubscription.subscription.subscription_ends_at!
                        )}
                      </span>
                    </div>
                    <Progress 
                      value={getProgressPercentage(
                        currentSubscription.subscription.trial_ends_at || 
                        currentSubscription.subscription.subscription_ends_at!,
                        !currentSubscription.subscription.is_trial
                      )} 
                      className="w-full"
                    />
                  </div>
                )}
              </div>
              
              <div className="flex flex-col justify-center">
                {!currentSubscription.subscription.is_trial && currentSubscription.subscription.is_active && (
                  <Button 
                    variant="outline" 
                    onClick={() => cancelSubscriptionMutation.mutate()}
                    disabled={cancelSubscriptionMutation.isPending}
                    data-testid="button-cancel-subscription"
                  >
                    {cancelSubscriptionMutation.isPending ? 'Canceling...' : 'Cancel Subscription'}
                  </Button>
                )}
                
                {(currentSubscription.subscription.is_expired || !currentSubscription.subscription.is_active) && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm">Subscription renewal required</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Form */}
      {clientSecret && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Complete Your Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentForm clientSecret={clientSecret} onSuccess={handlePaymentSuccess} />
            </Elements>
          </CardContent>
        </Card>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredPlans.map((plan) => {
          const isCurrentPlan = currentSubscription?.subscription.plan === plan.id;
          const isPopular = plan.id.includes('pro_');
          
          return (
            <Card 
              key={plan.id} 
              className={`relative ${isPopular ? 'border-blue-500 shadow-lg' : ''} ${isCurrentPlan ? 'bg-blue-50' : ''}`}
              data-testid={`card-plan-${plan.id}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-500">Most Popular</Badge>
                </div>
              )}
              
              {isCurrentPlan && (
                <div className="absolute -top-3 right-4">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Current
                  </Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle data-testid={`text-plan-name-${plan.id}`}>{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-2xl font-bold" data-testid={`text-plan-price-${plan.id}`}>
                    {formatPrice(plan.price, plan.is_yearly)}
                  </span>
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-2 mb-6">
                  <div className="text-sm">
                    <strong>{plan.contacts_limit.toLocaleString()}</strong> contacts
                  </div>
                  <div className="text-sm">
                    <strong>{plan.campaigns_limit.toLocaleString()}</strong> campaigns
                  </div>
                </div>

                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={isCurrentPlan ? "outline" : "default"}
                  disabled={isCurrentPlan || createSubscriptionMutation.isPending}
                  onClick={() => handleSelectPlan(plan.id)}
                  data-testid={`button-select-${plan.id}`}
                >
                  {isCurrentPlan 
                    ? 'Current Plan' 
                    : createSubscriptionMutation.isPending && selectedPlan === plan.id
                    ? 'Processing...'
                    : 'Select Plan'
                  }
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}