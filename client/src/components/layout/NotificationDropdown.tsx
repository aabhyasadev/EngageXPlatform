import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  useNotifications,
  useMarkNotificationRead,
  getNotificationIcon,
  getNotificationColor,
  getNotificationMessage
} from "@/hooks/useNotifications";
import { Link } from "wouter";
import * as Icons from "lucide-react";

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { data, isLoading, error } = useNotifications(20, false);
  const markAsRead = useMarkNotificationRead();

  // Mark notifications as read when dropdown is opened
  useEffect(() => {
    if (isOpen && data?.unread_count && data.unread_count > 0) {
      const timer = setTimeout(() => {
        const unreadIds = data.notifications
          .filter(n => !n.is_read)
          .map(n => n.id);
        
        if (unreadIds.length > 0) {
          markAsRead.mutate({ notification_ids: unreadIds });
        }
      }, 2000); // Mark as read after 2 seconds

      return () => clearTimeout(timer);
    }
  }, [isOpen, data]);

  const handleNotificationClick = (notification: any) => {
    // Navigate based on notification type
    if (notification.type.includes('payment') || notification.type.includes('subscription')) {
      window.location.href = '/subscription';
    }
    setIsOpen(false);
  };

  const handleMarkAllRead = () => {
    markAsRead.mutate({ mark_all: true });
  };

  const unreadCount = data?.unread_count || 0;
  const notifications = data?.notifications || [];

  // Get the icon component dynamically
  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, any> = {
      'check-circle': Icons.CheckCircle,
      'x-circle': Icons.XCircle,
      'alert-circle': Icons.AlertCircle,
      'alert-triangle': Icons.AlertTriangle,
      'clock': Icons.Clock,
      'check': Icons.Check,
      'bell': Icons.Bell,
    };
    
    const IconComponent = iconMap[iconName] || Icons.Bell;
    return <IconComponent className="h-4 w-4" />;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center"
              variant="destructive"
              data-testid="badge-notification-count"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-xs"
              data-testid="button-mark-all-read"
            >
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {isLoading && (
            <div className="p-4 text-center text-muted-foreground">
              Loading notifications...
            </div>
          )}
          {error && (
            <div className="p-4 text-center text-destructive">
              Failed to load notifications
            </div>
          )}
          {!isLoading && !error && notifications.length === 0 && (
            <div className="p-4 text-center text-muted-foreground">
              No notifications
            </div>
          )}
          {notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className={cn(
                "flex items-start space-x-3 p-3 cursor-pointer",
                !notification.is_read && "bg-accent/50"
              )}
              onClick={() => handleNotificationClick(notification)}
              data-testid={`notification-item-${notification.id}`}
            >
              <div className={cn("mt-0.5", getNotificationColor(notification.type))}>
                {getIconComponent(getNotificationIcon(notification.type))}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">
                  {getNotificationMessage(notification)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(notification.created_at), 'MMM d, h:mm a')}
                </p>
              </div>
              {!notification.is_read && (
                <div className="h-2 w-2 bg-primary rounded-full mt-1.5" />
              )}
            </DropdownMenuItem>
          ))}
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings#notifications" className="w-full text-center">
            <Button variant="ghost" className="w-full" data-testid="button-view-all-notifications">
              View all notifications
            </Button>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}