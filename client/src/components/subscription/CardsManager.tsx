import { useState } from 'react';
import { Card as UICard, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Plus, Edit2, Trash2, Shield, Star } from 'lucide-react';
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

interface PaymentCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
  cardholder_name: string;
  created_at: string;
  updated_at: string;
}

interface CardsManagerProps {
  cards: PaymentCard[];
  onAdd: () => void;
  onDelete: (card: PaymentCard) => void;
  onSetDefault?: (card: PaymentCard) => void;
  isProcessing?: boolean;
}

export default function CardsManager({
  cards,
  onAdd,
  onDelete,
  onSetDefault,
  isProcessing
}: CardsManagerProps) {
  const [cardToDelete, setCardToDelete] = useState<PaymentCard | null>(null);

  const getCardBrandIcon = (brand: string) => {
    const brandLower = brand.toLowerCase();
    
    if (brandLower.includes('visa')) {
      return (
        <div className="w-12 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-md flex items-center justify-center shadow-sm">
          <span className="text-white text-sm font-bold">VISA</span>
        </div>
      );
    }
    
    if (brandLower.includes('mastercard')) {
      return (
        <div className="w-12 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-md flex items-center justify-center shadow-sm">
          <span className="text-white text-sm font-bold">MC</span>
        </div>
      );
    }
    
    if (brandLower.includes('american express') || brandLower.includes('amex')) {
      return (
        <div className="w-12 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-md flex items-center justify-center shadow-sm">
          <span className="text-white text-xs font-bold">AMEX</span>
        </div>
      );
    }
    
    if (brandLower.includes('discover')) {
      return (
        <div className="w-12 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-md flex items-center justify-center shadow-sm">
          <span className="text-white text-xs font-bold">DISC</span>
        </div>
      );
    }
    
    return (
      <div className="w-12 h-8 bg-gradient-to-br from-gray-500 to-gray-600 rounded-md flex items-center justify-center shadow-sm">
        <CreditCard className="w-4 h-4 text-white" />
      </div>
    );
  };

  const formatExpiry = (month: number, year: number) => {
    const monthStr = month.toString().padStart(2, '0');
    const yearStr = year.toString().slice(-2);
    return `${monthStr}/${yearStr}`;
  };

  const handleDeleteClick = (card: PaymentCard) => {
    setCardToDelete(card);
  };

  const handleConfirmDelete = () => {
    if (cardToDelete) {
      onDelete(cardToDelete);
      setCardToDelete(null);
    }
  };

  return (
    <>
      <UICard data-testid="cards-manager">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Cards
              </CardTitle>
              <CardDescription>
                Manage your organization's payment methods
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4 text-green-600" />
              <span>Securely Encrypted</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {cards.length > 0 ? (
            <>
              {/* Cards Grid */}
              <div className="grid gap-4">
                {cards.map((card) => (
                  <div
                    key={card.id}
                    className={`group relative p-4 border rounded-lg transition-all duration-200 hover:shadow-md ${
                      card.is_default 
                        ? 'border-primary/20 bg-primary/5 ring-1 ring-primary/10' 
                        : 'border-border bg-card hover:border-border/60'
                    }`}
                    data-testid={`card-item-${card.id}`}
                  >
                    {/* Default Badge */}
                    {card.is_default && (
                      <div className="absolute -top-2 -right-2">
                        <Badge className="bg-primary text-primary-foreground shadow-sm">
                          <Star className="w-3 h-3 mr-1" />
                          Default
                        </Badge>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {getCardBrandIcon(card.brand)}
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-base" data-testid={`card-brand-${card.id}`}>
                              {card.brand}
                            </span>
                            <span className="text-muted-foreground">••••</span>
                            <span className="font-mono font-medium" data-testid={`card-last4-${card.id}`}>
                              {card.last4}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span data-testid={`card-expiry-${card.id}`}>
                              Expires {formatExpiry(card.exp_month, card.exp_year)}
                            </span>
                            {card.cardholder_name && (
                              <span data-testid={`card-holder-${card.id}`}>
                                {card.cardholder_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        {!card.is_default && onSetDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSetDefault(card)}
                            disabled={isProcessing}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`button-set-default-${card.id}`}
                          >
                            <Star className="w-4 h-4" />
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(card)}
                          disabled={isProcessing}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          data-testid={`button-delete-${card.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Card Button */}
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={onAdd}
                  disabled={isProcessing}
                  className="w-full h-12 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5"
                  data-testid="button-add-new-card"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add New Card
                </Button>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-lg mb-2" data-testid="text-no-cards-title">
                No payment cards on file
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Add a payment card to manage your subscription and billing
              </p>
              <Button 
                onClick={onAdd} 
                disabled={isProcessing}
                size="lg"
                data-testid="button-add-first-card"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Your First Card
              </Button>
            </div>
          )}

          {/* Security Notice */}
          <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg border">
            <Shield className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Secure & Compliant</p>
              <p className="text-xs text-muted-foreground">
                Your payment information is encrypted and stored securely. We only collect 
                safe, non-sensitive card information and never store full card numbers.
              </p>
            </div>
          </div>
        </CardContent>
      </UICard>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!cardToDelete} onOpenChange={() => setCardToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Payment Card</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this {cardToDelete?.brand} card ending in {cardToDelete?.last4}? 
              This action cannot be undone.
              {cardToDelete?.is_default && (
                <span className="block mt-2 text-orange-600">
                  This is your default card. You may want to set another card as default first.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Remove Card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}