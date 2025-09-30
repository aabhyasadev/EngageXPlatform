import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Zap, Star, TrendingUp } from 'lucide-react';

interface PlanCardProps {
  plan: {
    id: string;
    name: string;
    price: number;
    stripe_price_id?: string;
    contacts_limit: number;
    campaigns_limit: number;
    features: string[];
    is_yearly: boolean;
    is_current?: boolean;
    billing_period?: string;
    savings?: string;
  };
  isCurrentPlan: boolean;
  isPopular?: boolean;
  onSelect: (planId: string) => void;
  isProcessing?: boolean;
  processingPlanId?: string | null;
}

export default function PlanCard({
  plan,
  isCurrentPlan,
  isPopular,
  onSelect,
  isProcessing,
  processingPlanId
}: PlanCardProps) {
  const formatPrice = (price: number, isYearly: boolean) => {
    if (isYearly) {
      const monthlyEquivalent = Math.round(price / 12);
      return {
        main: `$${price}`,
        period: '/year',
        equivalent: `$${monthlyEquivalent}/month`
      };
    }
    return {
      main: `$${price}`,
      period: '/month',
      equivalent: null
    };
  };

  const pricing = formatPrice(plan.price, plan.is_yearly);
  const isProcessingThisPlan = processingPlanId === plan.id;
  
  const getPlanIcon = () => {
    if (plan.name.toLowerCase().includes('premium')) {
      return <Star className="w-5 h-5" />;
    }
    if (plan.name.toLowerCase().includes('pro')) {
      return <Zap className="w-5 h-5" />;
    }
    return <TrendingUp className="w-5 h-5" />;
  };

  const getButtonText = () => {
    if (isCurrentPlan) return 'Current Plan';
    if (isProcessingThisPlan) return 'Processing...';
    
    // Check if this is an upgrade or downgrade
    const planLevel = plan.name.toLowerCase().includes('premium') ? 3 : 
                     plan.name.toLowerCase().includes('pro') ? 2 : 1;
    
    return 'Select Plan';
  };

  return (
    <Card 
      className={`relative h-full transition-all duration-200 ${
        isPopular ? 'border-primary shadow-lg scale-105' : ''
      } ${isCurrentPlan ? 'bg-accent/5 border-primary/50' : 'hover:border-primary/30'}`}
      data-testid={`card-plan-${plan.id}`}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
          <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1">
            <Star className="w-3 h-3 mr-1" />
            Most Popular
          </Badge>
        </div>
      )}
      
      {isCurrentPlan && (
        <div className="absolute -top-3 right-4 z-10">
          <Badge variant="secondary" className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Current
          </Badge>
        </div>
      )}

      {plan.savings && (
        <div className="absolute top-4 right-4">
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            {plan.savings}
          </Badge>
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-2 rounded-lg ${
            plan.name.toLowerCase().includes('premium') ? 'bg-purple-100 text-purple-600' :
            plan.name.toLowerCase().includes('pro') ? 'bg-blue-100 text-blue-600' :
            'bg-gray-100 text-gray-600'
          }`}>
            {getPlanIcon()}
          </div>
          <CardTitle className="text-xl" data-testid={`text-plan-name-${plan.id}`}>
            {plan.name.replace(' Monthly', '').replace(' Yearly', '')}
          </CardTitle>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold" data-testid={`text-plan-price-${plan.id}`}>
              {pricing.main}
            </span>
            <span className="text-muted-foreground">{pricing.period}</span>
          </div>
          {pricing.equivalent && (
            <p className="text-sm text-muted-foreground">
              billed as {pricing.equivalent}
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-grow">
        <div className="space-y-2 pb-4 border-b">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Contacts</span>
            <span className="font-semibold" data-testid={`text-contacts-limit-${plan.id}`}>
              {plan.contacts_limit.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Campaigns</span>
            <span className="font-semibold" data-testid={`text-campaigns-limit-${plan.id}`}>
              {plan.campaigns_limit.toLocaleString()}
            </span>
          </div>
        </div>

        <ul className="space-y-2.5">
          {plan.features.slice(0, 6).map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-muted-foreground leading-tight">{feature}</span>
            </li>
          ))}
        </ul>

        {plan.features.length > 6 && (
          <p className="text-sm text-muted-foreground text-center">
            + {plan.features.length - 6} more features
          </p>
        )}
      </CardContent>

      <CardFooter className="pt-4">
        <Button
          className={`w-full ${
            isCurrentPlan 
              ? 'bg-gray-100 text-gray-500 hover:bg-gray-100' 
              : isPopular 
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
              : ''
          }`}
          variant={isCurrentPlan ? "outline" : isPopular ? "default" : "default"}
          disabled={isCurrentPlan || isProcessing}
          onClick={() => onSelect(plan.id)}
          data-testid={`button-select-${plan.id}`}
        >
          {getButtonText()}
        </Button>
      </CardFooter>
    </Card>
  );
}