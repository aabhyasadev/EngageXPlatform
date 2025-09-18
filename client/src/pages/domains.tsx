import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import DomainVerification from "@/components/domains/domain-verification";

export default function Domains() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<any>(null);
  const [newDomain, setNewDomain] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: domains, isLoading, error } = useQuery({
    queryKey: ["/api/domains"],
    retry: 3,
    staleTime: 30000,
  });

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
          <Button onClick={() => window.location.reload()}>Refresh</Button>
        </div>
      </div>
    );
  }

  const createDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      const response = await apiRequest("POST", "/api/domains", { domain });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Domain added successfully! Please verify DNS records.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      setShowAddModal(false);
      setNewDomain("");
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
      const response = await apiRequest("POST", `/api/domains/${domainId}/verify`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Domain verified successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
    },
    onError: (error) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Please check your DNS records and try again",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return 'fas fa-check-circle text-green-600';
      case 'pending': return 'fas fa-clock text-yellow-600';
      case 'failed': return 'fas fa-times-circle text-red-600';
      default: return 'fas fa-question-circle text-gray-600';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain) {
      toast({
        title: "Validation Error",
        description: "Domain is required",
        variant: "destructive",
      });
      return;
    }
    createDomainMutation.mutate(newDomain);
  };

  const handleShowVerification = (domain: any) => {
    setSelectedDomain(domain);
    setShowVerificationModal(true);
  };

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

  return (
    <div className="p-6 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Domains</h2>
          <p className="text-sm text-muted-foreground">
            Configure and verify your sending domains for maximum deliverability.
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} data-testid="button-add-domain">
          <i className="fas fa-plus mr-2"></i>
          Add Domain
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground" data-testid="text-total-domains">
              {(domains as any)?.length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Total Domains</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600" data-testid="text-verified-domains">
              {(domains as any)?.filter((d: any) => d.status === 'verified').length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending-domains">
              {(domains as any)?.filter((d: any) => d.status === 'pending').length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600" data-testid="text-failed-domains">
              {(domains as any)?.filter((d: any) => d.status === 'failed').length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

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
                <i className="fas fa-plus text-blue-600"></i>
              </div>
              <h4 className="font-semibold mb-2">1. Add Domain</h4>
              <p className="text-sm text-muted-foreground">Add your sending domain to get DNS records</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-cog text-purple-600"></i>
              </div>
              <h4 className="font-semibold mb-2">2. Configure DNS</h4>
              <p className="text-sm text-muted-foreground">Add DKIM, DMARC, and SPF records to your DNS</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-check text-green-600"></i>
              </div>
              <h4 className="font-semibold mb-2">3. Verify Domain</h4>
              <p className="text-sm text-muted-foreground">Click verify to check DNS configuration</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-paper-plane text-yellow-600"></i>
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
                    <Badge className={getStatusColor(domain.status)}>
                      {domain.status}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <i className={getStatusIcon(domain.status)}></i>
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
                    <i className="fas fa-cog mr-2"></i>
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
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-globe text-2xl text-muted-foreground"></i>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No domains configured</h3>
              <p className="text-muted-foreground mb-4">
                Add your first domain to start sending verified emails
              </p>
              <Button onClick={() => setShowAddModal(true)}>
                <i className="fas fa-plus mr-2"></i>
                Add Your First Domain
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Domain Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Domain</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="domain">Domain Name *</Label>
              <Input
                id="domain"
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="example.com"
                required
                data-testid="input-domain-name"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Enter your domain without 'https://' or 'www.'
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createDomainMutation.isPending} data-testid="button-save-domain">
                {createDomainMutation.isPending ? "Adding..." : "Add Domain"}
              </Button>
            </div>
          </form>
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
