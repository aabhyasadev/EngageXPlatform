# Frontend Documentation

## Overview

The EngageX frontend is a modern React application built with TypeScript, providing a rich user interface for email marketing campaign management. The frontend communicates with the Django backend through an Express.js BFF (Backend for Frontend) layer.

## Tech Stack

- **Framework**: React 18
- **Language**: TypeScript 5.6
- **Build Tool**: Vite 5.4
- **Routing**: Wouter 3.3
- **State Management**: TanStack Query 5.x
- **UI Library**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS 3.4
- **Forms**: React Hook Form 7.x
- **Icons**: Lucide React
- **Rich Text Editor**: TipTap
- **Charts**: Recharts

## Project Structure

```
frontend/
├── client/                         # React application
│   ├── src/
│   │   ├── components/            # Reusable UI components
│   │   │   ├── ui/               # shadcn/ui components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   └── ...
│   │   │   ├── layout/           # Layout components
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── navbar.tsx
│   │   │   │   └── header.tsx
│   │   │   └── campaign/         # Domain-specific components
│   │   │       ├── campaign-card.tsx
│   │   │       ├── campaign-form.tsx
│   │   │       └── campaign-stats.tsx
│   │   ├── pages/                # Page components
│   │   │   ├── dashboard.tsx
│   │   │   ├── campaigns.tsx
│   │   │   ├── templates.tsx
│   │   │   ├── contacts.tsx
│   │   │   ├── analytics.tsx
│   │   │   ├── settings.tsx
│   │   │   └── billing.tsx
│   │   ├── hooks/                # Custom React hooks
│   │   │   ├── use-toast.ts
│   │   │   ├── use-campaigns.ts
│   │   │   ├── use-subscription.ts
│   │   │   └── use-organization.ts
│   │   ├── lib/                  # Utilities & helpers
│   │   │   ├── queryClient.ts   # TanStack Query setup
│   │   │   ├── utils.ts         # Utility functions
│   │   │   └── api.ts           # API client
│   │   ├── App.tsx               # Main app component
│   │   ├── index.tsx             # Entry point
│   │   └── index.css             # Global styles
│   └── index.html                # HTML template
├── server/                         # Express BFF layer
│   ├── index.ts                   # Server entry point
│   ├── routes.ts                  # API routes
│   ├── storage.ts                 # Storage interface
│   └── vite.ts                    # Vite dev server
├── shared/                         # Shared types
│   └── schema.ts                  # Database schema types
├── tsconfig.json                   # TypeScript config
├── tailwind.config.ts              # Tailwind config
├── postcss.config.js               # PostCSS config
├── vite.config.ts                  # Vite config
└── components.json                 # shadcn/ui config
```

## Routing

### Route Configuration

```typescript
// App.tsx
import { Route, Switch } from "wouter";

function App() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/campaigns" component={Campaigns} />
      <Route path="/campaigns/new" component={NewCampaign} />
      <Route path="/campaigns/:id" component={CampaignDetail} />
      <Route path="/templates" component={Templates} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/settings" component={Settings} />
      <Route path="/billing" component={Billing} />
      <Route component={NotFound} />
    </Switch>
  );
}
```

### Navigation

```typescript
import { Link, useLocation } from "wouter";

function Sidebar() {
  const [location] = useLocation();
  
  return (
    <nav>
      <Link href="/campaigns">
        <a className={location === "/campaigns" ? "active" : ""}>
          Campaigns
        </a>
      </Link>
      <Link href="/templates">
        <a>Templates</a>
      </Link>
    </nav>
  );
}
```

## State Management

### TanStack Query Setup

```typescript
// lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// API request helper
export async function apiRequest(url: string, options?: RequestInit) {
  const response = await fetch(`/api${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  
  return response.json();
}
```

### Data Fetching

```typescript
// hooks/use-campaigns.ts
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function useCampaigns() {
  return useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: () => apiRequest("/campaigns"),
  });
}

export function useCreateCampaign() {
  return useMutation({
    mutationFn: (data: CreateCampaignInput) =>
      apiRequest("/campaigns", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // Invalidate campaigns list
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
  });
}
```

### Using Hooks in Components

```typescript
function CampaignsList() {
  const { data: campaigns, isLoading } = useCampaigns();
  const createMutation = useCreateCampaign();
  
  if (isLoading) {
    return <Skeleton />;
  }
  
  return (
    <div>
      {campaigns?.map(campaign => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}
      <Button onClick={() => createMutation.mutate(newCampaign)}>
        Create Campaign
      </Button>
    </div>
  );
}
```

## Component Library

### UI Components (shadcn/ui)

All UI components are from shadcn/ui, built on Radix UI primitives:

```typescript
// components/ui/button.tsx
import { cn } from "@/lib/utils";

interface ButtonProps {
  variant?: "default" | "destructive" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  children: React.ReactNode;
}

export function Button({ variant = "default", size = "default", children }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium",
        variant === "default" && "bg-primary text-primary-foreground",
        size === "default" && "h-10 px-4 py-2"
      )}
    >
      {children}
    </button>
  );
}
```

### Layout Components

```typescript
// components/layout/sidebar.tsx
export function Sidebar() {
  const [location] = useLocation();
  
  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <h1 className="text-xl font-bold">EngageX</h1>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        <SidebarLink
          href="/campaigns"
          icon={<Mail />}
          active={location === "/campaigns"}
        >
          Campaigns
        </SidebarLink>
        {/* More links */}
      </nav>
    </div>
  );
}
```

### Form Components

```typescript
// components/campaign/campaign-form.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const campaignSchema = z.object({
  name: z.string().min(1, "Name is required"),
  subject: z.string().min(1, "Subject is required"),
  from_email: z.string().email("Invalid email"),
  template_id: z.number(),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

export function CampaignForm() {
  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: "",
      subject: "",
      from_email: "",
    },
  });
  
  const createMutation = useCreateCampaign();
  
  function onSubmit(data: CampaignFormData) {
    createMutation.mutate(data);
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Campaign Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating..." : "Create Campaign"}
        </Button>
      </form>
    </Form>
  );
}
```

## Pages

### Dashboard

```typescript
// pages/dashboard.tsx
export function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Contacts"
          value={stats?.total_contacts}
          icon={<Users />}
        />
        <StatCard
          title="Campaigns"
          value={stats?.total_campaigns}
          icon={<Mail />}
        />
        <StatCard
          title="Open Rate"
          value={`${(stats?.open_rate * 100).toFixed(1)}%`}
          icon={<TrendingUp />}
        />
        <StatCard
          title="Click Rate"
          value={`${(stats?.click_rate * 100).toFixed(1)}%`}
          icon={<MousePointer />}
        />
      </div>
      
      <RecentCampaigns campaigns={stats?.recent_campaigns} />
    </div>
  );
}
```

### Campaigns List

```typescript
// pages/campaigns.tsx
export function Campaigns() {
  const { data: campaigns, isLoading } = useCampaigns();
  const [, navigate] = useLocation();
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Campaigns</h1>
        <Button onClick={() => navigate("/campaigns/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campaigns?.map(campaign => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            onClick={() => navigate(`/campaigns/${campaign.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
```

### Template Editor

```typescript
// pages/template-editor.tsx
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export function TemplateEditor() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: "<p>Start writing your email template...</p>",
  });
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Button>
      </div>
      
      <EditorContent editor={editor} className="prose max-w-none" />
    </div>
  );
}
```

## Styling

### Tailwind CSS Configuration

```typescript
// tailwind.config.ts
export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "hsl(var(--primary))",
        secondary: "hsl(var(--secondary))",
        // ... other colors
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
```

### Global Styles

```css
/* index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  /* ... other CSS variables */
}

.dark {
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  /* ... dark mode colors */
}
```

### Component Styling

```typescript
// Using cn utility for conditional classes
import { cn } from "@/lib/utils";

<div className={cn(
  "rounded-lg border p-4",
  isActive && "border-primary bg-primary/10",
  isDisabled && "opacity-50 cursor-not-allowed"
)} />
```

## Custom Hooks

### useToast

```typescript
// hooks/use-toast.ts
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const toast = useCallback((props: ToastProps) => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { ...props, id }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);
  
  return { toast, toasts };
}

// Usage
const { toast } = useToast();
toast({
  title: "Campaign sent!",
  description: "Your campaign has been sent to 5,000 contacts.",
});
```

### useSubscription

```typescript
// hooks/use-subscription.ts
export function useSubscription() {
  const { data: subscription } = useQuery({
    queryKey: ["/api/subscription/current"],
  });
  
  const isFeatureAvailable = (feature: string) => {
    const plan = subscription?.plan;
    return FEATURE_MATRIX[plan]?.[feature] ?? false;
  };
  
  const getUsagePercentage = (resource: string) => {
    const usage = subscription?.usage[resource];
    const limit = subscription?.usage[`${resource}_limit`];
    return (usage / limit) * 100;
  };
  
  return {
    subscription,
    isFeatureAvailable,
    getUsagePercentage,
  };
}
```

## Performance Optimization

### Code Splitting

```typescript
// Lazy load heavy pages
import { lazy, Suspense } from "react";

const Analytics = lazy(() => import("./pages/analytics"));
const TemplateEditor = lazy(() => import("./pages/template-editor"));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Route path="/analytics" component={Analytics} />
      <Route path="/templates/:id/edit" component={TemplateEditor} />
    </Suspense>
  );
}
```

### Memoization

```typescript
import { memo, useMemo } from "react";

export const CampaignCard = memo(function CampaignCard({ campaign }) {
  const stats = useMemo(() => {
    return calculateCampaignStats(campaign);
  }, [campaign]);
  
  return <div>{/* render campaign */}</div>;
});
```

### Virtual Scrolling

```typescript
// For large lists
import { useVirtualizer } from "@tanstack/react-virtual";

export function ContactsList({ contacts }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: contacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  });
  
  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <ContactRow contact={contacts[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Testing

### Component Testing

```typescript
// __tests__/CampaignCard.test.tsx
import { render, screen } from "@testing-library/react";
import { CampaignCard } from "@/components/campaign/campaign-card";

test("renders campaign name", () => {
  const campaign = {
    id: 1,
    name: "Summer Sale",
    status: "sent",
  };
  
  render(<CampaignCard campaign={campaign} />);
  expect(screen.getByText("Summer Sale")).toBeInTheDocument();
});
```

### Hook Testing

```typescript
// __tests__/use-campaigns.test.ts
import { renderHook, waitFor } from "@testing-library/react";
import { useCampaigns } from "@/hooks/use-campaigns";

test("fetches campaigns", async () => {
  const { result } = renderHook(() => useCampaigns());
  
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(5);
});
```

## Build & Deployment

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

Outputs to `frontend/dist/public/`

### Environment Variables

```bash
# .env.local
VITE_API_URL=http://localhost:8001
VITE_STRIPE_PUBLIC_KEY=pk_test_xxx
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

## Best Practices

### 1. Type Safety
```typescript
// Always define types for API responses
interface Campaign {
  id: number;
  name: string;
  status: "draft" | "scheduled" | "sent";
}

// Use type inference where possible
const campaigns = useCampaigns(); // Type inferred from hook
```

### 2. Error Handling
```typescript
function CampaignsList() {
  const { data, isLoading, error } = useCampaigns();
  
  if (error) {
    return <ErrorMessage message={error.message} />;
  }
  
  // ... rest of component
}
```

### 3. Loading States
```typescript
function CampaignForm() {
  const mutation = useCreateCampaign();
  
  return (
    <Button disabled={mutation.isPending}>
      {mutation.isPending ? <Spinner /> : "Create"}
    </Button>
  );
}
```

### 4. Accessibility
```typescript
<Button
  data-testid="create-campaign-button"
  aria-label="Create new campaign"
  onClick={handleCreate}
>
  Create Campaign
</Button>
```

## Troubleshooting

### Common Issues

**Hot reload not working:**
```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

**Type errors:**
```bash
# Regenerate TypeScript config
npm run check
```

**Build failures:**
```bash
# Clear build artifacts
rm -rf frontend/dist
npm run build
```
