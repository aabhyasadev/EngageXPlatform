import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Clock, CreditCard, Calendar, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';

interface SubscriptionStatusProps {
  subscription: {
    plan: string;
    plan_name: string;
    is_trial: boolean;
    trial_ends_at?: string;
    subscription_ends_at?: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean;
    is_active: boolean;
    is_expired: boolean;
    contacts_limit: number;
    campaigns_limit: number;
    stripe_subscription_id?: string;
  };
  onCancel: () => void;
  onResume: () => void;
  onManagePayment: () => void;
  isProcessing?: boolean;
}

export default function SubscriptionStatus({
  subscription,
  onCancel,
  onResume,
  onManagePayment,
  isProcessing
}: SubscriptionStatusProps) {
  const getTimeRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Expired';
    if (diffDays === 1) return '1 day remaining';
    return `${diffDays} days remaining`;
  };

  const getProgressPercentage = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const totalDays = subscription.is_trial ? 14 : 30;
    const start = new Date(end.getTime() - (totalDays * 24 * 60 * 60 * 1000));
    
    const totalTime = end.getTime() - start.getTime();
    const remainingTime = end.getTime() - now.getTime();
    
    return Math.max(0, Math.min(100, ((totalTime - remainingTime) / totalTime) * 100));
  };

  const getStatusBadge = () => {
    if (subscription.is_expired) {
      return <Badge variant="destructive" data-testid="badge-subscription-expired">Expired</Badge>;
    }
    if (subscription.cancel_at_period_end) {
      return <Badge variant="outline" className="border-orange-500 text-orange-600" data-testid="badge-subscription-canceling">Canceling</Badge>;
    }
    if (subscription.is_trial) {
      return <Badge variant="secondary" data-testid="badge-subscription-trial">Trial</Badge>;
    }
    if (subscription.is_active) {
      return <Badge className="bg-green-500" data-testid="badge-subscription-active">Active</Badge>;
    }
    return <Badge variant="outline" data-testid="badge-subscription-inactive">Inactive</Badge>;
  };

  const getStatusIcon = () => {
    if (subscription.is_expired) {
      return <AlertTriangle className="w-5 h-5 text-red-500" />;
    }
    if (subscription.cancel_at_period_end) {
      return <AlertTriangle className="w-5 h-5 text-orange-500" />;
    }
    if (subscription.is_active) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    return <Clock className="w-5 h-5 text-gray-500" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const endDate = subscription.trial_ends_at || subscription.subscription_ends_at || subscription.current_period_end;

  return (
    <Card className="w-full" data-testid="card-subscription-status">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <CardTitle className="text-xl" data-testid="text-subscription-plan-name">
                {subscription.plan_name}
              </CardTitle>
              <CardDescription className="mt-1">
                {subscription.is_trial 
                  ? 'Free trial with limited features' 
                  : `${subscription.contacts_limit.toLocaleString()} contacts · ${subscription.campaigns_limit.toLocaleString()} campaigns`}
              </CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {endDate && !subscription.is_expired && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium" data-testid="text-time-remaining">
                  {getTimeRemaining(endDate)}
                </span>
              </div>
              <span className="text-muted-foreground" data-testid="text-end-date">
                {subscription.is_trial ? 'Trial ends' : 'Renews'}: {formatDate(endDate)}
              </span>
            </div>
            <Progress 
              value={getProgressPercentage(endDate)} 
              className="h-2"
              data-testid="progress-subscription"
            />
          </div>
        )}

        {subscription.current_period_end && !subscription.is_trial && !subscription.is_expired && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium" data-testid="text-next-billing">Next billing date</p>
                <p className="text-muted-foreground">{formatDate(subscription.current_period_end)}</p>
              </div>
            </div>
            {subscription.plan.includes('monthly') && (
              <div className="text-right">
                <p className="text-sm font-medium" data-testid="text-billing-amount">
                  ${subscription.plan.includes('basic') ? '29' : subscription.plan.includes('pro') ? '79' : '149'}/mo
                </p>
              </div>
            )}
            {subscription.plan.includes('yearly') && (
              <div className="text-right">
                <p className="text-sm font-medium" data-testid="text-billing-amount">
                  ${subscription.plan.includes('basic') ? '290' : subscription.plan.includes('pro') ? '790' : '1490'}/yr
                </p>
              </div>
            )}
          </div>
        )}

        {subscription.cancel_at_period_end && (
          <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <p className="text-sm text-orange-800" data-testid="text-cancel-notice">
              Your subscription will be canceled at the end of the current billing period
            </p>
          </div>
        )}

        {subscription.is_expired && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-sm text-red-800" data-testid="text-expired-notice">
              Your subscription has expired. Please renew to continue using all features.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {subscription.stripe_subscription_id && !subscription.is_trial && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onManagePayment}
              disabled={isProcessing}
              data-testid="button-manage-payment"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Manage Payment Method
            </Button>
          )}
          
          {!subscription.is_trial && subscription.is_active && !subscription.cancel_at_period_end && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onCancel}
              disabled={isProcessing}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              data-testid="button-cancel-subscription"
            >
              Cancel Subscription
            </Button>
          )}
          
          {subscription.cancel_at_period_end && !subscription.is_expired && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onResume}
              disabled={isProcessing}
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
              data-testid="button-resume-subscription"
            >
              Resume Subscription
            </Button>
          )}

          {(subscription.is_expired || subscription.is_trial) && (
            <Button 
              size="sm"
              className="bg-gradient-to-r from-blue-600 to-blue-700"
              data-testid="button-upgrade-now"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Upgrade Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}