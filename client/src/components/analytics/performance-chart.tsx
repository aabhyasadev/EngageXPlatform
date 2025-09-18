import { useMemo } from "react";

interface PerformanceChartProps {
  campaigns?: any[];
  timeframe: string;
}

export default function PerformanceChart({ campaigns = [], timeframe }: PerformanceChartProps) {
  const chartData = useMemo(() => {
    if (!campaigns || campaigns.length === 0) {
      return [];
    }

    // Filter campaigns based on timeframe
    const now = new Date();
    const daysBack = parseInt(timeframe);
    const startDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));

    const filteredCampaigns = campaigns.filter(campaign => {
      const campaignDate = new Date(campaign.sentAt || campaign.createdAt);
      return campaignDate >= startDate;
    });

    // Group campaigns by date and calculate metrics
    const groupedData: { [key: string]: { sent: number; opened: number; clicked: number } } = {};

    filteredCampaigns.forEach(campaign => {
      const date = new Date(campaign.sentAt || campaign.createdAt).toISOString().split('T')[0];
      
      if (!groupedData[date]) {
        groupedData[date] = { sent: 0, opened: 0, clicked: 0 };
      }
      
      groupedData[date].sent += campaign.totalSent || 0;
      groupedData[date].opened += campaign.totalOpened || 0;
      groupedData[date].clicked += campaign.totalClicked || 0;
    });

    // Convert to array and sort by date
    return Object.entries(groupedData)
      .map(([date, data]) => ({
        date,
        ...data,
        openRate: data.sent > 0 ? (data.opened / data.sent) * 100 : 0,
        clickRate: data.sent > 0 ? (data.clicked / data.sent) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [campaigns, timeframe]);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <i className="fas fa-chart-line text-4xl mb-2"></i>
          <p>No campaign data available for this timeframe</p>
        </div>
      </div>
    );
  }

  const maxSent = Math.max(...chartData.map(d => d.sent));
  const maxRate = Math.max(...chartData.map(d => Math.max(d.openRate, d.clickRate)));

  return (
    <div className="h-64 w-full" data-testid="performance-chart">
      <div className="h-full relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground py-2">
          <span>{Math.round(maxRate)}%</span>
          <span>{Math.round(maxRate * 0.75)}%</span>
          <span>{Math.round(maxRate * 0.5)}%</span>
          <span>{Math.round(maxRate * 0.25)}%</span>
          <span>0%</span>
        </div>

        {/* Chart area */}
        <div className="ml-8 h-full">
          <svg viewBox="0 0 400 200" className="w-full h-full">
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((percentage, index) => (
              <line
                key={percentage}
                x1="0"
                y1={200 - (percentage * 2)}
                x2="400"
                y2={200 - (percentage * 2)}
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-border"
                opacity="0.3"
              />
            ))}

            {/* Data lines */}
            {chartData.length > 1 && (
              <>
                {/* Open rate line */}
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  points={chartData
                    .map((d, index) => 
                      `${(index / (chartData.length - 1)) * 400},${200 - (d.openRate * 2)}`
                    )
                    .join(' ')}
                />

                {/* Click rate line */}
                <polyline
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="2"
                  points={chartData
                    .map((d, index) => 
                      `${(index / (chartData.length - 1)) * 400},${200 - (d.clickRate * 2)}`
                    )
                    .join(' ')}
                />
              </>
            )}

            {/* Data points */}
            {chartData.map((d, index) => (
              <g key={d.date}>
                {/* Open rate point */}
                <circle
                  cx={(index / (chartData.length - 1)) * 400}
                  cy={200 - (d.openRate * 2)}
                  r="3"
                  fill="#3b82f6"
                  className="hover:r-4 transition-all cursor-pointer"
                />
                {/* Click rate point */}
                <circle
                  cx={(index / (chartData.length - 1)) * 400}
                  cy={200 - (d.clickRate * 2)}
                  r="3"
                  fill="#8b5cf6"
                  className="hover:r-4 transition-all cursor-pointer"
                />
              </g>
            ))}
          </svg>
        </div>

        {/* X-axis labels */}
        <div className="ml-8 flex justify-between text-xs text-muted-foreground mt-2">
          {chartData.map((d, index) => (
            <span key={d.date} className={index % 2 === 0 ? '' : 'hidden sm:inline'}>
              {new Date(d.date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              })}
            </span>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span className="text-muted-foreground">Open Rate</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
          <span className="text-muted-foreground">Click Rate</span>
        </div>
      </div>
    </div>
  );
}
