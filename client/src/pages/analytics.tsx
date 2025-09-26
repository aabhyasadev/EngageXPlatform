import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState, Suspense, lazy, startTransition } from "react";
import { Send, CheckCircle, Mail, MousePointer } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatsGrid, StatCard } from "@/components/ui/stats-grid";

// Lazy load the heavy chart component
const PerformanceChart = lazy(() => import("@/components/analytics/performance-chart"));

export default function Analytics() {
  const [timeframe, setTimeframe] = useState("30");

  // Handle timeframe changes with startTransition to avoid blocking UI
  const handleTimeframeChange = (newTimeframe: string) => {
    startTransition(() => {
      setTimeframe(newTimeframe);
    });
  };

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ["/api/dashboard/stats/", { timeframe }],
    staleTime: 2 * 60 * 1000, // 2 minutes for analytics data
    retry: 3,
  });

  const { data: campaigns, error: campaignsError } = useQuery({
    queryKey: ["/api/campaigns/", { timeframe }],
    staleTime: 5 * 60 * 1000, // 5 minutes for campaign list
    retry: 3,
  });

  const { data: analyticsEvents, error: eventsError } = useQuery({
    queryKey: ["/api/analytics/events/", { timeframe }],
    staleTime: 1 * 60 * 1000, // 1 minute for real-time analytics events
    retry: 3,
  });

  // Show error state if any query failed
  if (statsError || campaignsError || eventsError) {
    console.error("Analytics query error:", { statsError, campaignsError, eventsError });
    return (
      <div className="p-6">
        <div className="text-center" data-testid="container-analytics-error">
          <h2 className="text-xl font-semibold mb-2">Analytics</h2>
          <p className="text-muted-foreground mb-4">
            There was an error loading your analytics data. Please try refreshing the page.
          </p>
          <Button onClick={() => window.location.reload()} data-testid="button-refresh-analytics-error">
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  if (statsLoading) {
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

  const calculateDeliverability = () => {
    if (!Array.isArray(campaigns)) return 0;
    const totalSent = campaigns.reduce((sum: number, c: any) => sum + (c.totalSent || 0), 0) || 0;
    const totalBounced = campaigns.reduce((sum: number, c: any) => sum + (c.totalBounced || 0), 0) || 0;
    return totalSent > 0 ? ((totalSent - totalBounced) / totalSent) * 100 : 0;
  };

  const calculateUnsubscribeRate = () => {
    if (!Array.isArray(campaigns)) return 0;
    const totalSent = campaigns.reduce((sum: number, c: any) => sum + (c.totalSent || 0), 0) || 0;
    const totalUnsubscribed = campaigns.reduce((sum: number, c: any) => sum + (c.totalUnsubscribed || 0), 0) || 0;
    return totalSent > 0 ? (totalUnsubscribed / totalSent) * 100 : 0;
  };

  const getTopPerformingCampaigns = () => {
    if (!Array.isArray(campaigns)) return [];
    return campaigns
      .filter((c: any) => c.totalSent > 0)
      .sort((a: any, b: any) => {
        const aRate = (a.totalOpened / a.totalSent) * 100;
        const bRate = (b.totalOpened / b.totalSent) * 100;
        return bRate - aRate;
      })
      .slice(0, 5);
  };


  return (
    <div className="p-6 bg-background">
      <PageHeader
        title="Analytics"
        description="Track email campaign performance and engagement metrics"
      >
        {/* Timeframe selector */}
        <div className="flex justify-end">
          <Select value={timeframe} onValueChange={handleTimeframeChange}>
            <SelectTrigger className="w-48" data-testid="select-timeframe">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      <StatsGrid className="mb-8">
        <StatCard
          title="Total Sent"
          value={(stats as any)?.totalSent || 0}
          description="Emails delivered"
          icon={<Send className="h-6 w-6 text-primary" />}
          testId="stat-total-sent"
        />
        <StatCard
          title="Deliverability"
          value={`${calculateDeliverability().toFixed(1)}%`}
          description="Successfully delivered"
          icon={<CheckCircle className="h-6 w-6 text-green-600" />}
          testId="stat-deliverability"
        />
        <StatCard
          title="Open Rate"
          value={(stats as any)?.openRate ? `${(stats as any).openRate.toFixed(1)}%` : '0%'}
          description="Emails opened"
          icon={<Mail className="h-6 w-6 text-blue-600" />}
          testId="stat-open-rate"
        />
        <StatCard
          title="Click Rate"
          value={(stats as any)?.clickRate ? `${(stats as any).clickRate.toFixed(1)}%` : '0%'}
          description="Links clicked"
          icon={<MousePointer className="h-6 w-6 text-purple-600" />}
          testId="stat-click-rate"
        />
      </StatsGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
            <CardDescription>Email performance metrics over time</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={
              <div className="h-64 flex items-center justify-center">
                <div className="animate-pulse space-y-3 w-full">
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                  <div className="h-40 bg-muted rounded"></div>
                </div>
              </div>
            }>
              <PerformanceChart campaigns={Array.isArray(campaigns) ? campaigns : []} timeframe={timeframe} />
            </Suspense>
          </CardContent>
        </Card>

        {/* Detailed Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Metrics</CardTitle>
            <CardDescription>Breakdown of email performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email Deliverability</span>
                <span className="text-sm font-medium text-foreground">{calculateDeliverability().toFixed(1)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${calculateDeliverability()}%` }}
                ></div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Open Rate</span>
                <span className="text-sm font-medium text-foreground">{(stats as any)?.openRate?.toFixed(1) || 0}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: `${(stats as any)?.openRate || 0}%` }}
                ></div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Click Through Rate</span>
                <span className="text-sm font-medium text-foreground">{(stats as any)?.clickRate?.toFixed(1) || 0}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-purple-500 h-2 rounded-full" 
                  style={{ width: `${((stats as any)?.clickRate || 0) * 4}%` }}
                ></div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Unsubscribe Rate</span>
                <span className="text-sm font-medium text-foreground">{calculateUnsubscribeRate().toFixed(2)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full" 
                  style={{ width: `${calculateUnsubscribeRate() * 10}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Campaigns */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Campaigns</CardTitle>
          <CardDescription>Campaigns with the highest open rates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Campaign</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Sent</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Opened</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Clicked</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Open Rate</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Click Rate</th>
                </tr>
              </thead>
              <tbody>
                {getTopPerformingCampaigns().map((campaign: any) => (
                  <tr key={campaign.id} className="border-b border-border last:border-0" data-testid={`row-top-campaign-${campaign.id}`}>
                    <td className="py-4">
                      <div className="font-medium text-foreground" data-testid={`text-campaign-name-${campaign.id}`}>
                        {campaign.name}
                      </div>
                      <div className="text-sm text-muted-foreground" data-testid={`text-campaign-date-${campaign.id}`}>
                        {new Date(campaign.sentAt || campaign.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-4 text-foreground" data-testid={`text-campaign-sent-${campaign.id}`}>{campaign.totalSent}</td>
                    <td className="py-4 text-foreground" data-testid={`text-campaign-opened-${campaign.id}`}>{campaign.totalOpened}</td>
                    <td className="py-4 text-foreground" data-testid={`text-campaign-clicked-${campaign.id}`}>{campaign.totalClicked}</td>
                    <td className="py-4 text-foreground" data-testid={`text-campaign-open-rate-${campaign.id}`}>
                      {((campaign.totalOpened / campaign.totalSent) * 100).toFixed(1)}%
                    </td>
                    <td className="py-4 text-foreground" data-testid={`text-campaign-click-rate-${campaign.id}`}>
                      {((campaign.totalClicked / campaign.totalSent) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
                {getTopPerformingCampaigns().length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground" data-testid="text-no-campaigns">
                      No campaign data available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
