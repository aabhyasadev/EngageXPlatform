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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SkeletonHeader, SkeletonStatsCard, SkeletonSearchFilter, SkeletonTable } from "@/components/ui/skeleton";
import { Mail, TrendingUp, Users, Calendar, MoreVertical, Eye, Edit, Trash2, Send, Filter, Search } from "lucide-react";

export default function Campaigns() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

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

  const filteredCampaigns = campaigns?.filter((campaign) => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'sending': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'scheduled': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Mail className="h-4 w-4" />;
      case 'sending': return <TrendingUp className="h-4 w-4" />;
      case 'scheduled': return <Calendar className="h-4 w-4" />;
      case 'draft': return <Edit className="h-4 w-4" />;
      case 'failed': return <Trash2 className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
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
      <div className="p-6 bg-background">
        <SkeletonHeader />
        
        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <SkeletonStatsCard />
          <SkeletonStatsCard />
          <SkeletonStatsCard />
          <SkeletonStatsCard />
        </div>
        
        <SkeletonSearchFilter />
        <SkeletonTable rows={8} />
      </div>
    );
  }

  return (
    <div className="p-6 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Campaigns</h1>
          <p className="text-muted-foreground mt-2">
            Create, manage, and track your email campaigns with detailed analytics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setStatusFilter("all")}
                className={statusFilter === "all" ? "bg-muted" : ""}>
                All Campaigns
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("draft")}
                className={statusFilter === "draft" ? "bg-muted" : ""}>
                Drafts
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("scheduled")}
                className={statusFilter === "scheduled" ? "bg-muted" : ""}>
                Scheduled
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("sent")}
                className={statusFilter === "sent" ? "bg-muted" : ""}>
                Sent
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("failed")}
                className={statusFilter === "failed" ? "bg-muted" : ""}>
                Failed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setShowCampaignModal(true)} data-testid="button-new-campaign">
            <Mail className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="relative overflow-hidden border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground" data-testid="text-total-campaigns">
                  {campaigns?.length || 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Total Campaigns</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                <Mail className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-yellow-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground" data-testid="text-draft-campaigns">
                  {campaigns?.filter((c: any) => c.status === 'draft').length || 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Drafts</p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                <Edit className="h-6 w-6 text-yellow-600 dark:text-yellow-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground" data-testid="text-sent-campaigns">
                  {campaigns?.filter((c: any) => c.status === 'sent').length || 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Sent</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground" data-testid="text-total-sent">
                  {campaigns?.reduce((sum: number, c: any) => sum + (c.totalSent || 0), 0) || 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Total Recipients</p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
                <Users className="h-6 w-6 text-purple-600 dark:text-purple-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns by name or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-campaigns"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filteredCampaigns.length} of {campaigns?.length || 0} campaigns
          </span>
          {statusFilter !== "all" && (
            <Badge variant="secondary" className="capitalize">
              {statusFilter}
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-auto p-0 text-xs"
                onClick={() => setStatusFilter("all")}
              >
                ×
              </Button>
            </Badge>
          )}
        </div>
      </div>

      {/* Enhanced Campaigns Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Campaign Management</CardTitle>
              <CardDescription className="mt-1">
                Showing {filteredCampaigns.length} campaigns
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Campaign</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">Recipients</th>
                  <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">Performance</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Created</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((campaign: any, index: number) => (
                  <tr 
                    key={campaign.id} 
                    className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${
                      index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                    }`}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          {getStatusIcon(campaign.status)}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground" data-testid={`text-campaign-name-${campaign.id}`}>
                            {campaign.name}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {campaign.subject}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge className={`${getStatusColor(campaign.status)} flex items-center gap-1 w-fit`}>
                        {getStatusIcon(campaign.status)}
                        <span className="capitalize">{campaign.status}</span>
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="font-medium text-foreground">{campaign.totalSent || 0}</div>
                      <div className="text-xs text-muted-foreground">recipients</div>
                    </td>
                    <td className="py-4 px-4">
                      {campaign.totalSent > 0 ? (
                        <div className="text-center">
                          <div className="text-sm font-medium text-foreground">
                            {((campaign.totalOpened / campaign.totalSent) * 100).toFixed(1)}% opened
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {((campaign.totalClicked / campaign.totalSent) * 100).toFixed(1)}% clicked
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-sm text-muted-foreground">No data</div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-foreground">
                        {formatDate(campaign.createdAt)}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem className="flex items-center gap-2">
                              <Eye className="h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem className="flex items-center gap-2">
                              <Edit className="h-4 w-4" />
                              Edit Campaign
                            </DropdownMenuItem>
                            {campaign.status === 'draft' && (
                              <DropdownMenuItem 
                                onClick={() => handleSendCampaign(campaign)}
                                className="flex items-center gap-2"
                                data-testid={`button-send-campaign-${campaign.id}`}
                              >
                                <Send className="h-4 w-4" />
                                Send Now
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => deleteCampaignMutation.mutate(campaign.id)}
                              disabled={deleteCampaignMutation.isPending}
                              className="flex items-center gap-2 text-destructive focus:text-destructive"
                              data-testid={`button-delete-campaign-${campaign.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCampaigns.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="p-4 bg-muted rounded-full">
                          <Mail className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="text-muted-foreground">
                          {searchTerm || statusFilter !== "all" ? 
                            "No campaigns match your current filters." : 
                            "No campaigns yet. Create your first campaign to get started!"}
                        </div>
                        {!searchTerm && statusFilter === "all" && (
                          <Button onClick={() => setShowCampaignModal(true)} variant="outline">
                            <Mail className="h-4 w-4 mr-2" />
                            Create Your First Campaign
                          </Button>
                        )}
                      </div>
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
