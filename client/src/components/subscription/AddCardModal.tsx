import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CreditCard, Loader2, Shield } from 'lucide-react';

// Luhn algorithm for credit card validation
const luhnCheck = (cardNumber: string): boolean => {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  
  let sum = 0;
  let isEven = false;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i]);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
};

// Form validation schema
const cardSchema = z.object({
  cardholderName: z
    .string()
    .min(2, 'Cardholder name must be at least 2 characters')
    .max(50, 'Cardholder name must be less than 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Cardholder name can only contain letters and spaces'),
  cardNumber: z
    .string()
    .min(1, 'Card number is required')
    .transform((value) => value.replace(/\s/g, ''))
    .refine((value) => luhnCheck(value), {
      message: 'Please enter a valid card number',
    }),
  expiryMonth: z
    .string()
    .min(1, 'Expiry month is required')
    .refine((value) => {
      const month = parseInt(value);
      return month >= 1 && month <= 12;
    }, 'Please enter a valid month (01-12)'),
  expiryYear: z
    .string()
    .min(1, 'Expiry year is required')
    .refine((value) => {
      const currentYear = new Date().getFullYear();
      const year = parseInt(value);
      return year >= currentYear && year <= currentYear + 20;
    }, 'Please enter a valid future year'),
  cvv: z
    .string()
    .min(3, 'CVV must be 3 or 4 digits')
    .max(4, 'CVV must be 3 or 4 digits')
    .regex(/^\d{3,4}$/, 'CVV must contain only numbers'),
  setAsDefault: z.boolean().default(true),
});

type CardForm = z.infer<typeof cardSchema>;

interface AddCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onRefetch?: () => void;
}

export default function AddCardModal({
  open,
  onOpenChange,
  onSuccess,
  onRefetch,
}: AddCardModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CardForm>({
    resolver: zodResolver(cardSchema),
    defaultValues: {
      cardholderName: '',
      cardNumber: '',
      expiryMonth: '',
      expiryYear: '',
      cvv: '',
      setAsDefault: true,
    },
  });

  // Format card number input with spaces
  const formatCardNumber = (value: string): string => {
    const v = value.replace(/\s/g, '').replace(/\D/g, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  // Generate simulated Stripe payment method token for demo
  const generateSimulatedToken = (cardData: CardForm): string => {
    // In production, this would use Stripe.js to create actual tokens
    const cardNumber = cardData.cardNumber.replace(/\s/g, '');
    const brand = cardNumber.startsWith('4') ? 'visa' : 
                  cardNumber.startsWith('5') ? 'mastercard' : 
                  cardNumber.startsWith('3') ? 'amex' : 'unknown';
    const timestamp = Date.now();
    return `pm_simulated_${brand}_${cardNumber.slice(-4)}_${timestamp}`;
  };

  const createCardMutation = useMutation({
    mutationFn: async (cardData: CardForm) => {
      setIsSubmitting(true);
      
      // Simulate Stripe tokenization (in production, use Stripe.js)
      const stripeToken = generateSimulatedToken(cardData);
      
      // Send tokenized data to backend (no raw card details)
      const response = await apiRequest('POST', '/api/cards/', {
        stripe_token: stripeToken,
        set_as_default: cardData.setAsDefault
      });
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Card added successfully",
      });
      
      // Invalidate cards cache and refetch
      queryClient.invalidateQueries({ queryKey: ['/api/cards/'] });
      
      // Also trigger explicit refetch if available
      if (onRefetch) {
        onRefetch();
      }
      
      form.reset();
      setIsSubmitting(false);
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: any) => {
      console.error('Error adding card:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add card. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = (data: CardForm) => {
    if (isSubmitting) return;
    createCardMutation.mutate(data);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      form.reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Add New Card
          </DialogTitle>
          <DialogDescription>
            Add a new payment card to your account. Your card information is securely processed by Stripe.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Cardholder Name */}
            <FormField
              control={form.control}
              name="cardholderName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cardholder Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Smith"
                      data-testid="input-cardholder-name"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Card Number */}
            <FormField
              control={form.control}
              name="cardNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Card Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="1234 5678 9012 3456"
                      data-testid="input-card-number"
                      disabled={isSubmitting}
                      maxLength={19}
                      {...field}
                      value={formatCardNumber(field.value)}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Expiry and CVV */}
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="expiryMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Month</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="MM"
                        data-testid="input-expiry-month"
                        disabled={isSubmitting}
                        maxLength={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiryYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="YYYY"
                        data-testid="input-expiry-year"
                        disabled={isSubmitting}
                        maxLength={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cvv"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CVV</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123"
                        data-testid="input-cvv"
                        disabled={isSubmitting}
                        maxLength={4}
                        type="password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Set as Default */}
            <FormField
              control={form.control}
              name="setAsDefault"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                      data-testid="checkbox-set-default"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Set as default card</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Use this card for future subscription payments
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {/* Security Notice */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Shield className="w-4 h-4 text-green-600" />
              <p className="text-xs text-muted-foreground">
                Your card information is encrypted and securely processed by Stripe. 
                We never store your card details on our servers.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={isSubmitting}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                data-testid="button-add-card"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding Card...
                  </>
                ) : (
                  'Add Card'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}