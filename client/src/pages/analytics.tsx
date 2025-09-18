import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import PerformanceChart from "@/components/analytics/performance-chart";

export default function Analytics() {
  const [timeframe, setTimeframe] = useState("30");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: campaigns } = useQuery({
    queryKey: ["/api/campaigns"],
  });

  const { data: analyticsEvents } = useQuery({
    queryKey: ["/api/analytics/events"],
  });

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
    const totalSent = campaigns?.reduce((sum: number, c: any) => sum + (c.totalSent || 0), 0) || 0;
    const totalBounced = campaigns?.reduce((sum: number, c: any) => sum + (c.totalBounced || 0), 0) || 0;
    return totalSent > 0 ? ((totalSent - totalBounced) / totalSent) * 100 : 0;
  };

  const calculateUnsubscribeRate = () => {
    const totalSent = campaigns?.reduce((sum: number, c: any) => sum + (c.totalSent || 0), 0) || 0;
    const totalUnsubscribed = campaigns?.reduce((sum: number, c: any) => sum + (c.totalUnsubscribed || 0), 0) || 0;
    return totalSent > 0 ? (totalUnsubscribed / totalSent) * 100 : 0;
  };

  const getTopPerformingCampaigns = () => {
    if (!campaigns) return [];
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Track performance and analyze campaign results.
          </p>
        </div>
        <Select value={timeframe} onValueChange={setTimeframe}>
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

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sent</p>
                <p className="text-3xl font-bold text-foreground" data-testid="text-total-sent">
                  {stats?.totalSent || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-paper-plane text-blue-600 text-xl"></i>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Deliverability</p>
                <p className="text-3xl font-bold text-foreground" data-testid="text-deliverability">
                  {calculateDeliverability().toFixed(1)}%
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-check-circle text-green-600 text-xl"></i>
              </div>
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
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
            <CardDescription>Email performance metrics over time</CardDescription>
          </CardHeader>
          <CardContent>
            <PerformanceChart campaigns={campaigns} timeframe={timeframe} />
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
                <span className="text-sm font-medium text-foreground">{stats?.openRate?.toFixed(1) || 0}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: `${stats?.openRate || 0}%` }}
                ></div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Click Through Rate</span>
                <span className="text-sm font-medium text-foreground">{stats?.clickRate?.toFixed(1) || 0}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-purple-500 h-2 rounded-full" 
                  style={{ width: `${(stats?.clickRate || 0) * 4}%` }}
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
                  <tr key={campaign.id} className="border-b border-border last:border-0">
                    <td className="py-4">
                      <div className="font-medium text-foreground" data-testid={`text-top-campaign-${campaign.id}`}>
                        {campaign.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(campaign.sentAt || campaign.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-4 text-foreground">{campaign.totalSent}</td>
                    <td className="py-4 text-foreground">{campaign.totalOpened}</td>
                    <td className="py-4 text-foreground">{campaign.totalClicked}</td>
                    <td className="py-4 text-foreground">
                      {((campaign.totalOpened / campaign.totalSent) * 100).toFixed(1)}%
                    </td>
                    <td className="py-4 text-foreground">
                      {((campaign.totalClicked / campaign.totalSent) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
                {getTopPerformingCampaigns().length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
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
