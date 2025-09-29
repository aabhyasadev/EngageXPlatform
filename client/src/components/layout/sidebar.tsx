import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useRoutePrefetch } from "@/hooks/useRoutePrefetch";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import UserModal from "./user-modal";
import { NavigationItem, canAccessNavItem } from "@/lib/permissions";
import { 
  Home, 
  Users, 
  Send, 
  FileText, 
  Globe, 
  BarChart3, 
  UserCog, 
  CreditCard, 
  Settings,
  Mail,
  User,
  ChevronRight
} from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { subscription, isTrialUser, daysRemaining } = useSubscription();
  const { prefetchRoute } = useRoutePrefetch();
  const [showUserModal, setShowUserModal] = useState(false);

  // Define all navigation items with their required permissions
  const allNavigationItems: NavigationItem[] = [
    { 
      name: "Dashboard", 
      href: "/", 
      icon: Home, 
      permissions: ['dashboard'],
      description: "Overview of your email marketing activities"
    },
    { 
      name: "Contacts", 
      href: "/contacts", 
      icon: Users, 
      permissions: ['contacts:read'],
      description: "Manage your contact lists and segments"
    },
    { 
      name: "Campaigns", 
      href: "/campaigns", 
      icon: Send, 
      permissions: ['campaigns:read'],
      description: "Create and manage email campaigns"
    },
    { 
      name: "Templates", 
      href: "/templates", 
      icon: FileText, 
      permissions: ['templates:read'],
      description: "Design and manage email templates"
    },
    { 
      name: "Domains", 
      href: "/domains", 
      icon: Globe, 
      permissions: ['domains:read'],
      description: "Configure and verify sending domains"
    },
    { 
      name: "Analytics", 
      href: "/analytics", 
      icon: BarChart3, 
      permissions: ['analytics:read'],
      description: "Track campaign performance and insights"
    },
    { 
      name: "Team", 
      href: "/team", 
      icon: UserCog, 
      permissions: ['team:read'],
      description: "Manage team members and permissions"
    },
    { 
      name: "Subscription", 
      href: "/subscription", 
      icon: CreditCard, 
      permissions: ['subscription:read'],
      description: "View and manage your subscription plan"
    },
    { 
      name: "Settings", 
      href: "/settings", 
      icon: Settings, 
      permissions: ['settings:read'],
      description: "Configure organization settings"
    },
  ];

  // Filter navigation items based on user permissions
  const navigation = useMemo(() => {
    if (!user?.role) return [];
    
    return allNavigationItems.filter(item => 
      canAccessNavItem(user.role, item)
    );
  }, [user?.role]);

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  // Helper function to get route name for prefetching
  const getRouteNameFromHref = (href: string) => {
    const routeMap: Record<string, string> = {
      '/analytics': 'analytics',
      '/campaigns': 'campaigns',
      '/contacts': 'contacts',
      '/templates': 'templates',
      '/domains': 'domains',
      '/team': 'team',
      '/settings': 'settings',
      '/subscription': 'subscription',
    };
    return routeMap[href];
  };

  // Handle prefetch on hover
  const handleLinkHover = (href: string) => {
    const routeName = getRouteNameFromHref(href);
    if (routeName) {
      prefetchRoute(routeName);
    }
  };

  return (
    <aside className="w-64 bg-card shadow-lg border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Mail className="text-primary-foreground w-4 h-4" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">EngageX</h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground" data-testid="text-organization-name">
                {user?.organization?.name || "Loading..."}
              </p>
              {subscription && (
                <Badge 
                  variant={isTrialUser ? "secondary" : subscription.is_expired ? "destructive" : "default"}
                  className="text-xs px-1.5 py-0"
                  data-testid="badge-subscription-status"
                >
                  {isTrialUser 
                    ? `Trial (${daysRemaining}d)`
                    : subscription.is_expired 
                    ? "Expired"
                    : subscription.plan_name?.replace(' Monthly', '').replace(' Yearly', '')}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const IconComponent = item.icon;
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 rounded-md font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
              data-testid={`link-${item.name.toLowerCase()}`}
              onMouseEnter={() => handleLinkHover(item.href)}
              onFocus={() => handleLinkHover(item.href)}
            >
              <IconComponent className="w-4 h-4" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-border">
        <button
          className="flex items-center space-x-3 w-full p-2 rounded-lg hover:bg-accent transition-colors group"
          onClick={() => setShowUserModal(true)}
          data-testid="button-user-profile"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-sm">
            {user?.profileImageUrl ? (
              <img 
                src={user.profileImageUrl} 
                alt="Profile" 
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <User className="text-white w-4 h-4" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-foreground truncate" data-testid="text-user-name">
              {user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user?.email || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate capitalize">
              {user?.role || "Member"}
            </p>
          </div>
          <div className="text-muted-foreground group-hover:text-foreground transition-colors">
            <ChevronRight className="w-3 h-3" />
          </div>
        </button>
      </div>
      
      <UserModal open={showUserModal} onOpenChange={setShowUserModal} />
    </aside>
  );
}
