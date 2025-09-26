import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, User, Check, X, MoreHorizontal, Users, Shield, BarChart, UserCheck, UserX } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatsGrid, StatCard } from "@/components/ui/stats-grid";
import { EmptyState } from "@/components/ui/empty-state";

// Form validation schema
const inviteFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["admin", "campaign_manager", "analyst", "editor"], {
    required_error: "Please select a role",
  }),
});

type InviteFormData = z.infer<typeof inviteFormSchema>;

export default function Team() {
  const [showInviteModal, setShowInviteModal] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Form setup
  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: "campaign_manager",
    },
  });

  const { data: teamMembers, isLoading, error: teamError } = useQuery({
    queryKey: ["/api/team/members/"],
    enabled: true, // Enable the query
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (userData: InviteFormData) => {
      const response = await apiRequest("POST", "/api/team/invite/", userData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Team member invited successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/team/members/"] });
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

  const updateMemberMutation = useMutation({
    mutationFn: async ({ memberId, updates }: { memberId: string; updates: { role?: string; isActive?: boolean } }) => {
      const response = await apiRequest("PATCH", `/api/team/members/${memberId}/`, updates);
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: variables.updates.role 
          ? "Member role updated successfully!" 
          : "Member status updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/team/members/"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update team member",
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

  const handleSubmit = (data: InviteFormData) => {
    inviteUserMutation.mutate(data);
  };

  // Use team data from API, fallback to current user only when teamMembers is null/undefined
  const actualTeamMembers = Array.isArray(teamMembers) ? teamMembers : [];
  const mockTeamMembers = teamMembers === null || teamMembers === undefined ? [
    {
      id: user?.id,
      email: user?.email,
      firstName: user?.firstName,
      lastName: user?.lastName,
      role: user?.role,
      isActive: true,
      createdAt: user?.createdAt,
    }
  ] : actualTeamMembers;

  // Show error state if query failed
  if (teamError) {
    console.error("Team query error:", teamError);
    return (
      <div className="p-6">
        <div className="text-center" data-testid="container-team-error">
          <h2 className="text-xl font-semibold mb-2">Team Management</h2>
          <p className="text-muted-foreground mb-4">
            There was an error loading your team data. Please try refreshing the page.
          </p>
          <Button onClick={() => window.location.reload()} data-testid="button-refresh-team-error">
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background">
      <PageHeader
        title="Team Management"
        description="Manage your organization's team members and their access levels"
        primaryAction={
          user?.role === 'admin' ? (
            <Button onClick={() => setShowInviteModal(true)} data-testid="button-invite-member">
              <Plus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          ) : undefined
        }
      />

      <StatsGrid className="mb-6">
        <StatCard
          title="Total Members"
          value={mockTeamMembers.length}
          description="Team size"
          icon={<Users className="h-6 w-6 text-primary" />}
          testId="stat-total-members"
        />
        <StatCard
          title="Admins"
          value={mockTeamMembers.filter(m => m.role === 'admin').length}
          description="Full access"
          icon={<Shield className="h-6 w-6 text-red-600" />}
          testId="stat-admin-members"
        />
        <StatCard
          title="Campaign Managers"
          value={mockTeamMembers.filter(m => m.role === 'campaign_manager').length}
          description="Create campaigns"
          icon={<BarChart className="h-6 w-6 text-blue-600" />}
          testId="stat-manager-members"
        />
        <StatCard
          title="Active Members"
          value={mockTeamMembers.filter(m => m.isActive).length}
          description="Currently active"
          icon={<User className="h-6 w-6 text-green-600" />}
          testId="stat-active-members"
        />
      </StatsGrid>

      {/* Role Permissions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>
            Understanding what each role can do in your organization
          </CardDescription>
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
                        <Check className="h-3 w-3 text-green-600" />
                        <span>Manage organization settings</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check className="h-3 w-3 text-green-600" />
                        <span>Invite and manage team members</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check className="h-3 w-3 text-green-600" />
                        <span>Access all features</span>
                      </div>
                    </>
                  )}
                  {role.value === 'campaign_manager' && (
                    <>
                      <div className="flex items-center space-x-2">
                        <Check className="h-3 w-3 text-green-600" />
                        <span>Create and send campaigns</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check className="h-3 w-3 text-green-600" />
                        <span>Manage contacts and lists</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check className="h-3 w-3 text-green-600" />
                        <span>View campaign analytics</span>
                      </div>
                    </>
                  )}
                  {role.value === 'analyst' && (
                    <>
                      <div className="flex items-center space-x-2">
                        <Check className="h-3 w-3 text-green-600" />
                        <span>View all analytics</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check className="h-3 w-3 text-green-600" />
                        <span>Export reports</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <X className="h-3 w-3 text-red-600" />
                        <span>Cannot send campaigns</span>
                      </div>
                    </>
                  )}
                  {role.value === 'editor' && (
                    <>
                      <div className="flex items-center space-x-2">
                        <Check className="h-3 w-3 text-green-600" />
                        <span>Create and edit templates</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check className="h-3 w-3 text-green-600" />
                        <span>Manage template library</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <X className="h-3 w-3 text-red-600" />
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

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {mockTeamMembers.length} active member{mockTeamMembers.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mockTeamMembers.length === 0 ? (
            <EmptyState
              title="No team members yet"
              description="Start building your team by inviting your first member."
              action={
                user?.role === 'admin' ? (
                  <Button onClick={() => setShowInviteModal(true)} data-testid="button-invite-first-member">
                    <Plus className="h-4 w-4 mr-2" />
                    Invite First Member
                  </Button>
                ) : undefined
              }
            />
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
                  {mockTeamMembers.map((member: any) => (
                    <tr key={member.id} className="border-b border-border last:border-0" data-testid={`row-team-member-${member.id}`}>
                      <td className="py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground" data-testid={`text-member-name-${member.id}`}>
                              {member.firstName && member.lastName 
                                ? `${member.firstName} ${member.lastName}` 
                                : member.email}
                            </div>
                            <div className="text-sm text-muted-foreground" data-testid={`text-member-email-${member.id}`}>{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <Badge className={getRoleColor(member.role)} data-testid={`badge-member-role-${member.id}`}>
                          {roles.find(r => r.value === member.role)?.label || member.role}
                        </Badge>
                      </td>
                      <td className="py-4">
                        <Badge variant={member.isActive ? "default" : "secondary"} data-testid={`badge-member-status-${member.id}`}>
                          {member.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-4 text-foreground" data-testid={`text-member-joined-${member.id}`}>
                        {new Date(member.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-right">
                        {user?.role === 'admin' && member.id !== user?.id && (
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
                              {roles.map((role) => (
                                <DropdownMenuItem
                                  key={role.value}
                                  onClick={() => 
                                    updateMemberMutation.mutate({ 
                                      memberId: member.id, 
                                      updates: { role: role.value } 
                                    })
                                  }
                                  disabled={member.role === role.value || updateMemberMutation.isPending}
                                  data-testid={`menu-role-${role.value}-${member.id}`}
                                >
                                  {role.value === 'admin' && <Shield className="h-4 w-4 mr-2" />}
                                  {role.value === 'campaign_manager' && <BarChart className="h-4 w-4 mr-2" />}
                                  {role.value === 'analyst' && <Users className="h-4 w-4 mr-2" />}
                                  {role.value === 'editor' && <User className="h-4 w-4 mr-2" />}
                                  Change to {role.label}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuItem
                                onClick={() => 
                                  updateMemberMutation.mutate({ 
                                    memberId: member.id, 
                                    updates: { isActive: !member.isActive } 
                                  })
                                }
                                disabled={updateMemberMutation.isPending}
                                data-testid={`menu-toggle-status-${member.id}`}
                              >
                                {member.isActive ? (
                                  <>
                                    <UserX className="h-4 w-4 mr-2" />
                                    Deactivate Member
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Activate Member
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
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
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="team.member@example.com"
                        data-testid="input-invite-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John"
                          data-testid="input-invite-first-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Doe"
                          data-testid="input-invite-last-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowInviteModal(false);
                    form.reset();
                  }}
                  data-testid="button-cancel-invite"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={inviteUserMutation.isPending}
                  data-testid="button-send-invite"
                >
                  {inviteUserMutation.isPending ? "Sending..." : "Send Invite"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
