import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { NotificationDropdown } from "./NotificationDropdown";
import { useState } from "react";
import CampaignModal from "@/components/campaigns/campaign-modal";

export default function Header() {
  const [location] = useLocation();
  const [showCampaignModal, setShowCampaignModal] = useState(false);

  const getPageTitle = () => {
    switch (location) {
      case "/": return "Dashboard";
      case "/contacts": return "Contacts";
      case "/campaigns": return "Campaigns";
      case "/templates": return "Templates";
      case "/domains": return "Domains";
      case "/analytics": return "Analytics";
      case "/team": return "Team";
      case "/settings": return "Settings";
      default: return "Dashboard";
    }
  };

  const getPageDescription = () => {
    switch (location) {
      case "/": return "Welcome back! Here's what's happening with your campaigns.";
      case "/contacts": return "Manage your contact lists and groups for targeted campaigns.";
      case "/campaigns": return "Create, manage, and track your email campaigns.";
      case "/templates": return "Design and organize your email templates.";
      case "/domains": return "Configure and verify your sending domains.";
      case "/analytics": return "Track performance and analyze campaign results.";
      case "/team": return "Manage team members and their permissions.";
      case "/settings": return "Configure your organization settings and preferences.";
      default: return "Welcome back! Here's what's happening with your campaigns.";
    }
  };

  return (
    <header className="bg-card shadow-sm border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{getPageTitle()}</h2>
          <p className="text-sm text-muted-foreground">{getPageDescription()}</p>
        </div>
        <div className="flex items-center space-x-4">
          <NotificationDropdown />
          {location === "/" && (
            <>
              <Button 
                onClick={() => setShowCampaignModal(true)}
                data-testid="button-header-new-campaign"
              >
                <i className="fas fa-plus mr-2"></i>
                New Campaign
              </Button>
              <div className="flex items-center space-x-2 bg-accent px-3 py-2 rounded-md">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-accent-foreground">Trial: 14 days left</span>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Campaign Modal */}
      <CampaignModal open={showCampaignModal} onOpenChange={setShowCampaignModal} />
    </header>
  );
}
