import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Contact } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { getQueryFn } from "@/lib/queryClient";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

export default function Contact() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // Debounce search term to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page when searching
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Transform snake_case from Django API to camelCase for frontend
  const transformContact = (contact: any): Contact => {
    return {
      id: contact.id,
      organizationId: contact.organization,
      email: contact.email,
      firstName: contact.first_name || '',
      lastName: contact.last_name || '',
      phone: contact.phone || '',
      language: contact.language || 'en',
      isSubscribed: contact.is_subscribed ?? true,
      unsubscribedAt: contact.unsubscribed_at,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at
    };
  };

  const { data: contactsResponse, isLoading } = useQuery<{
    results: Contact[];
    count: number;
    next: string | null;
    previous: string | null;
  }>({
    queryKey: ["/api/contacts/", { page: currentPage, page_size: pageSize, search: debouncedSearchTerm }],
    queryFn: getQueryFn({ on401: "returnNull" }), // Handle 401 gracefully instead of throwing
    enabled: isAuthenticated, // Only run when user is authenticated
    select: (data: any) => {
      if (!data) return { results: [], count: 0, next: null, previous: null };
      return {
        ...data,
        results: data.results ? data.results.map(transformContact) : []
      };
    }
  });
  
  const contacts = contactsResponse?.results || [];
  const totalCount = contactsResponse?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  if (isAuthLoading || (isAuthenticated && isLoading)) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-lg font-medium text-muted-foreground mb-2">Authentication Required</h2>
          <p className="text-sm text-muted-foreground">Please log in to view your contacts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Contact Directory</h2>
          <p className="text-sm text-muted-foreground">
            Browse your organization's contact directory with {totalCount} contacts total.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground" data-testid="text-total-contacts">
              {totalCount || 0}
            </div>
            <p className="text-sm text-muted-foreground">Total Contacts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground" data-testid="text-subscribed-contacts">
              {contacts?.filter((c: any) => c.isSubscribed).length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Subscribed (this page)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground" data-testid="text-unsubscribed-contacts">
              {contacts?.filter((c: any) => !c.isSubscribed).length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Unsubscribed (this page)</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search contacts by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-contacts"
          />
        </div>
      </div>

      {/* Contact Directory */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Directory</CardTitle>
          <CardDescription>
            Showing {contacts.length} of {totalCount} contacts
            {debouncedSearchTerm && ` (filtered by "${debouncedSearchTerm}")`}
            {user?.organization && ` for ${user.organization.name}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {debouncedSearchTerm ? "No contacts match your search." : "No contacts yet."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-4 font-medium text-muted-foreground">Name</th>
                      <th className="text-left py-4 font-medium text-muted-foreground">Email</th>
                      <th className="text-left py-4 font-medium text-muted-foreground">Phone</th>
                      <th className="text-left py-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-4 font-medium text-muted-foreground">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact: any) => (
                      <tr key={contact.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                        <td className="py-4">
                          <div className="font-medium text-foreground" data-testid={`text-contact-name-${contact.id}`}>
                            {contact.firstName} {contact.lastName}
                          </div>
                        </td>
                        <td className="py-4 text-foreground">{contact.email}</td>
                        <td className="py-4 text-foreground">{contact.phone || "-"}</td>
                        <td className="py-4">
                          <Badge variant={contact.isSubscribed ? "default" : "secondary"}>
                            {contact.isSubscribed ? "Subscribed" : "Unsubscribed"}
                          </Badge>
                        </td>
                        <td className="py-4 text-foreground">
                          {new Date(contact.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage <= 1}
                      data-testid="button-previous-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage >= totalPages}
                      data-testid="button-next-page"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}