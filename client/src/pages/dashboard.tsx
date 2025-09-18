import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import CampaignModal from "@/components/campaigns/campaign-modal";

export default function Dashboard() {
  const [showCampaignModal, setShowCampaignModal] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["/api/campaigns"],
  });

  const { data: domains } = useQuery({
    queryKey: ["/api/domains"],
  });

  if (statsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-800';
      case 'sending': return 'bg-blue-100 text-blue-800';
      case 'scheduled': return 'bg-yellow-100 text-yellow-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="p-6 bg-background">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Dashboard</h2>
            <p className="text-sm text-muted-foreground">Welcome back! Here's what's happening with your campaigns.</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              onClick={() => setShowCampaignModal(true)}
              data-testid="button-new-campaign"
            >
              <i className="fas fa-plus mr-2"></i>
              New Campaign
            </Button>
            <div className="flex items-center space-x-2 bg-accent px-3 py-2 rounded-md">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-accent-foreground">Trial: 14 days left</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Contacts</p>
                <p className="text-3xl font-bold text-foreground" data-testid="text-total-contacts">
                  {stats?.totalContacts || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-users text-blue-600 text-xl"></i>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600">+12%</span>
              <span className="text-muted-foreground ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Campaigns</p>
                <p className="text-3xl font-bold text-foreground" data-testid="text-active-campaigns">
                  {stats?.activeCampaigns || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-paper-plane text-green-600 text-xl"></i>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600">+3</span>
              <span className="text-muted-foreground ml-1">this week</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Rate</p>
                <p className="text-3xl font-bold text-foreground" data-testid="text-open-rate">
                  {stats?.openRate ? `${stats.openRate.toFixed(1)}%` : '0%'}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-envelope-open text-yellow-600 text-xl"></i>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600">+2.1%</span>
              <span className="text-muted-foreground ml-1">from last week</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Click Rate</p>
                <p className="text-3xl font-bold text-foreground" data-testid="text-click-rate">
                  {stats?.clickRate ? `${stats.clickRate.toFixed(1)}%` : '0%'}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-mouse-pointer text-purple-600 text-xl"></i>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600">+0.8%</span>
              <span className="text-muted-foreground ml-1">from last week</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Recent Campaigns */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Campaigns</CardTitle>
              <CardDescription>Track performance of your latest campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              {campaignsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse h-16 bg-muted rounded"></div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Campaign</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Sent</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Open Rate</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Click Rate</th>
                        <th className="text-right py-3 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns?.slice(0, 5).map((campaign: any) => (
                        <tr key={campaign.id} className="border-b border-border last:border-0">
                          <td className="py-4">
                            <div>
                              <p className="font-medium text-foreground" data-testid={`text-campaign-name-${campaign.id}`}>
                                {campaign.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(campaign.createdAt)}
                              </p>
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
                          <td className="py-4 text-right">
                            <button className="text-muted-foreground hover:text-foreground" data-testid={`button-campaign-menu-${campaign.id}`}>
                              <i className="fas fa-ellipsis-h"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!campaigns || campaigns.length === 0) && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-muted-foreground">
                            No campaigns yet. Create your first campaign to get started!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4 text-center">
                <Button variant="ghost" className="text-primary hover:underline text-sm font-medium">
                  View All Campaigns
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Domain Status */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-between" 
                  onClick={() => setShowCampaignModal(true)}
                  data-testid="button-quick-create-campaign"
                >
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-plus text-primary"></i>
                    <span>Create Campaign</span>
                  </div>
                  <i className="fas fa-chevron-right text-muted-foreground"></i>
                </Button>
                <Button variant="outline" className="w-full justify-between" data-testid="button-quick-import-contacts">
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-upload text-primary"></i>
                    <span>Import Contacts</span>
                  </div>
                  <i className="fas fa-chevron-right text-muted-foreground"></i>
                </Button>
                <Button variant="outline" className="w-full justify-between" data-testid="button-quick-create-template">
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-file-alt text-primary"></i>
                    <span>Create Template</span>
                  </div>
                  <i className="fas fa-chevron-right text-muted-foreground"></i>
                </Button>
                <Button variant="outline" className="w-full justify-between" data-testid="button-quick-verify-domain">
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-globe text-primary"></i>
                    <span>Verify Domain</span>
                  </div>
                  <i className="fas fa-chevron-right text-muted-foreground"></i>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Domain Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {domains?.map((domain: any) => (
                  <div 
                    key={domain.id} 
                    className={`flex items-center justify-between p-3 rounded-md border ${
                      domain.status === 'verified' 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-yellow-50 border-yellow-200'
                    }`}
                    data-testid={`card-domain-${domain.id}`}
                  >
                    <div>
                      <p className="font-medium text-foreground">{domain.domain}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className={`w-2 h-2 rounded-full ${
                          domain.status === 'verified' ? 'bg-green-500' : 'bg-yellow-500'
                        }`}></div>
                        <span className={`text-sm ${
                          domain.status === 'verified' ? 'text-green-600' : 'text-yellow-600'
                        }`}>
                          {domain.status === 'verified' ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                    </div>
                    <i className={`fas ${
                      domain.status === 'verified' ? 'fa-check-circle text-green-600' : 'fa-clock text-yellow-600'
                    }`}></i>
                  </div>
                ))}
                {(!domains || domains.length === 0) && (
                  <div className="text-center py-4 text-muted-foreground">
                    No domains configured. Add a domain to start sending emails.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Campaign Modal */}
      <CampaignModal open={showCampaignModal} onOpenChange={setShowCampaignModal} />
    </div>
  );
}
