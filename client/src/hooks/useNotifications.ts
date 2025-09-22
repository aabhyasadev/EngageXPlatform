import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Notification {
  id: string;
  type: string;
  channel: string;
  status: string;
  is_read: boolean;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, any>;
  error_message: string | null;
}

interface NotificationResponse {
  notifications: Notification[];
  total_count: number;
  unread_count: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export function useNotifications(limit: number = 20, unreadOnly: boolean = false) {
  const queryKey = ['/api/subscription/notifications', { limit, unreadOnly }];
  
  return useQuery<NotificationResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        unread_only: unreadOnly.toString(),
        channel: 'in_app'
      });
      
      const response = await fetch(`/api/subscription/notifications?${params}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { notification_ids?: string[], mark_all?: boolean }) => {
      return apiRequest('/api/subscription/mark-notification-read', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      // Invalidate notification queries to refresh the counts
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/notifications'] });
    }
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['/api/subscription/get-notification-preferences'],
    queryFn: async () => {
      const response = await fetch('/api/subscription/get-notification-preferences', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch notification preferences');
      }
      
      return response.json();
    }
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (preferences: Record<string, any>) => {
      return apiRequest('/api/subscription/notification-preferences', {
        method: 'POST',
        body: JSON.stringify({ preferences })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/get-notification-preferences'] });
    }
  });
}

// Helper function to get notification icon based on type
export function getNotificationIcon(type: string): string {
  const iconMap: Record<string, string> = {
    'trial_ending': 'clock',
    'trial_ended': 'alert-triangle',
    'subscription_renewed': 'check-circle',
    'subscription_canceled': 'x-circle',
    'payment_failed': 'alert-circle',
    'payment_succeeded': 'check',
    'limit_warning': 'alert-triangle',
    'limit_reached': 'alert-circle',
  };
  
  return iconMap[type] || 'bell';
}

// Helper function to get notification color based on type
export function getNotificationColor(type: string): string {
  const colorMap: Record<string, string> = {
    'trial_ending': 'text-yellow-600',
    'trial_ended': 'text-orange-600',
    'subscription_renewed': 'text-green-600',
    'subscription_canceled': 'text-red-600',
    'payment_failed': 'text-red-600',
    'payment_succeeded': 'text-green-600',
    'limit_warning': 'text-yellow-600',
    'limit_reached': 'text-red-600',
  };
  
  return colorMap[type] || 'text-gray-600';
}

// Helper function to format notification message
export function getNotificationMessage(notification: Notification): string {
  const { type, metadata } = notification;
  
  switch (type) {
    case 'trial_ending':
      return `Your trial expires in ${metadata.days_remaining} days`;
    case 'trial_ended':
      return 'Your free trial has ended';
    case 'subscription_renewed':
      return `Your ${metadata.plan_name || 'subscription'} has been renewed`;
    case 'subscription_canceled':
      return 'Your subscription has been canceled';
    case 'payment_failed':
      return `Payment failed: ${metadata.reason || 'Please update your payment method'}`;
    case 'payment_succeeded':
      return `Payment of $${metadata.amount} received`;
    case 'limit_warning':
      return `Approaching ${metadata.resource} limit (${metadata.percentage?.toFixed(0)}% used)`;
    case 'limit_reached':
      return `${metadata.resource} limit reached`;
    default:
      return 'New notification';
  }
}