import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Contact, ContactGroup } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, UserPlus, Edit, Trash2, Plus } from "lucide-react";

export default function ContactGroupsManager() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ContactGroup | null>(null);
  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch contact groups
  const { data: contactGroups, isLoading: groupsLoading } = useQuery<ContactGroup[]>({
    queryKey: ["/api/contact-groups"],
  });

  // Fetch all contacts for group assignment
  const { data: allContacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  // Fetch contacts in selected group
  const { data: groupContacts, isLoading: groupContactsLoading } = useQuery<Contact[]>({
    queryKey: [`/api/contact-groups/${selectedGroup?.id}/contacts`],
    enabled: !!selectedGroup?.id,
  });

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async (groupData: any) => {
      const response = await apiRequest("POST", "/api/contact-groups", groupData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact group created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] });
      setShowAddModal(false);
      setNewGroup({ name: "", description: "" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create contact group",
        variant: "destructive",
      });
    },
  });

  // Update group mutation
  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/contact-groups/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact group updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] });
      setShowEditModal(false);
      setSelectedGroup(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update contact group",
        variant: "destructive",
      });
    },
  });

  // Delete group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      await apiRequest("DELETE", `/api/contact-groups/${groupId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact group deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contact group",
        variant: "destructive",
      });
    },
  });

  // Add contacts to group mutation
  const addContactsToGroupMutation = useMutation({
    mutationFn: async ({ groupId, contactIds }: { groupId: string; contactIds: string[] }) => {
      const response = await apiRequest("POST", `/api/contact-groups/${groupId}/add-contacts`, {
        contact_ids: contactIds,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contacts added to group successfully!",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${selectedGroup?.id}/contacts`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add contacts to group",
        variant: "destructive",
      });
    },
  });

  // Remove contacts from group mutation
  const removeContactsFromGroupMutation = useMutation({
    mutationFn: async ({ groupId, contactIds }: { groupId: string; contactIds: string[] }) => {
      const response = await apiRequest("POST", `/api/contact-groups/${groupId}/remove-contacts`, {
        contact_ids: contactIds,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contacts removed from group successfully!",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${selectedGroup?.id}/contacts`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove contacts from group",
        variant: "destructive",
      });
    },
  });

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroup.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Group name is required",
        variant: "destructive",
      });
      return;
    }
    createGroupMutation.mutate(newGroup);
  };

  const handleEditGroup = (group: ContactGroup) => {
    setSelectedGroup(group);
    setNewGroup({
      name: group.name,
      description: group.description || "",
    });
    setShowEditModal(true);
  };

  const handleUpdateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !newGroup.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Group name is required",
        variant: "destructive",
      });
      return;
    }
    updateGroupMutation.mutate({
      id: selectedGroup.id,
      data: newGroup,
    });
  };

  const handleViewGroupContacts = (group: ContactGroup) => {
    setSelectedGroup(group);
    setShowContactsModal(true);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (confirm("Are you sure you want to delete this contact group? This action cannot be undone.")) {
      deleteGroupMutation.mutate(groupId);
    }
  };

  const handleRemoveContactFromGroup = (contactId: string) => {
    if (!selectedGroup) return;
    removeContactsFromGroupMutation.mutate({
      groupId: selectedGroup.id,
      contactIds: [contactId],
    });
  };

  // Get contacts not in the selected group
  const getAvailableContacts = () => {
    if (!allContacts || !groupContacts) return [];
    const groupContactIds = groupContacts.map(c => c.id);
    return allContacts.filter(c => !groupContactIds.includes(c.id));
  };

  if (groupsLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-48"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Contact Groups</h3>
          <p className="text-sm text-muted-foreground">
            Organize your contacts into groups for targeted campaigns.
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} data-testid="button-create-group">
          <Plus className="w-4 h-4 mr-2" />
          Create Group
        </Button>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contactGroups?.map((group) => (
          <Card key={group.id} className="relative">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base font-medium">{group.name}</CardTitle>
                  {group.description && (
                    <CardDescription className="mt-1 text-sm">
                      {group.description}
                    </CardDescription>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditGroup(group)}
                    data-testid={`button-edit-group-${group.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteGroup(group.id)}
                    data-testid={`button-delete-group-${group.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Contacts</span>
                </div>
                <Badge variant="secondary" data-testid={`badge-group-contacts-${group.id}`}>
                  Loading...
                </Badge>
              </div>
              <div className="mt-3 flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleViewGroupContacts(group)}
                  data-testid={`button-view-group-${group.id}`}
                >
                  <Users className="w-4 h-4 mr-2" />
                  View Contacts
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {contactGroups?.length === 0 && (
          <div className="col-span-full text-center py-8">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No contact groups yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first contact group to organize your contacts for targeted campaigns.
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Group
            </Button>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Contact Group</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <Label htmlFor="groupName">Group Name *</Label>
              <Input
                id="groupName"
                value={newGroup.name}
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                placeholder="e.g., Newsletter Subscribers"
                required
                data-testid="input-group-name"
              />
            </div>
            <div>
              <Label htmlFor="groupDescription">Description</Label>
              <Textarea
                id="groupDescription"
                value={newGroup.description}
                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                placeholder="Optional description for this group"
                rows={3}
                data-testid="input-group-description"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createGroupMutation.isPending} data-testid="button-save-group">
                {createGroupMutation.isPending ? "Creating..." : "Create Group"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Group Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact Group</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateGroup} className="space-y-4">
            <div>
              <Label htmlFor="editGroupName">Group Name *</Label>
              <Input
                id="editGroupName"
                value={newGroup.name}
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                placeholder="e.g., Newsletter Subscribers"
                required
                data-testid="input-edit-group-name"
              />
            </div>
            <div>
              <Label htmlFor="editGroupDescription">Description</Label>
              <Textarea
                id="editGroupDescription"
                value={newGroup.description}
                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                placeholder="Optional description for this group"
                rows={3}
                data-testid="input-edit-group-description"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateGroupMutation.isPending} data-testid="button-update-group">
                {updateGroupMutation.isPending ? "Updating..." : "Update Group"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Group Contacts Modal */}
      <Dialog open={showContactsModal} onOpenChange={setShowContactsModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Contacts in "{selectedGroup?.name}"
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {groupContactsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
                ))}
              </div>
            ) : (
              <>
                {groupContacts && groupContacts.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {groupContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg"
                      >
                        <div>
                          <div className="font-medium">{contact.firstName} {contact.lastName}</div>
                          <div className="text-sm text-muted-foreground">{contact.email}</div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveContactFromGroup(contact.id)}
                          disabled={removeContactsFromGroupMutation.isPending}
                          data-testid={`button-remove-contact-${contact.id}`}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No contacts in this group yet.</p>
                  </div>
                )}

                {/* Available contacts to add */}
                {getAvailableContacts().length > 0 && (
                  <div className="border-t border-border pt-4">
                    <h4 className="font-medium mb-2">Add Contacts to Group</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {getAvailableContacts().map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center justify-between p-2 border border-border rounded"
                        >
                          <div>
                            <div className="font-medium text-sm">{contact.firstName} {contact.lastName}</div>
                            <div className="text-xs text-muted-foreground">{contact.email}</div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectedGroup && addContactsToGroupMutation.mutate({
                              groupId: selectedGroup.id,
                              contactIds: [contact.id],
                            })}
                            disabled={addContactsToGroupMutation.isPending}
                            data-testid={`button-add-contact-${contact.id}`}
                          >
                            <UserPlus className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}