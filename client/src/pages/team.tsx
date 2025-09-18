import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

export default function Team() {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "campaign_manager",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ["/api/team/members"],
    enabled: false, // This endpoint would need to be implemented
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await apiRequest("POST", "/api/team/invite", userData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Team member invited successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
      setShowInviteModal(false);
      setNewUser({
        email: "",
        firstName: "",
        lastName: "",
        role: "campaign_manager",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to invite team member",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email) {
      toast({
        title: "Validation Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }
    inviteUserMutation.mutate(newUser);
  };

  // Since team management isn't fully implemented in the backend,
  // we'll show current user and placeholder for team functionality
  const mockTeamMembers = [
    {
      id: user?.id,
      email: user?.email,
      firstName: user?.firstName,
      lastName: user?.lastName,
      role: user?.role,
      isActive: true,
      createdAt: user?.createdAt,
    }
  ];

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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Team</h2>
          <p className="text-sm text-muted-foreground">
            Manage team members and their permissions.
          </p>
        </div>
        {user?.role === 'admin' && (
          <Button onClick={() => setShowInviteModal(true)} data-testid="button-invite-member">
            <i className="fas fa-plus mr-2"></i>
            Invite Member
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground" data-testid="text-total-members">
              {mockTeamMembers.length}
            </div>
            <p className="text-sm text-muted-foreground">Total Members</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground" data-testid="text-admin-members">
              {mockTeamMembers.filter(m => m.role === 'admin').length}
            </div>
            <p className="text-sm text-muted-foreground">Admins</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground" data-testid="text-manager-members">
              {mockTeamMembers.filter(m => m.role === 'campaign_manager').length}
            </div>
            <p className="text-sm text-muted-foreground">Campaign Managers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground" data-testid="text-active-members">
              {mockTeamMembers.filter(m => m.isActive).length}
            </div>
            <p className="text-sm text-muted-foreground">Active Members</p>
          </CardContent>
        </Card>
      </div>

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
                        <i className="fas fa-check text-green-600"></i>
                        <span>Manage organization settings</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-check text-green-600"></i>
                        <span>Invite and manage team members</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-check text-green-600"></i>
                        <span>Access all features</span>
                      </div>
                    </>
                  )}
                  {role.value === 'campaign_manager' && (
                    <>
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-check text-green-600"></i>
                        <span>Create and send campaigns</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-check text-green-600"></i>
                        <span>Manage contacts and lists</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-check text-green-600"></i>
                        <span>View campaign analytics</span>
                      </div>
                    </>
                  )}
                  {role.value === 'analyst' && (
                    <>
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-check text-green-600"></i>
                        <span>View all analytics</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-check text-green-600"></i>
                        <span>Export reports</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-times text-red-600"></i>
                        <span>Cannot send campaigns</span>
                      </div>
                    </>
                  )}
                  {role.value === 'editor' && (
                    <>
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-check text-green-600"></i>
                        <span>Create and edit templates</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-check text-green-600"></i>
                        <span>Manage template library</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-times text-red-600"></i>
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
                  <tr key={member.id} className="border-b border-border last:border-0">
                    <td className="py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                          <i className="fas fa-user text-muted-foreground text-sm"></i>
                        </div>
                        <div>
                          <div className="font-medium text-foreground" data-testid={`text-member-name-${member.id}`}>
                            {member.firstName && member.lastName 
                              ? `${member.firstName} ${member.lastName}` 
                              : member.email}
                          </div>
                          <div className="text-sm text-muted-foreground">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <Badge className={getRoleColor(member.role)}>
                        {roles.find(r => r.value === member.role)?.label || member.role}
                      </Badge>
                    </td>
                    <td className="py-4">
                      <Badge variant={member.isActive ? "default" : "secondary"}>
                        {member.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-4 text-foreground">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 text-right">
                      {user?.role === 'admin' && member.id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-member-menu-${member.id}`}
                        >
                          <i className="fas fa-ellipsis-h"></i>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Invite Member Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="team.member@example.com"
                required
                data-testid="input-invite-email"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                  placeholder="John"
                  data-testid="input-invite-first-name"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                  placeholder="Doe"
                  data-testid="input-invite-last-name"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                <SelectTrigger data-testid="select-invite-role">
                  <SelectValue />
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
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowInviteModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteUserMutation.isPending} data-testid="button-send-invite">
                {inviteUserMutation.isPending ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
