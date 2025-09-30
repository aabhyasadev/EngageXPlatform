import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatusBadgeProps {
  status: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
  icon?: ReactNode;
  className?: string;
  testId?: string;
}

export function StatusBadge({ 
  status, 
  variant, 
  icon, 
  className, 
  testId 
}: StatusBadgeProps) {
  // Status color mappings for common use cases
  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'verified':
      case 'active':
      case 'completed':
      case 'success':
        return 'default' as const;
      case 'pending':
      case 'processing':
      case 'in_progress':
        return 'secondary' as const;
      case 'failed':
      case 'error':
      case 'cancelled':
      case 'expired':
        return 'destructive' as const;
      default:
        return 'outline' as const;
    }
  };

  const getStatusColors = (status: string) => {
    switch (status.toLowerCase()) {
      case 'verified':
      case 'active':
      case 'completed':
      case 'success':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'pending':
      case 'processing':
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      case 'failed':
      case 'error':
      case 'cancelled':
      case 'expired':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      case 'admin':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      case 'campaign_manager':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'analyst':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'editor':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const statusVariant = variant || getStatusVariant(status);
  const colorClasses = getStatusColors(status);

  return (
    <Badge 
      variant={statusVariant}
      className={cn(
        colorClasses,
        "font-medium capitalize",
        className
      )}
      data-testid={testId}
    >
      {icon && <span className="mr-1">{icon}</span>}
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

// Role-specific badge component
interface RoleBadgeProps {
  role: string;
  className?: string;
  testId?: string;
}

export function RoleBadge({ role, className, testId }: RoleBadgeProps) {
  return (
    <StatusBadge 
      status={role} 
      className={className} 
      testId={testId}
    />
  );
}