import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const navigation = [
    { name: "Dashboard", href: "/", icon: "fas fa-tachometer-alt" },
    { name: "Contacts", href: "/contacts", icon: "fas fa-users" },
    { name: "Campaigns", href: "/campaigns", icon: "fas fa-paper-plane" },
    { name: "Templates", href: "/templates", icon: "fas fa-file-alt" },
    { name: "Domains", href: "/domains", icon: "fas fa-globe" },
    { name: "Analytics", href: "/analytics", icon: "fas fa-chart-bar" },
    { name: "Team", href: "/team", icon: "fas fa-user-cog" },
    { name: "Subscription", href: "/subscription", icon: "fas fa-credit-card" },
    { name: "Settings", href: "/settings", icon: "fas fa-cog" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <aside className="w-64 bg-card shadow-lg border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <i className="fas fa-envelope text-primary-foreground text-sm"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">EngageX</h1>
            <p className="text-xs text-muted-foreground" data-testid="text-organization-name">
              {user?.organization?.name || "Loading..."}
            </p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => (
          <Link 
            key={item.name} 
            href={item.href}
            className={`flex items-center space-x-3 px-3 py-2 rounded-md font-medium transition-colors ${
              isActive(item.href)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            data-testid={`link-${item.name.toLowerCase()}`}
          >
            <i className={`${item.icon} w-4`}></i>
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
      
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
            {user?.profileImageUrl ? (
              <img 
                src={user.profileImageUrl} 
                alt="Profile" 
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <i className="fas fa-user text-muted-foreground text-sm"></i>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate" data-testid="text-user-name">
              {user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user?.email || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate capitalize">
              {user?.role || "Member"}
            </p>
          </div>
          <button 
            className="text-muted-foreground hover:text-foreground"
            onClick={() => window.location.href = "/api/logout"}
            data-testid="button-user-menu"
          >
            <i className="fas fa-ellipsis-v text-sm"></i>
          </button>
        </div>
      </div>
    </aside>
  );
}
