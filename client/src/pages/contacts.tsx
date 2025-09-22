import { useState } from "react";
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
import { apiRequest } from "@/lib/queryClient";
import { Eye, Edit, Trash2 } from "lucide-react";
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

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: contactGroups } = useQuery<ContactGroup[]>({
    queryKey: ["/api/contact-groups"],
  });

  // Fetch contact groups for selected contact
  const { 
    data: contactGroupMemberships, 
    isLoading: isLoadingGroupMemberships,
    isError: isErrorGroupMemberships 
  } = useQuery<ContactGroup[]>({
    queryKey: [`/api/contacts/${selectedContact?.id}/groups`],
    enabled: !!selectedContact?.id,
  });

  const createContactMutation = useMutation({
    mutationFn: async (contactData: any) => {
      const response = await apiRequest("POST", "/api/contacts", contactData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
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
      const response = await apiRequest("PUT", `/api/contacts/${contactId}`, contactData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
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
      await apiRequest("DELETE", `/api/contacts/${contactId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
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
        apiRequest("DELETE", `/api/contacts/${id}`)
      );
      await Promise.all(promises);
    },
    onSuccess: (_, contactIds) => {
      toast({
        title: "Success",
        description: `${contactIds.length} contact${contactIds.length !== 1 ? 's' : ''} deleted successfully!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
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

  const filteredContacts = contacts?.filter((contact) =>
    contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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
    // For now, just show a toast - this will be implemented in task 5
    toast({
      title: "Bulk Group Assignment",
      description: "This feature will be implemented in the next task.",
    });
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

  if (isLoading) {
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
                  {contacts?.length || 0}
                </div>
                <p className="text-sm text-muted-foreground">Total Contacts</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-foreground" data-testid="text-subscribed-contacts">
                  {contacts?.filter((c: any) => c.isSubscribed).length || 0}
                </div>
                <p className="text-sm text-muted-foreground">Subscribed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-foreground" data-testid="text-unsubscribed-contacts">
                  {contacts?.filter((c: any) => !c.isSubscribed).length || 0}
                </div>
                <p className="text-sm text-muted-foreground">Unsubscribed</p>
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
                {filteredContacts.length} of {contacts?.length || 0} contacts
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
                          onCheckedChange={handleSelectAll}
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
                            onCheckedChange={(checked) => handleContactSelection(contact.id, checked)}
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
                          {new Date(selectedContact.createdAt).toLocaleDateString()}
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
