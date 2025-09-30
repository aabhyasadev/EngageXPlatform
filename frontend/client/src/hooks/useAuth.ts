import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

// User type based on the API response
interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  organizationId?: string;
  organization?: {
    id: string;
    name: string;
    industry?: string;
    employeesRange?: string;
    contactsRange?: string;
    trialEndsAt?: string;
  } | null;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
