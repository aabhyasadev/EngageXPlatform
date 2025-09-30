import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary" | "ghost" | "link";
    testId?: string;
    icon?: ReactNode;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary" | "ghost" | "link";
    testId?: string;
    icon?: ReactNode;
    disabled?: boolean;
  };
  children?: ReactNode;
}

export function PageHeader({
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col space-y-4 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground text-sm sm:text-base">
              {description}
            </p>
          )}
        </div>
        
        {(primaryAction || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-2">
            {secondaryAction && (
              <Button
                variant={secondaryAction.variant || "outline"}
                onClick={secondaryAction.onClick}
                data-testid={secondaryAction.testId}
                disabled={secondaryAction.disabled}
                className="w-full sm:w-auto"
              >
                {secondaryAction.icon && (
                  <span className="mr-2">{secondaryAction.icon}</span>
                )}
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button
                variant={primaryAction.variant || "default"}
                onClick={primaryAction.onClick}
                data-testid={primaryAction.testId}
                disabled={primaryAction.disabled}
                className="w-full sm:w-auto"
              >
                {primaryAction.icon && (
                  <span className="mr-2">{primaryAction.icon}</span>
                )}
                {primaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}