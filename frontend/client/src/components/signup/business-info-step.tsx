import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft } from "lucide-react";

interface BusinessInfoStepProps {
  data: {
    contacts_range: string;
    employees_range: string;
    industry: string;
  };
  onNext: () => void;
  onBack: () => void;
  onDataUpdate: (data: { contacts_range: string; employees_range: string; industry: string }) => void;
}

export default function BusinessInfoStep({ data, onNext, onBack, onDataUpdate }: BusinessInfoStepProps) {
  const [formData, setFormData] = useState({
    contacts_range: data.contacts_range,
    employees_range: data.employees_range,
    industry: data.industry,
  });
  const { toast } = useToast();

  const businessInfoMutation = useMutation({
    mutationFn: async (info: any) => {
      const response = await apiRequest("POST", "/api/signup/business-info", info);
      return response.json();
    },
    onSuccess: () => {
      onDataUpdate(formData);
      toast({
        title: "Business information saved",
        description: "Your business information has been saved.",
      });
      onNext();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save business information",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.contacts_range || !formData.employees_range || !formData.industry) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    businessInfoMutation.mutate(formData);
  };

  const contactRanges = [
    "0-100",
    "100-1,000",
    "1,000-10,000", 
    "10,000-50,000",
    "50,000+"
  ];

  const employeeRanges = [
    "1-10",
    "11-50",
    "51-200",
    "201-500",
    "501-1,000",
    "1,000+"
  ];

  const industries = [
    "Technology",
    "Healthcare", 
    "Finance",
    "Education",
    "Retail",
    "Manufacturing",
    "Real Estate",
    "Marketing",
    "Non-profit",
    "Government",
    "Other"
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="contactsRange">Expected Number of Contacts</Label>
        <Select
          value={formData.contacts_range}
          onValueChange={(value) => setFormData(prev => ({ ...prev, contacts_range: value }))}
        >
          <SelectTrigger data-testid="select-contacts-range">
            <SelectValue placeholder="Select your expected contact list size" />
          </SelectTrigger>
          <SelectContent>
            {contactRanges.map((range) => (
              <SelectItem key={range} value={range}>
                {range} contacts
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          This helps us recommend the right plan for your needs
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="employeesRange">Company Size</Label>
        <Select
          value={formData.employees_range}
          onValueChange={(value) => setFormData(prev => ({ ...prev, employees_range: value }))}
        >
          <SelectTrigger data-testid="select-employees-range">
            <SelectValue placeholder="Select your company size" />
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

      <div className="space-y-2">
        <Label htmlFor="industry">Industry</Label>
        <Select
          value={formData.industry}
          onValueChange={(value) => setFormData(prev => ({ ...prev, industry: value }))}
        >
          <SelectTrigger data-testid="select-industry">
            <SelectValue placeholder="Select your industry" />
          </SelectTrigger>
          <SelectContent>
            {industries.map((industry) => (
              <SelectItem key={industry} value={industry}>
                {industry}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={businessInfoMutation.isPending}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Button
          type="submit"
          className="flex-1"
          disabled={businessInfoMutation.isPending}
          data-testid="button-continue"
        >
          {businessInfoMutation.isPending ? "Saving..." : "Continue"}
        </Button>
      </div>
    </form>
  );
}