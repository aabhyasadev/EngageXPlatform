import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileText, CreditCard } from 'lucide-react';

interface Payment {
  id: string;
  date: string;
  amount: number;
  status: 'succeeded' | 'failed' | 'pending';
  description: string;
  invoice_url?: string;
  payment_method?: {
    brand: string;
    last4: string;
  };
}

interface BillingHistoryProps {
  payments?: Payment[];
  isLoading?: boolean;
  onDownloadInvoice?: (invoiceUrl: string) => void;
}

export default function BillingHistory({
  payments = [],
  isLoading = false,
  onDownloadInvoice
}: BillingHistoryProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <Badge className="bg-green-100 text-green-700">Paid</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card data-testid="card-billing-history">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Billing History
          </CardTitle>
          <CardDescription>View your past payments and download invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!payments || payments.length === 0) {
    return (
      <Card data-testid="card-billing-history">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Billing History
          </CardTitle>
          <CardDescription>View your past payments and download invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No payment history yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your payment history will appear here after your first payment
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mock data for demonstration
  const mockPayments: Payment[] = payments.length === 0 ? [
    {
      id: '1',
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      amount: 79,
      status: 'succeeded',
      description: 'Pro Monthly - January 2025',
      invoice_url: '/invoice/1',
      payment_method: { brand: 'visa', last4: '4242' }
    },
    {
      id: '2',
      date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      amount: 79,
      status: 'succeeded',
      description: 'Pro Monthly - December 2024',
      invoice_url: '/invoice/2',
      payment_method: { brand: 'visa', last4: '4242' }
    },
    {
      id: '3',
      date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      amount: 79,
      status: 'succeeded',
      description: 'Pro Monthly - November 2024',
      invoice_url: '/invoice/3',
      payment_method: { brand: 'visa', last4: '4242' }
    }
  ] : payments;

  return (
    <Card data-testid="card-billing-history">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Billing History
        </CardTitle>
        <CardDescription>View your past payments and download invoices</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-center">Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockPayments.map((payment) => (
                <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                  <TableCell className="font-medium">
                    {formatDate(payment.date)}
                  </TableCell>
                  <TableCell>{payment.description}</TableCell>
                  <TableCell>
                    {payment.payment_method ? (
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          {payment.payment_method.brand} •••• {payment.payment_method.last4}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(payment.status)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAmount(payment.amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    {payment.invoice_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDownloadInvoice?.(payment.invoice_url!)}
                        data-testid={`button-download-invoice-${payment.id}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}