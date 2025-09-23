import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Plus, Edit2, Shield } from 'lucide-react';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
  stripe_payment_method_id: string;
  created_at: string;
  updated_at: string;
}

interface PaymentMethodProps {
  paymentMethod?: PaymentMethod;
  onUpdate: (paymentMethod: PaymentMethod) => void;
  onAdd: () => void;
  onDelete?: (paymentMethod: PaymentMethod) => void;
  isProcessing?: boolean;
}

export default function PaymentMethod({
  paymentMethod,
  onUpdate,
  onAdd,
  onDelete,
  isProcessing
}: PaymentMethodProps) {
  const getCardBrandIcon = (brand: string) => {
    const brandLower = brand.toLowerCase();
    if (brandLower.includes('visa')) {
      return (
        <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded flex items-center justify-center">
          <span className="text-white text-xs font-bold">VISA</span>
        </div>
      );
    }
    if (brandLower.includes('mastercard')) {
      return (
        <div className="w-10 h-6 bg-gradient-to-r from-red-500 to-orange-500 rounded flex items-center justify-center">
          <span className="text-white text-xs font-bold">MC</span>
        </div>
      );
    }
    if (brandLower.includes('amex')) {
      return (
        <div className="w-10 h-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded flex items-center justify-center">
          <span className="text-white text-xs font-bold">AMEX</span>
        </div>
      );
    }
    return <CreditCard className="w-6 h-6 text-muted-foreground" />;
  };

  const formatExpiry = (month: number, year: number) => {
    const monthStr = month.toString().padStart(2, '0');
    const yearStr = year.toString().slice(-2);
    return `${monthStr}/${yearStr}`;
  };

  // Show empty state if no payment method
  const hasPaymentMethod = paymentMethod !== undefined;

  return (
    <Card data-testid="card-payment-method">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment Method
            </CardTitle>
            <CardDescription>Manage your payment method for subscriptions</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>Secured by Stripe</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasPaymentMethod && paymentMethod ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-4">
                {getCardBrandIcon(paymentMethod.brand)}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium" data-testid="text-card-details">
                      {paymentMethod.brand} ending in {paymentMethod.last4}
                    </p>
                    {paymentMethod.is_default && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid="text-card-expiry">
                    Expires {formatExpiry(paymentMethod.exp_month, paymentMethod.exp_year)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onUpdate(paymentMethod)}
                  disabled={isProcessing}
                  data-testid="button-update-payment"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                {onDelete && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onDelete(paymentMethod)}
                    disabled={isProcessing}
                    data-testid="button-delete-payment"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onAdd}
                disabled={isProcessing}
                className="w-full"
                data-testid="button-add-payment"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Card
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onUpdate(paymentMethod)}
                disabled={isProcessing}
                className="w-full"
                data-testid="button-manage-billing"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Manage Billing
              </Button>
            </div>

            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Your payment information is encrypted and securely processed by Stripe. 
                We never store your full card details.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium mb-1">No payment method on file</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add a payment method to start your subscription
            </p>
            <Button onClick={onAdd} disabled={isProcessing} data-testid="button-add-first-payment">
              <Plus className="w-4 h-4 mr-2" />
              Add Payment Method
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}