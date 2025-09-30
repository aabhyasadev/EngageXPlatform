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

// Card brand detection utilities - CLIENT-SIDE ONLY for UX
const detectCardBrand = (cardNumber: string): string => {
  const cleanNumber = cardNumber.replace(/\D/g, '');
  
  if (cleanNumber.startsWith('4')) return 'Visa';
  if (cleanNumber.startsWith('5') || cleanNumber.startsWith('2')) {
    const firstFour = cleanNumber.substring(0, 4);
    if (cleanNumber.startsWith('5') || (parseInt(firstFour) >= 2221 && parseInt(firstFour) <= 2720)) {
      return 'Mastercard';
    }
  }
  if (cleanNumber.startsWith('34') || cleanNumber.startsWith('37')) return 'American Express';
  if (cleanNumber.startsWith('6011') || cleanNumber.startsWith('65') || cleanNumber.startsWith('644') || cleanNumber.startsWith('645') || cleanNumber.startsWith('646') || cleanNumber.startsWith('647') || cleanNumber.startsWith('648') || cleanNumber.startsWith('649')) {
    return 'Discover';
  }
  
  return 'Unknown';
};

const formatCardNumber = (value: string): string => {
  const cleanValue = value.replace(/\D/g, '');
  const groups = cleanValue.match(/.{1,4}/g);
  return groups ? groups.join(' ') : cleanValue;
};

const isValidLuhn = (cardNumber: string): boolean => {
  const cleanNumber = cardNumber.replace(/\D/g, '');
  if (cleanNumber.length < 13) return true; // Allow partial input
  
  let sum = 0;
  let isEven = false;
  
  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber[i]);
    
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

// SECURITY: No full card validation needed - only safe information collected

// Form validation schema - SECURE: Only collects safe card information
const cardSchema = z.object({
  // SECURITY: Card number is CLIENT-SIDE ONLY - never submitted to server
  cardNumber: z
    .string()
    .min(13, 'Please enter a valid card number')
    .max(19, 'Card number is too long')
    .refine((value) => {
      const cleanNumber = value.replace(/\D/g, '');
      return isValidLuhn(cleanNumber);
    }, 'Please enter a valid card number'),
  cardholderName: z
    .string()
    .min(2, 'Cardholder name must be at least 2 characters')
    .max(50, 'Cardholder name must be less than 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Cardholder name can only contain letters and spaces'),
  // Auto-populated from cardNumber - read-only
  last4: z
    .string()
    .min(4, 'Last 4 digits are required')
    .max(4, 'Last 4 digits must be exactly 4 characters')
    .regex(/^\d{4}$/, 'Last 4 digits must be numbers only'),
  // Auto-detected from cardNumber - read-only
  brand: z
    .string()
    .min(1, 'Card brand is required'),
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
      cardNumber: '', // CLIENT-SIDE ONLY
      cardholderName: '',
      last4: '',
      brand: '',
      expiryMonth: '',
      expiryYear: '',
      setAsDefault: true,
    },
  });

  // Auto-detect card brand and last4 when card number changes
  const handleCardNumberChange = (value: string) => {
    const cleanNumber = value.replace(/\D/g, '');
    
    // Update the card number field
    form.setValue('cardNumber', formatCardNumber(value));
    
    // Auto-detect brand
    const detectedBrand = detectCardBrand(cleanNumber);
    form.setValue('brand', detectedBrand);
    
    // Auto-populate last 4 digits
    if (cleanNumber.length >= 4) {
      const last4 = cleanNumber.slice(-4);
      form.setValue('last4', last4);
    }
  };

  const createCardMutation = useMutation({
    mutationFn: async (cardData: CardForm) => {
      setIsSubmitting(true);
      
      // SECURITY: Strip cardNumber - never send to server
      const { cardNumber, ...safeCardData } = cardData;
      
      // Send ONLY secure card details to backend (PCI compliant)
      const response = await apiRequest('POST', '/api/cards/', {
        cardholder_name: safeCardData.cardholderName,
        last4: safeCardData.last4,
        brand: safeCardData.brand,
        exp_month: parseInt(safeCardData.expiryMonth),
        exp_year: parseInt(safeCardData.expiryYear),
        set_as_default: safeCardData.setAsDefault
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
            Add a new payment card to your account. Only safe, non-sensitive information is collected.
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

            {/* Card Number - CLIENT-SIDE ONLY */}
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
                      value={field.value}
                      onChange={(e) => {
                        handleCardNumberChange(e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Auto-detected fields */}
            <div className="grid grid-cols-2 gap-3">
              {/* Auto-detected Last 4 Digits */}
              <FormField
                control={form.control}
                name="last4"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last 4 Digits</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="••••"
                        data-testid="input-last4"
                        disabled={true}
                        readOnly={true}
                        className="bg-muted"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Auto-detected Card Brand */}
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Card Brand</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Auto-detected"
                        data-testid="input-brand"
                        disabled={true}
                        readOnly={true}
                        className="bg-muted"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Expiry Date */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="expiryMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Month</FormLabel>
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
                    <FormLabel>Expiry Year</FormLabel>
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
                Only safe, non-sensitive information is collected for your security. 
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