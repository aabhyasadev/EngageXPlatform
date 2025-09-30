import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';

interface SubscriptionStatus {
  subscription: {
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
  };
}

interface AccessCheck {
  has_access: boolean;
  is_expired: boolean;
  subscription_plan: string;
  upgrade_required: boolean;
}

export function useSubscription() {
  const { isAuthenticated } = useAuth();

  const { data, isLoading, error } = useQuery<SubscriptionStatus>({
    queryKey: ['/api/subscription/current'],
    enabled: isAuthenticated,
    retry: false,
  });

  const subscription = data?.subscription;

  return {
    subscription,
    isLoading,
    error,
    isTrialUser: subscription?.is_trial ?? false,
    isExpired: subscription?.is_expired ?? false,
    isActive: subscription?.is_active ?? false,
    hasAccess: subscription?.is_active && !subscription?.is_expired,
    planName: subscription?.plan_name ?? 'Unknown',
    contactsLimit: subscription?.contacts_limit ?? 0,
    campaignsLimit: subscription?.campaigns_limit ?? 0,
    daysRemaining: subscription ? getDaysRemaining(subscription) : 0,
  };
}

export function useSubscriptionAccess(feature?: string) {
  const { isAuthenticated } = useAuth();

  const { data, isLoading } = useQuery<AccessCheck>({
    queryKey: ['/api/subscription/check-access', feature],
    enabled: isAuthenticated,
    retry: false,
  });

  return {
    hasAccess: data?.has_access ?? false,
    isExpired: data?.is_expired ?? false,
    upgradeRequired: data?.upgrade_required ?? false,
    isLoading,
  };
}

function getDaysRemaining(subscription: SubscriptionStatus['subscription']): number {
  const endDate = subscription.trial_ends_at || subscription.subscription_ends_at;
  if (!endDate) return 0;

  const end = new Date(endDate);
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}