import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Contact, ContactGroup } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { Eye, Edit, Trash2, Download, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ContactImport from "@/components/contacts/contact-import";
import ContactGroupsManager from "@/components/contacts/contact-groups-manager";

export default function Contacts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newContact, setNewContact] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    language: "en",
  });
  const [editContact, setEditContact] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    language: "en",
  });
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showBulkGroupModal, setShowBulkGroupModal] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
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

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Transform snake_case from Django API to camelCase for frontend
  const transformContact = (contact: any): Contact => {
    console.log("Transforming contact:", contact);
    const transformed = {
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
    console.log("Transformed to:", transformed);
    return transformed;
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
      console.log("Raw API response:", data);
      const transformed = {
        ...data,
        results: data.results ? data.results.map(transformContact) : []
      };
      console.log("Transformed data:", transformed);
      return transformed;
    }
  });
  
  const contacts = contactsResponse?.results || [];
  const totalCount = contactsResponse?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const { data: contactGroups } = useQuery<ContactGroup[]>({
    queryKey: ["/api/contact-groups/"],
    queryFn: getQueryFn({ on401: "returnNull" }), // Handle 401 gracefully
    enabled: isAuthenticated, // Only run when user is authenticated
  });

  // Contact group memberships - temporarily disabled as backend endpoint needs implementation
  const contactGroupMemberships: ContactGroup[] = [];
  const isLoadingGroupMemberships = false;
  const isErrorGroupMemberships = false;

  const createContactMutation = useMutation({
    mutationFn: async (contactData: any) => {
      // Transform camelCase to snake_case for Django API
      const apiData = {
        first_name: contactData.firstName || '',
        last_name: contactData.lastName || '',
        email: contactData.email,
        phone: contactData.phone || '',
        language: contactData.language || 'en',
        is_subscribed: contactData.isSubscribed ?? true
      };
      const response = await apiRequest("POST", "/api/contacts/", apiData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact created successfully!",
      });
      // Invalidate all contact queries regardless of pagination/search params
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === "/api/contacts/";
        }
      });
      setShowAddModal(false);
      setNewContact({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        language: "en",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create contact",
        variant: "destructive",
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, contactData }: { contactId: string; contactData: any }) => {
      // Transform camelCase to snake_case for Django API
      const apiData = {
        first_name: contactData.firstName || '',
        last_name: contactData.lastName || '',
        email: contactData.email,
        phone: contactData.phone || '',
        language: contactData.language || 'en',
        is_subscribed: contactData.isSubscribed ?? true
      };
      const response = await apiRequest("PUT", `/api/contacts/${contactId}/`, apiData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact updated successfully!",
      });
      // Invalidate all contact queries regardless of pagination/search params
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === "/api/contacts/";
        }
      });
      setShowEditModal(false);
      setSelectedContact(null);
      setEditContact({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        language: "en",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      await apiRequest("DELETE", `/api/contacts/${contactId}/`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact deleted successfully!",
      });
      // Invalidate all contact queries regardless of pagination/search params
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === "/api/contacts/";
        }
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      const promises = contactIds.map(id => 
        apiRequest("DELETE", `/api/contacts/${id}/`)
      );
      await Promise.all(promises);
    },
    onSuccess: (_, contactIds) => {
      toast({
        title: "Success",
        description: `${contactIds.length} contact${contactIds.length !== 1 ? 's' : ''} deleted successfully!`,
      });
      // Invalidate all contact queries regardless of pagination/search params
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === "/api/contacts/";
        }
      });
      clearSelection();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contacts",
        variant: "destructive",
      });
    },
  });

  const bulkGroupAssignmentMutation = useMutation({
    mutationFn: async ({ groupIds, contactIds }: { groupIds: string[]; contactIds: string[] }) => {
      const promises = groupIds.map(groupId => 
        apiRequest("POST", `/api/contact-groups/${groupId}/add_contacts/`, { contact_ids: contactIds })
      );
      await Promise.all(promises);
    },
    onSuccess: (_, { groupIds, contactIds }) => {
      toast({
        title: "Success",
        description: `${contactIds.length} contact${contactIds.length !== 1 ? 's' : ''} assigned to ${groupIds.length} group${groupIds.length !== 1 ? 's' : ''} successfully!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] });
      setShowBulkGroupModal(false);
      setSelectedGroupIds(new Set());
      clearSelection();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign contacts to groups",
        variant: "destructive",
      });
    },
  });

  // Contacts are now filtered server-side, so we use the results directly
  const filteredContacts = contacts;

  const handleViewDetails = (contact: Contact) => {
    setSelectedContact(contact);
    setShowDetailsModal(true);
  };

  // Bulk selection functions
  const handleContactSelection = (contactId: string, checked: boolean) => {
    const newSelection = new Set(selectedContactIds);
    if (checked) {
      newSelection.add(contactId);
    } else {
      newSelection.delete(contactId);
    }
    setSelectedContactIds(newSelection);
    setShowBulkActions(newSelection.size > 0);
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelection = new Set(selectedContactIds);
    const filteredIds = filteredContacts.map(contact => contact.id);
    
    if (checked) {
      // Add all filtered contact IDs to selection
      filteredIds.forEach(id => newSelection.add(id));
    } else {
      // Remove all filtered contact IDs from selection
      filteredIds.forEach(id => newSelection.delete(id));
    }
    
    setSelectedContactIds(newSelection);
    setShowBulkActions(newSelection.size > 0);
  };

  const clearSelection = () => {
    setSelectedContactIds(new Set());
    setShowBulkActions(false);
  };

  const handleBulkDelete = () => {
    if (selectedContactIds.size === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedContactIds.size} contact${selectedContactIds.size !== 1 ? 's' : ''}? This action cannot be undone.`)) {
      bulkDeleteMutation.mutate(Array.from(selectedContactIds));
    }
  };

  const handleBulkGroupAssignment = () => {
    if (selectedContactIds.size === 0) return;
    setShowBulkGroupModal(true);
  };

  const handleGroupSelection = (groupId: string, checked: boolean) => {
    const newSelection = new Set(selectedGroupIds);
    if (checked) {
      newSelection.add(groupId);
    } else {
      newSelection.delete(groupId);
    }
    setSelectedGroupIds(newSelection);
  };

  const handleAssignContactsToGroups = () => {
    if (selectedContactIds.size === 0 || selectedGroupIds.size === 0) return;
    
    bulkGroupAssignmentMutation.mutate({
      groupIds: Array.from(selectedGroupIds),
      contactIds: Array.from(selectedContactIds)
    });
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportContacts = async (format: 'csv' | 'xlsx' = 'csv') => {
    if (isExporting) return;
    
    setIsExporting(true);
    try {
      // Build query parameters for export with all current filters
      const params = new URLSearchParams();
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
      params.append('format', format);
      // Add any other filters that might be active
      // TODO: Add subscription status and language filters when implemented
      
      // Create download URL
      const exportUrl = `/api/contacts/export_csv/?${params.toString()}`;
      
      // Use fetch to properly handle errors
      const response = await fetch(exportUrl, {
        method: 'GET',
        credentials: 'include', // Include session cookies
      });
      
      if (!response.ok) {
        let errorMessage = "Failed to export contacts";
        if (response.status === 401) {
          errorMessage = "You are not authenticated. Please log in and try again.";
        } else if (response.status === 403) {
          errorMessage = "You don't have permission to export contacts.";
        } else if (response.status >= 500) {
          errorMessage = "Server error occurred. Please try again later.";
        }
        
        throw new Error(errorMessage);
      }
      
      // Get the blob data
      const blob = await response.blob();
      
      // Create object URL and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contacts_export.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      const formatName = format.toUpperCase();
      toast({
        title: "Export Successful",
        description: `Your contacts have been exported as ${formatName} successfully.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "There was an error exporting your contacts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleEditContact = (contact: Contact) => {
    setSelectedContact(contact);
    setEditContact({
      firstName: contact.firstName || "",
      lastName: contact.lastName || "",
      email: contact.email,
      phone: contact.phone || "",
      language: contact.language || "en",
    });
    setShowEditModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.email) {
      toast({
        title: "Validation Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }
    createContactMutation.mutate(newContact);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact?.id) return;
    
    if (!editContact.email) {
      toast({
        title: "Validation Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }
    
    updateContactMutation.mutate({
      contactId: selectedContact.id,
      contactData: editContact
    });
  };

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
          <h2 className="text-2xl font-semibold text-foreground">Contacts</h2>
          <p className="text-sm text-muted-foreground">
            Manage your contact lists and groups for targeted campaigns.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                disabled={isExporting}
                data-testid="button-export-dropdown"
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? "Exporting..." : "Export"}
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => handleExportContacts('csv')}
                disabled={isExporting}
                data-testid="menu-item-export-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleExportContacts('xlsx')}
                disabled={isExporting}
                data-testid="menu-item-export-excel"
              >
                <Download className="h-4 w-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            variant="outline" 
            onClick={() => setShowImportModal(true)}
            data-testid="button-import-contacts"
          >
            <i className="fas fa-upload mr-2"></i>
            Import Contacts
          </Button>
          <Button onClick={() => setShowAddModal(true)} data-testid="button-add-contact">
            <i className="fas fa-plus mr-2"></i>
            Add Contact
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="contacts" className="space-y-6">
        <TabsList>
          <TabsTrigger value="contacts" data-testid="tab-contacts">Contacts</TabsTrigger>
          <TabsTrigger value="groups" data-testid="tab-groups">Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
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
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-foreground" data-testid="text-contact-groups">
                  {contactGroups?.length || 0}
                </div>
                <p className="text-sm text-muted-foreground">Groups</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="mb-6">
            <Input
              placeholder="Search contacts by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
              data-testid="input-search-contacts"
            />
          </div>

          {/* Contacts Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Contacts</CardTitle>
              <CardDescription>
                Showing {filteredContacts.length} of {totalCount} contacts
                {debouncedSearchTerm && ` (filtered by "${debouncedSearchTerm}")`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Bulk Actions Bar */}
              {showBulkActions && (
                <div className="mb-4 p-4 border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100" data-testid="text-bulk-selection-count">
                        {selectedContactIds.size} contact{selectedContactIds.size !== 1 ? 's' : ''} selected
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearSelection}
                        data-testid="button-clear-selection"
                      >
                        Clear selection
                      </Button>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkDelete}
                        disabled={bulkDeleteMutation.isPending}
                        className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                        data-testid="button-bulk-delete"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {bulkDeleteMutation.isPending ? "Deleting..." : "Delete selected"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkGroupAssignment}
                        data-testid="button-bulk-assign-groups"
                      >
                        Assign to groups
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 text-sm font-medium text-muted-foreground w-8">
                        <Checkbox
                          checked={
                            filteredContacts.length > 0 && filteredContacts.every(contact => selectedContactIds.has(contact.id))
                              ? true
                              : filteredContacts.some(contact => selectedContactIds.has(contact.id))
                              ? "indeterminate"
                              : false
                          }
                          onCheckedChange={(checked) => handleSelectAll(checked === true)}
                          data-testid="checkbox-select-all"
                          aria-label="Select all contacts"
                        />
                      </th>
                      <th className="text-left py-3 text-sm font-medium text-muted-foreground">Name</th>
                      <th className="text-left py-3 text-sm font-medium text-muted-foreground">Email</th>
                      <th className="text-left py-3 text-sm font-medium text-muted-foreground">Phone</th>
                      <th className="text-left py-3 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 text-sm font-medium text-muted-foreground">Added</th>
                      <th className="text-right py-3 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.map((contact: any) => (
                      <tr key={contact.id} className="border-b border-border last:border-0">
                        <td className="py-4">
                          <Checkbox
                            checked={selectedContactIds.has(contact.id)}
                            onCheckedChange={(checked) => handleContactSelection(contact.id, checked === true)}
                            data-testid={`checkbox-contact-${contact.id}`}
                            aria-label={`Select contact ${contact.firstName} ${contact.lastName}`}
                          />
                        </td>
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
                        <td className="py-4 text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(contact)}
                              data-testid={`button-view-contact-${contact.id}`}
                            >
                              <Eye className="w-4 h-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditContact(contact)}
                              data-testid={`button-edit-contact-${contact.id}`}
                            >
                              <i className="fas fa-edit text-primary"></i>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteContactMutation.mutate(contact.id)}
                              disabled={deleteContactMutation.isPending}
                              data-testid={`button-delete-contact-${contact.id}`}
                            >
                              <i className="fas fa-trash text-destructive"></i>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredContacts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          {searchTerm ? "No contacts match your search." : "No contacts yet. Add your first contact to get started!"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} ({totalCount} total contacts)
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  data-testid="button-previous-page"
                >
                  Previous
                </Button>
                {/* Page Numbers */}
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        data-testid={`button-page-${pageNum}`}
                        className="w-8 h-8"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Add Contact Modal */}
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={newContact.firstName}
                      onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })}
                      data-testid="input-first-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={newContact.lastName}
                      onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    required
                    data-testid="input-email"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    data-testid="input-phone"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createContactMutation.isPending} data-testid="button-save-contact">
                    {createContactMutation.isPending ? "Saving..." : "Save Contact"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Contact Modal */}
          <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Contact</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editFirstName">First Name</Label>
                    <Input
                      id="editFirstName"
                      value={editContact.firstName}
                      onChange={(e) => setEditContact({ ...editContact, firstName: e.target.value })}
                      data-testid="input-edit-first-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="editLastName">Last Name</Label>
                    <Input
                      id="editLastName"
                      value={editContact.lastName}
                      onChange={(e) => setEditContact({ ...editContact, lastName: e.target.value })}
                      data-testid="input-edit-last-name"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="editEmail">Email *</Label>
                  <Input
                    id="editEmail"
                    type="email"
                    value={editContact.email}
                    onChange={(e) => setEditContact({ ...editContact, email: e.target.value })}
                    required
                    data-testid="input-edit-email"
                  />
                </div>
                <div>
                  <Label htmlFor="editPhone">Phone</Label>
                  <Input
                    id="editPhone"
                    value={editContact.phone}
                    onChange={(e) => setEditContact({ ...editContact, phone: e.target.value })}
                    data-testid="input-edit-phone"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowEditModal(false)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateContactMutation.isPending} 
                    data-testid="button-update-contact"
                  >
                    {updateContactMutation.isPending ? "Updating..." : "Update Contact"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Contact Details Modal */}
          <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Contact Details</DialogTitle>
              </DialogHeader>
              {selectedContact && (
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                        <p className="text-sm" data-testid="text-contact-details-name">
                          {selectedContact.firstName} {selectedContact.lastName}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                        <p className="text-sm" data-testid="text-contact-details-email">
                          {selectedContact.email}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                        <p className="text-sm" data-testid="text-contact-details-phone">
                          {selectedContact.phone || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Language</Label>
                        <p className="text-sm" data-testid="text-contact-details-language">
                          {selectedContact.language || "English"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                        <Badge 
                          variant={selectedContact.isSubscribed ? "default" : "secondary"}
                          data-testid="badge-contact-details-status"
                        >
                          {selectedContact.isSubscribed ? "Subscribed" : "Unsubscribed"}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Joined</Label>
                        <p className="text-sm" data-testid="text-contact-details-joined">
                          {selectedContact.createdAt ? new Date(selectedContact.createdAt).toLocaleDateString() : "Not available"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Groups */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Groups</h3>
                    <div className="space-y-2">
                      {isLoadingGroupMemberships ? (
                        <div className="space-y-2" data-testid="loading-contact-groups">
                          {[...Array(2)].map((_, i) => (
                            <div key={i} className="h-16 bg-muted rounded-lg animate-pulse"></div>
                          ))}
                        </div>
                      ) : isErrorGroupMemberships ? (
                        <p className="text-sm text-destructive py-4 text-center" data-testid="error-contact-groups">
                          Failed to load contact groups. Please try again.
                        </p>
                      ) : contactGroupMemberships && contactGroupMemberships.length > 0 ? (
                        contactGroupMemberships.map((group: ContactGroup) => (
                          <div 
                            key={group.id} 
                            className="flex items-center justify-between p-3 border border-border rounded-lg"
                            data-testid={`group-membership-${group.id}`}
                          >
                            <div>
                              <p className="font-medium">{group.name}</p>
                              {group.description && (
                                <p className="text-sm text-muted-foreground">{group.description}</p>
                              )}
                            </div>
                            <Badge variant="outline">Member</Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-contact-no-groups">
                          This contact is not a member of any groups.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex justify-end space-x-2 pt-4 border-t border-border">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowDetailsModal(false);
                        handleEditContact(selectedContact);
                      }}
                      data-testid="button-quick-edit"
                    >
                      <i className="fas fa-edit mr-2"></i>
                      Edit Contact
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowDetailsModal(false)}
                      data-testid="button-close-details"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Bulk Group Assignment Modal */}
          <Dialog open={showBulkGroupModal} onOpenChange={(open) => { setShowBulkGroupModal(open); if (!open) setSelectedGroupIds(new Set()); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Assign Contacts to Groups</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Select groups to assign {selectedContactIds.size} contact{selectedContactIds.size !== 1 ? 's' : ''} to:
                </p>
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {contactGroups && contactGroups.length > 0 ? (
                    contactGroups.map((group: ContactGroup) => (
                      <div key={group.id} className="flex items-center space-x-2 p-2 border border-border rounded">
                        <Checkbox
                          checked={selectedGroupIds.has(group.id)}
                          onCheckedChange={(checked) => handleGroupSelection(group.id, checked === true)}
                          data-testid={`checkbox-bulk-group-${group.id}`}
                          aria-label={`Assign to ${group.name}`}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm" data-testid={`text-group-name-${group.id}`}>
                            {group.name}
                          </p>
                          {group.description && (
                            <p className="text-xs text-muted-foreground" data-testid={`text-group-desc-${group.id}`}>
                              {group.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-groups-available">
                      No groups available. Create groups first to assign contacts.
                    </p>
                  )}
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t border-border">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowBulkGroupModal(false);
                      setSelectedGroupIds(new Set());
                    }}
                    data-testid="button-cancel-bulk-assign"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAssignContactsToGroups}
                    disabled={selectedGroupIds.size === 0 || bulkGroupAssignmentMutation.isPending}
                    data-testid="button-confirm-bulk-assign"
                  >
                    {bulkGroupAssignmentMutation.isPending 
                      ? "Assigning..." 
                      : `Assign to ${selectedGroupIds.size} group${selectedGroupIds.size !== 1 ? 's' : ''}`
                    }
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

        </TabsContent>

        <TabsContent value="groups" className="space-y-6">
          <ContactGroupsManager />
        </TabsContent>
      </Tabs>

      {/* Import Modal */}
      <ContactImport open={showImportModal} onOpenChange={setShowImportModal} />
    </div>
  );
}
