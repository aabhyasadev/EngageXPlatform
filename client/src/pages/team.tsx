import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/page-header";
import { StatsGrid, StatCard } from "@/components/ui/stats-grid";
import { Users, UserPlus, Shield, Activity, MoreHorizontal, Edit, Trash2, UserCheck, UserX, Clock } from "lucide-react";

// Zod schemas
const inviteSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  role: z.enum(["admin", "campaign_manager", "analyst", "editor"], {
    required_error: "Please select a role",
  }),
});


type InviteFormData = z.infer<typeof inviteSchema>;

type TeamMember = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  full_name: string;
};

type PendingInvitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  organization_name: string;
  invited_by_name: string;
  role_display: string;
  is_expired: boolean;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export default function Team() {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      role: "campaign_manager",
    },
  });


  const { data: teamMembersResponse, isLoading, isError, error } = useQuery<PaginatedResponse<TeamMember>>({
    queryKey: ["/api/users/"],
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 3,
  });

  const { data: pendingInvitationsResponse, isLoading: isLoadingInvitations } = useQuery<PaginatedResponse<PendingInvitation>>({
    queryKey: ["/api/invitations/"],
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 3,
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (userData: InviteFormData) => {
      const response = await apiRequest("POST", "/api/users/", {
        email: userData.email,
        role: userData.role,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Team member invited successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations/"] });
      setShowInviteModal(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to invite team member",
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await apiRequest("PATCH", `/api/users/${userId}/`, { role });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Role updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, is_active }: { userId: string; is_active: boolean }) => {
      const response = await apiRequest("PATCH", `/api/users/${userId}/`, { is_active });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Member status updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update member status",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/users/${userId}/`);
      return response.ok;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Team member removed successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/"] });
      setShowDeleteModal(false);
      setMemberToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove team member",
        variant: "destructive",
      });
    },
  });


  const roles = [
    { value: "admin", label: "Admin", description: "Full access to all features" },
    { value: "campaign_manager", label: "Campaign Manager", description: "Create and manage campaigns" },
    { value: "analyst", label: "Analyst", description: "View analytics and reports" },
    { value: "editor", label: "Editor", description: "Create and edit templates" },
  ];

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'campaign_manager': return 'bg-blue-100 text-blue-800';
      case 'analyst': return 'bg-green-100 text-green-800';
      case 'editor': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleDescription = (role: string) => {
    const roleData = roles.find(r => r.value === role);
    return roleData?.description || '';
  };

  const handleInviteSubmit = (data: InviteFormData) => {
    inviteUserMutation.mutate(data);
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  const handleToggleActive = (userId: string, currentStatus: boolean) => {
    toggleActiveMutation.mutate({ userId, is_active: !currentStatus });
  };

  const confirmDeleteMember = (member: TeamMember) => {
    setMemberToDelete(member);
    setShowDeleteModal(true);
  };

  const handleDeleteMember = () => {
    if (memberToDelete) {
      deleteUserMutation.mutate(memberToDelete.id);
    }
  };


  // Handle API responses - Django returns arrays directly, not paginated responses
  const members = Array.isArray(teamMembersResponse) ? teamMembersResponse : teamMembersResponse?.results || [];
  const pendingInvitations = Array.isArray(pendingInvitationsResponse) 
    ? pendingInvitationsResponse.filter(inv => inv.status === 'pending' && !inv.is_expired)
    : (pendingInvitationsResponse?.results?.filter(inv => inv.status === 'pending' && !inv.is_expired) || []);

  // Calculate statistics including pending invitations
  const totalMembers = members.length + pendingInvitations.length;
  const adminCount = members.filter(m => m.role === 'admin').length + pendingInvitations.filter(inv => inv.role === 'admin').length;
  const managerCount = members.filter(m => m.role === 'campaign_manager').length + pendingInvitations.filter(inv => inv.role === 'campaign_manager').length;
  const activeCount = members.filter(m => m.is_active).length; // Only count active existing members

  // Loading state
  if (isLoading || isLoadingInvitations) {
    return (
      <div className="p-6 space-y-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg"></div>
            ))}
          </div>
          <div className="h-96 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="mx-auto mb-4 h-12 w-12 text-red-500">
            <Users className="h-12 w-12" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Failed to Load Team Members</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {error?.message || "There was an error loading your team members. Please try again."}
          </p>
          <Button onClick={() => window.location.reload()} data-testid="button-retry-team-load">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background space-y-8">
      <PageHeader
        title="Team Management"
        description="Manage your team members, roles, and permissions."
        primaryAction={(user?.role === 'admin' || user?.role === 'organizer') ? {
          label: "Invite Member",
          onClick: () => setShowInviteModal(true),
          testId: "button-invite-member",
          icon: <UserPlus className="h-4 w-4" />,
        } : undefined}
      />


      {/* Team Statistics */}
      <StatsGrid columns={4}>
        <StatCard
          title="Total Members"
          value={totalMembers}
          icon={<Users className="h-6 w-6 text-blue-600" />}
          testId="text-total-members"
        />
        <StatCard
          title="Administrators"
          value={adminCount}
          icon={<Shield className="h-6 w-6 text-red-600" />}
          testId="text-admin-members"
        />
        <StatCard
          title="Campaign Managers"
          value={managerCount}
          icon={<UserPlus className="h-6 w-6 text-blue-600" />}
          testId="text-manager-members"
        />
        <StatCard
          title="Active Members"
          value={activeCount}
          icon={<Activity className="h-6 w-6 text-green-600" />}
          testId="text-active-members"
        />
      </StatsGrid>

      {/* Role Permissions */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Role Permissions</CardTitle>
              <CardDescription>
                Understanding what each role can do in your organization
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {roles.map((role) => (
              <div key={role.value} className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Badge className={getRoleColor(role.value)}>
                    {role.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{role.description}</p>
                <div className="space-y-1 text-xs">
                  {role.value === 'admin' && (
                    <>
                      <div className="flex items-center space-x-2">
                        <UserCheck className="h-3 w-3 text-green-600" />
                        <span>Manage organization settings</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <UserCheck className="h-3 w-3 text-green-600" />
                        <span>Invite and manage team members</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <UserCheck className="h-3 w-3 text-green-600" />
                        <span>Access all features</span>
                      </div>
                    </>
                  )}
                  {role.value === 'campaign_manager' && (
                    <>
                      <div className="flex items-center space-x-2">
                        <UserCheck className="h-3 w-3 text-green-600" />
                        <span>Create and send campaigns</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <UserCheck className="h-3 w-3 text-green-600" />
                        <span>Manage contacts and lists</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <UserCheck className="h-3 w-3 text-green-600" />
                        <span>View campaign analytics</span>
                      </div>
                    </>
                  )}
                  {role.value === 'analyst' && (
                    <>
                      <div className="flex items-center space-x-2">
                        <UserCheck className="h-3 w-3 text-green-600" />
                        <span>View all analytics</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <UserCheck className="h-3 w-3 text-green-600" />
                        <span>Export reports</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <UserX className="h-3 w-3 text-red-600" />
                        <span>Cannot send campaigns</span>
                      </div>
                    </>
                  )}
                  {role.value === 'editor' && (
                    <>
                      <div className="flex items-center space-x-2">
                        <UserCheck className="h-3 w-3 text-green-600" />
                        <span>Create and edit templates</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <UserCheck className="h-3 w-3 text-green-600" />
                        <span>Manage template library</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <UserX className="h-3 w-3 text-red-600" />
                        <span>Cannot send campaigns</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Team Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {totalMembers} member{totalMembers !== 1 ? 's' : ''} in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 && pendingInvitations.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No team members yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Invite your first team member to get started with collaboration.
              </p>
              {user?.role === 'admin' && (
                <Button onClick={() => setShowInviteModal(true)} data-testid="button-invite-first-member">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Team Member
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 text-sm font-medium text-muted-foreground">Member</th>
                    <th className="text-left py-3 text-sm font-medium text-muted-foreground">Role</th>
                    <th className="text-left py-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 text-sm font-medium text-muted-foreground">Joined</th>
                    <th className="text-right py-3 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Existing team members */}
                  {members.map((member) => (
                    <tr key={member.id} className="border-b border-border last:border-0" data-testid={`row-member-${member.id}`}>
                      <td className="py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                            <Users className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground" data-testid={`text-member-name-${member.id}`}>
                              {member.full_name || member.email}
                            </div>
                            <div className="text-sm text-muted-foreground" data-testid={`text-member-email-${member.id}`}>
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <Badge className={getRoleColor(member.role)} data-testid={`badge-role-${member.id}`}>
                          {roles.find(r => r.value === member.role)?.label || member.role}
                        </Badge>
                      </td>
                      <td className="py-4">
                        <Badge 
                          variant={member.is_active ? "default" : "secondary"}
                          data-testid={`badge-status-${member.id}`}
                        >
                          {member.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-4 text-foreground" data-testid={`text-joined-date-${member.id}`}>
                        {new Date(member.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-right">
                        {(user?.role === 'admin' || user?.role === 'organizer') && member.id !== user?.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`button-member-menu-${member.id}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleToggleActive(member.id, member.is_active)}
                                data-testid={`menu-toggle-status-${member.id}`}
                              >
                                {member.is_active ? <UserX className="h-4 w-4 mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
                                {member.is_active ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => confirmDeleteMember(member)}
                                className="text-red-600"
                                data-testid={`menu-delete-${member.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove Member
                              </DropdownMenuItem>
                              {/* Role change options */}
                              {roles.filter(r => r.value !== member.role).map(role => (
                                <DropdownMenuItem
                                  key={role.value}
                                  onClick={() => handleRoleChange(member.id, role.value)}
                                  data-testid={`menu-change-role-${role.value}-${member.id}`}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Change to {role.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Pending invitations */}
                  {pendingInvitations.map((invitation) => (
                    <tr key={`invitation-${invitation.id}`} className="border-b border-border last:border-0 bg-orange-50 dark:bg-orange-950/20" data-testid={`row-invitation-${invitation.id}`}>
                      <td className="py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center">
                            <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground" data-testid={`text-invitation-email-${invitation.id}`}>
                              {invitation.email}
                            </div>
                            <div className="text-sm text-orange-600 dark:text-orange-400" data-testid={`text-invitation-status-${invitation.id}`}>
                              Invitation pending
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <Badge className={getRoleColor(invitation.role)} data-testid={`badge-invitation-role-${invitation.id}`}>
                          {invitation.role_display}
                        </Badge>
                      </td>
                      <td className="py-4">
                        <Badge variant="outline" className="text-orange-600 border-orange-600" data-testid={`badge-invitation-status-${invitation.id}`}>
                          Pending
                        </Badge>
                      </td>
                      <td className="py-4 text-muted-foreground" data-testid={`text-invitation-sent-date-${invitation.id}`}>
                        Invited {new Date(invitation.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-right">
                        <div className="text-xs text-muted-foreground">
                          Expires {new Date(invitation.expires_at).toLocaleDateString()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Member Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleInviteSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="team.member@example.com"
                        data-testid="input-invite-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger data-testid="select-invite-role">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              <div>
                                <div className="font-medium">{role.label}</div>
                                <div className="text-xs text-muted-foreground">{role.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={inviteUserMutation.isPending} 
                  data-testid="button-send-invite"
                >
                  {inviteUserMutation.isPending ? "Inviting..." : "Invite Member"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Member Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to remove <span className="font-medium">{memberToDelete?.full_name || memberToDelete?.email}</span> from your team? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowDeleteModal(false)}
                data-testid="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                variant="destructive"
                disabled={deleteUserMutation.isPending}
                onClick={handleDeleteMember}
                data-testid="button-confirm-delete"
              >
                {deleteUserMutation.isPending ? "Removing..." : "Remove Member"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
