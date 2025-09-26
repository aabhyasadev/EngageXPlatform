import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/ui/page-header";
import { StatsGrid } from "@/components/ui/stats-grid";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FormModal } from "@/components/ui/form-modal";
import DomainVerification from "@/components/domains/domain-verification";
import { Plus, Settings, Globe, CheckCircle, Clock, XCircle, Eye } from "lucide-react";

const domainSchema = z.object({
  domain: z.string()
    .min(1, "Domain is required")
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/, "Enter a valid domain (e.g., example.com)")
});

type DomainFormData = z.infer<typeof domainSchema>;

export default function Domains() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<any>(null);
  
  const form = useForm<DomainFormData>({
    resolver: zodResolver(domainSchema),
    defaultValues: { domain: "" }
  });

  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: domains, isLoading, error } = useQuery({
    queryKey: ["/api/domains/"],
    retry: 3,
    staleTime: 30000,
  });

  const createDomainMutation = useMutation({
    mutationFn: async (data: DomainFormData) => {
      const response = await apiRequest("POST", "/api/domains/", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Domain added successfully! Please verify DNS records.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/domains/"] });
      setShowAddModal(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add domain",
        variant: "destructive",
      });
    },
  });

  const verifyDomainMutation = useMutation({
    mutationFn: async (domainId: string) => {
      const response = await apiRequest("POST", `/api/domains/${domainId}/verify/`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Domain verified successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/domains/"] });
    },
    onError: (error) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Please check your DNS records and try again",
        variant: "destructive",
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return CheckCircle;
      case 'pending': return Clock;
      case 'failed': return XCircle;
      default: return Eye;
    }
  };

  const onSubmit = (data: DomainFormData) => {
    createDomainMutation.mutate(data);
  };

  const handleShowVerification = (domain: any) => {
    setSelectedDomain(domain);
    setShowVerificationModal(true);
  };

  // Show error state if query failed
  if (error) {
    console.error("Domains query error:", error);
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Domains</h2>
          <p className="text-muted-foreground mb-4">
            There was an error loading your domains. Please try refreshing the page.
          </p>
          <Button onClick={() => window.location.reload()} data-testid="button-refresh-error">Refresh</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    {
      id: "total-domains",
      label: "Total Domains",
      value: (domains as any)?.length || 0,
      subtext: "All configured domains"
    },
    {
      id: "verified-domains", 
      label: "Verified",
      value: (domains as any)?.filter((d: any) => d.status === 'verified').length || 0,
      subtext: "Ready for sending",
      variant: "success" as const
    },
    {
      id: "pending-domains",
      label: "Pending", 
      value: (domains as any)?.filter((d: any) => d.status === 'pending').length || 0,
      subtext: "Awaiting verification",
      variant: "warning" as const
    },
    {
      id: "failed-domains",
      label: "Failed",
      value: (domains as any)?.filter((d: any) => d.status === 'failed').length || 0, 
      subtext: "Verification failed",
      variant: "error" as const
    }
  ];

  return (
    <div className="p-6 bg-background">
      <PageHeader
        title="Domain Management"
        description="Configure and verify your domains for email sending"
        primaryAction={{
          label: "Add Domain",
          onClick: () => setShowAddModal(true),
          icon: <Plus className="h-4 w-4" />,
          testId: "button-add-domain"
        }}
      />

      <StatsGrid stats={stats} className="mb-6" />

      {/* Setup Instructions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Domain Setup Instructions</CardTitle>
          <CardDescription>
            Follow these steps to verify your domain and improve email deliverability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Plus className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="font-semibold mb-2">1. Add Domain</h4>
              <p className="text-sm text-muted-foreground">Add your sending domain to get DNS records</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Settings className="h-6 w-6 text-purple-600" />
              </div>
              <h4 className="font-semibold mb-2">2. Configure DNS</h4>
              <p className="text-sm text-muted-foreground">Add DKIM, DMARC, and SPF records to your DNS</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="font-semibold mb-2">3. Verify Domain</h4>
              <p className="text-sm text-muted-foreground">Click verify to check DNS configuration</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Globe className="h-6 w-6 text-yellow-600" />
              </div>
              <h4 className="font-semibold mb-2">4. Start Sending</h4>
              <p className="text-sm text-muted-foreground">Use your verified domain in campaigns</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Domains List */}
      <div className="space-y-4">
        {(domains as any)?.map((domain: any) => (
          <Card key={domain.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-foreground" data-testid={`text-domain-name-${domain.id}`}>
                      {domain.domain}
                    </h3>
                    <StatusBadge status={domain.status} />
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    {(() => {
                      const IconComponent = getStatusIcon(domain.status);
                      return <IconComponent className="h-4 w-4" />;
                    })()}
                    <span>
                      {domain.status === 'verified' && domain.verifiedAt && 
                        `Verified on ${new Date(domain.verifiedAt).toLocaleDateString()}`
                      }
                      {domain.status === 'pending' && "Waiting for DNS verification"}
                      {domain.status === 'failed' && "DNS verification failed"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => handleShowVerification(domain)}
                    data-testid={`button-view-records-${domain.id}`}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    DNS Records
                  </Button>
                  {domain.status !== 'verified' && (
                    <Button
                      onClick={() => verifyDomainMutation.mutate(domain.id)}
                      disabled={verifyDomainMutation.isPending}
                      data-testid={`button-verify-domain-${domain.id}`}
                    >
                      {verifyDomainMutation.isPending ? "Verifying..." : "Verify"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!domains || (domains as any).length === 0) && (
          <EmptyState
            icon={Globe}
            title="No domains configured"
            description="Add your first domain to start sending verified emails"
            action={
              <Button onClick={() => setShowAddModal(true)} data-testid="button-empty-add-domain">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Domain
              </Button>
            }
          />
        )}
      </div>

      {/* Add Domain Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Domain</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domain Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="example.com"
                        data-testid="input-domain"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-sm text-muted-foreground">
                      Enter your domain without 'https://' or 'www.'
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} data-testid="button-cancel-add-domain">
                  Cancel
                </Button>
                <Button type="submit" disabled={createDomainMutation.isPending} data-testid="button-submit-domain">
                  {createDomainMutation.isPending ? "Adding..." : "Add Domain"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Domain Verification Modal */}
      {selectedDomain && (
        <DomainVerification
          domain={selectedDomain}
          open={showVerificationModal}
          onOpenChange={setShowVerificationModal}
        />
      )}
    </div>
  );
}
