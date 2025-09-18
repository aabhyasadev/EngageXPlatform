import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Campaign, ContactGroup } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import CampaignModal from "@/components/campaigns/campaign-modal";

export default function Campaigns() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: contactGroups } = useQuery<ContactGroup[]>({
    queryKey: ["/api/contact-groups"],
  });

  const sendCampaignMutation = useMutation({
    mutationFn: async ({ campaignId, contactGroupIds }: { campaignId: string; contactGroupIds: string[] }) => {
      const response = await apiRequest("POST", `/api/campaigns/${campaignId}/send`, { contactGroupIds });
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Campaign Sent",
        description: `Successfully sent to ${result.sent} of ${result.total} contacts`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setShowSendModal(false);
      setSelectedCampaign(null);
      setSelectedGroups([]);
    },
    onError: (error) => {
      toast({
        title: "Send Failed",
        description: error.message || "Failed to send campaign",
        variant: "destructive",
      });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      await apiRequest("DELETE", `/api/campaigns/${campaignId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Campaign deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete campaign",
        variant: "destructive",
      });
    },
  });

  const filteredCampaigns = campaigns?.filter((campaign) =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.subject.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-800';
      case 'sending': return 'bg-blue-100 text-blue-800';
      case 'scheduled': return 'bg-yellow-100 text-yellow-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSendCampaign = (campaign: any) => {
    setSelectedCampaign(campaign);
    setShowSendModal(true);
  };

  const handleConfirmSend = () => {
    if (selectedCampaign) {
      sendCampaignMutation.mutate({
        campaignId: selectedCampaign.id,
        contactGroupIds: selectedGroups,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
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
          <h2 className="text-2xl font-semibold text-foreground">Campaigns</h2>
          <p className="text-sm text-muted-foreground">
            Create, manage, and track your email campaigns.
          </p>
        </div>
        <Button onClick={() => setShowCampaignModal(true)} data-testid="button-new-campaign">
          <i className="fas fa-plus mr-2"></i>
          New Campaign
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground" data-testid="text-total-campaigns">
              {campaigns?.length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Total Campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground" data-testid="text-draft-campaigns">
              {campaigns?.filter((c: any) => c.status === 'draft').length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Drafts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground" data-testid="text-sent-campaigns">
              {campaigns?.filter((c: any) => c.status === 'sent').length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground" data-testid="text-total-sent">
              {campaigns?.reduce((sum: number, c: any) => sum + (c.totalSent || 0), 0) || 0}
            </div>
            <p className="text-sm text-muted-foreground">Total Sent</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search campaigns by name or subject..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
          data-testid="input-search-campaigns"
        />
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Campaigns</CardTitle>
          <CardDescription>
            {filteredCampaigns.length} of {campaigns?.length || 0} campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Campaign</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Recipients</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Open Rate</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Click Rate</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Created</th>
                  <th className="text-right py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((campaign: any) => (
                  <tr key={campaign.id} className="border-b border-border last:border-0">
                    <td className="py-4">
                      <div>
                        <div className="font-medium text-foreground" data-testid={`text-campaign-name-${campaign.id}`}>
                          {campaign.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {campaign.subject}
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <Badge className={getStatusColor(campaign.status)}>
                        {campaign.status}
                      </Badge>
                    </td>
                    <td className="py-4 text-foreground">{campaign.totalSent || 0}</td>
                    <td className="py-4 text-foreground">
                      {campaign.totalSent > 0 ? `${((campaign.totalOpened / campaign.totalSent) * 100).toFixed(1)}%` : '-'}
                    </td>
                    <td className="py-4 text-foreground">
                      {campaign.totalSent > 0 ? `${((campaign.totalClicked / campaign.totalSent) * 100).toFixed(1)}%` : '-'}
                    </td>
                    <td className="py-4 text-foreground">
                      {formatDate(campaign.createdAt)}
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {campaign.status === 'draft' && (
                          <Button
                            size="sm"
                            onClick={() => handleSendCampaign(campaign)}
                            data-testid={`button-send-campaign-${campaign.id}`}
                          >
                            Send
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCampaignMutation.mutate(campaign.id)}
                          disabled={deleteCampaignMutation.isPending}
                          data-testid={`button-delete-campaign-${campaign.id}`}
                        >
                          <i className="fas fa-trash text-destructive"></i>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCampaigns.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      {searchTerm ? "No campaigns match your search." : "No campaigns yet. Create your first campaign to get started!"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Modal */}
      <CampaignModal open={showCampaignModal} onOpenChange={setShowCampaignModal} />

      {/* Send Campaign Modal */}
      <Dialog open={showSendModal} onOpenChange={setShowSendModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Campaign: <span className="font-medium">{selectedCampaign?.name}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Subject: <span className="font-medium">{selectedCampaign?.subject}</span>
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Select Contact Groups (optional)
              </label>
              <Select onValueChange={(value) => setSelectedGroups(value ? [value] : [])}>
                <SelectTrigger data-testid="select-contact-groups">
                  <SelectValue placeholder="All contacts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All contacts</SelectItem>
                  {contactGroups?.map((group: any) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowSendModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmSend}
                disabled={sendCampaignMutation.isPending}
                data-testid="button-confirm-send"
              >
                {sendCampaignMutation.isPending ? "Sending..." : "Send Campaign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
