import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function OrganizationSetup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [orgData, setOrgData] = useState({
    name: "",
    industry: "",
    employeesRange: "",
    contactsRange: "",
  });

  const createOrgMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/organizations", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Organization created successfully! Welcome to EngageX.",
      });
      // Refresh user data to get the new organization association
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to create organization",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Organization name is required",
        variant: "destructive",
      });
      return;
    }
    createOrgMutation.mutate(orgData);
  };

  const industries = [
    "Technology", "Healthcare", "Finance", "Education", "Retail", "Manufacturing", 
    "Real Estate", "Marketing", "Non-profit", "Government", "Other"
  ];

  const employeeRanges = [
    "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"
  ];

  const contactRanges = [
    "0-100", "100-1000", "1000-10000", "10000-50000", "50000+"
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center">
              <i className="fas fa-envelope text-primary-foreground text-2xl"></i>
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome to EngageX</CardTitle>
          <CardDescription className="text-lg">
            Let's set up your organization to get started with email marketing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name *</Label>
              <Input
                id="orgName"
                placeholder="Your Company Name"
                value={orgData.name}
                onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                data-testid="input-org-name"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Select 
                  value={orgData.industry} 
                  onValueChange={(value) => setOrgData({ ...orgData, industry: value })}
                >
                  <SelectTrigger data-testid="select-industry">
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((industry) => (
                      <SelectItem key={industry} value={industry.toLowerCase()}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employees">Number of Employees</Label>
                <Select 
                  value={orgData.employeesRange} 
                  onValueChange={(value) => setOrgData({ ...orgData, employeesRange: value })}
                >
                  <SelectTrigger data-testid="select-employees">
                    <SelectValue placeholder="Select employee range" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeRanges.map((range) => (
                      <SelectItem key={range} value={range}>
                        {range} employees
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contacts">Expected Number of Contacts</Label>
              <Select 
                value={orgData.contactsRange} 
                onValueChange={(value) => setOrgData({ ...orgData, contactsRange: value })}
              >
                <SelectTrigger data-testid="select-contacts">
                  <SelectValue placeholder="Select expected contact range" />
                </SelectTrigger>
                <SelectContent>
                  {contactRanges.map((range) => (
                    <SelectItem key={range} value={range}>
                      {range} contacts
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">Your Free Trial Includes:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 1,000 contacts</li>
                <li>• 10 campaigns per month</li>
                <li>• All core features</li>
                <li>• 14-day free trial</li>
              </ul>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={createOrgMutation.isPending}
              data-testid="button-create-org"
            >
              {createOrgMutation.isPending ? "Creating Organization..." : "Create Organization & Start Free Trial"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}