import { Card as UICard, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Plus, Edit2, Shield } from 'lucide-react';

interface PaymentCard {
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

interface CardProps {
  card?: PaymentCard;
  onUpdate: (card: PaymentCard) => void;
  onAdd: () => void;
  onDelete?: (card: PaymentCard) => void;
  onManageBilling?: (card: PaymentCard) => void;
  isProcessing?: boolean;
}

export default function Card({
  card,
  onUpdate,
  onAdd,
  onDelete,
  onManageBilling,
  isProcessing
}: CardProps) {
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

  // Show empty state if no card
  const hasCard = card !== undefined;

  return (
    <UICard data-testid="card-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Card
            </CardTitle>
            <CardDescription>Manage your card for subscriptions</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>Secured by Stripe</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasCard && card ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-4">
                {getCardBrandIcon(card.brand)}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium" data-testid="text-card-details">
                      {card.brand} ending in {card.last4}
                    </p>
                    {card.is_default && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid="text-card-expiry">
                    Expires {formatExpiry(card.exp_month, card.exp_year)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onUpdate(card)}
                  disabled={isProcessing}
                  data-testid="button-update-card"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                {onDelete && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onDelete(card)}
                    disabled={isProcessing}
                    data-testid="button-delete-card"
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
                data-testid="button-add-card"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Card
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onManageBilling?.(card)}
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
            <p className="font-medium mb-1">No card on file</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add a card to start your subscription
            </p>
            <Button onClick={onAdd} disabled={isProcessing} data-testid="button-add-first-card">
              <Plus className="w-4 h-4 mr-2" />
              Add Card
            </Button>
          </div>
        )}
      </CardContent>
    </UICard>
  );
}