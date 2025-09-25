import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import CampaignModal from "@/components/campaigns/campaign-modal";

export default function Dashboard() {
  const [showCampaignModal, setShowCampaignModal] = useState(false);

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    retry: 3,
    staleTime: 30000,
  });

  const { data: campaigns, isLoading: campaignsLoading, error: campaignsError } = useQuery({
    queryKey: ["/api/campaigns/"],
    retry: 3,
    staleTime: 30000,
  });

  const { data: domains, error: domainsError } = useQuery({
    queryKey: ["/api/domains/"],
    retry: 3,
    staleTime: 30000,
  });

  // Show error state if any query failed
  if (statsError || campaignsError || domainsError) {
    console.error("Dashboard query errors:", { statsError, campaignsError, domainsError });
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Dashboard</h2>
          <p className="text-muted-foreground mb-4">
            There was an error loading your dashboard data. Please try refreshing the page.
          </p>
          <Button onClick={() => window.location.reload()}>Refresh</Button>
        </div>
      </div>
    );
  }

  if (statsLoading || campaignsLoading) {
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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Contacts</p>
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-2" data-testid="text-total-contacts">
                  {stats?.totalContacts?.toLocaleString() || 0}
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <i className="fas fa-users text-white text-xl"></i>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <div className="flex items-center bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                <i className="fas fa-arrow-up text-xs mr-1"></i>
                <span className="font-semibold">+12%</span>
              </div>
              <span className="text-muted-foreground ml-2">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-950 dark:to-green-900 border-emerald-200 dark:border-emerald-800 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Active Campaigns</p>
                <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100 mt-2" data-testid="text-active-campaigns">
                  {stats?.activeCampaigns || 0}
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                <i className="fas fa-paper-plane text-white text-xl"></i>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <div className="flex items-center bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                <i className="fas fa-arrow-up text-xs mr-1"></i>
                <span className="font-semibold">+3</span>
              </div>
              <span className="text-muted-foreground ml-2">this week</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-950 dark:to-amber-900 border-orange-200 dark:border-orange-800 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Open Rate</p>
                <p className="text-3xl font-bold text-orange-900 dark:text-orange-100 mt-2" data-testid="text-open-rate">
                  {stats?.openRate ? `${stats.openRate.toFixed(1)}%` : '0%'}
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                <i className="fas fa-envelope-open text-white text-xl"></i>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <div className="flex items-center bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                <i className="fas fa-arrow-up text-xs mr-1"></i>
                <span className="font-semibold">+2.1%</span>
              </div>
              <span className="text-muted-foreground ml-2">from last week</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-950 dark:to-violet-900 border-purple-200 dark:border-purple-800 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Click Rate</p>
                <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-2" data-testid="text-click-rate">
                  {stats?.clickRate ? `${stats.clickRate.toFixed(1)}%` : '0%'}
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
                <i className="fas fa-mouse-pointer text-white text-xl"></i>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <div className="flex items-center bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                <i className="fas fa-arrow-up text-xs mr-1"></i>
                <span className="font-semibold">+0.8%</span>
              </div>
              <span className="text-muted-foreground ml-2">from last week</span>
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
