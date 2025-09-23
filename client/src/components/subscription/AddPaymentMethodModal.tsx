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
const paymentMethodSchema = z.object({
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

type PaymentMethodForm = z.infer<typeof paymentMethodSchema>;

interface AddPaymentMethodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function AddPaymentMethodModal({
  open,
  onOpenChange,
  onSuccess,
}: AddPaymentMethodModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PaymentMethodForm>({
    resolver: zodResolver(paymentMethodSchema),
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

  // Format expiry input as MM/YY
  const formatExpiry = (value: string): string => {
    const v = value.replace(/\D/g, '');
    if (v.length >= 2) {
      return `${v.substring(0, 2)}/${v.substring(2, 4)}`;
    }
    return v;
  };

  // Create payment method mutation
  const createPaymentMethodMutation = useMutation({
    mutationFn: async (data: PaymentMethodForm) => {
      setIsSubmitting(true);
      
      // Simulate Stripe tokenization process
      // In production, you would use Stripe.js to securely create a token or PaymentMethod
      // This is a demo implementation that simulates the secure flow
      const simulateStripeTokenization = async () => {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate a mock token that follows Stripe's token format
        return `tok_${Math.random().toString(36).substr(2, 24)}`;
      };
      
      try {
        // Simulate secure tokenization (in production this would be done by Stripe.js)
        const stripeToken = await simulateStripeTokenization();
        
        const response = await apiRequest('POST', '/api/payment-methods/create_payment_method', {
          stripe_token: stripeToken,
          set_as_default: data.setAsDefault,
        });
        return response.json();
      } catch (error) {
        throw new Error('Failed to process payment method');
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Payment method added successfully',
      });
      
      // Invalidate payment methods cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/payment-methods/'] });
      
      // Reset form and close modal
      form.reset();
      onOpenChange(false);
      onSuccess?.();
      setIsSubmitting(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add payment method',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = (data: PaymentMethodForm) => {
    createPaymentMethodMutation.mutate(data);
  };

  const isFormValid = form.formState.isValid && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-add-payment-method">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Add Payment Method
          </DialogTitle>
          <DialogDescription>
            Enter your card details to add a new payment method to your account.
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
                      maxLength={19}
                      data-testid="input-card-number"
                      {...field}
                      onChange={(e) => {
                        const formatted = formatCardNumber(e.target.value);
                        field.onChange(formatted);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Expiry and CVV Row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="expiryMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Month</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="MM"
                        maxLength={2}
                        data-testid="input-expiry-month"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          field.onChange(value);
                        }}
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
                    <FormLabel>Expiry Year</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="YYYY"
                        maxLength={4}
                        data-testid="input-expiry-year"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* CVV */}
            <FormField
              control={form.control}
              name="cvv"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CVV</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="123"
                      maxLength={4}
                      type="password"
                      data-testid="input-cvv"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      data-testid="checkbox-set-default"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Set as default payment method</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {/* Security Notice */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>Your payment information is encrypted and secured by Stripe</span>
            </div>

            {/* Development Notice */}
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <strong>Development Mode:</strong> This form simulates secure card processing. In production, 
              card details are tokenized by Stripe.js before reaching our servers.
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isFormValid}
                data-testid="button-save"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Payment Method
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}