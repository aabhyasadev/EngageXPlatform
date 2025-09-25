import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Domain, ContactGroup } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CampaignModal({ open, onOpenChange }: CampaignModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    templateId: "",
    domainId: "",
    contactGroupId: "",
    schedule: "now",
    scheduledAt: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates } = useQuery({
    queryKey: ["/api/templates"],
  });

  const { data: domains } = useQuery<Domain[]>({
    queryKey: ["/api/domains"],
  });

  const { data: contactGroups } = useQuery<ContactGroup[]>({
    queryKey: ["/api/contact-groups"],
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData: any) => {
      const response = await apiRequest("POST", "/api/campaigns", campaignData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Campaign created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      onOpenChange(false);
      setFormData({
        name: "",
        templateId: "",
        domainId: "",
        contactGroupId: "",
        schedule: "now",
        scheduledAt: "",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create campaign",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast({
        title: "Validation Error",
        description: "Campaign name is required",
        variant: "destructive",
      });
      return;
    }

    const campaignData = {
      name: formData.name,
      template_id: formData.templateId && formData.templateId !== "none" ? formData.templateId : null,
      domain_id: formData.domainId && formData.domainId !== "none" ? formData.domainId : null,
      contact_group_id: formData.contactGroupId && formData.contactGroupId !== "none" ? formData.contactGroupId : null,
      status: formData.schedule === "now" ? "draft" : "scheduled",
      scheduled_at: formData.schedule === "later" ? new Date(formData.scheduledAt) : null,
    };

    createCampaignMutation.mutate(campaignData);
  };

  const verifiedDomains = domains?.filter((domain) => domain.status === 'verified') || [];

  // Handle template selection
  const handleTemplateChange = (templateId: string) => {
    setFormData({ ...formData, templateId: templateId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campaign Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter campaign name"
                required
                data-testid="input-campaign-name"
              />
            </div>

            <div>
              <Label htmlFor="template">Email Template</Label>
              <Select value={formData.templateId} onValueChange={(value) => setFormData({ ...formData, templateId: value })}>
                <SelectTrigger data-testid="select-template">
                  <SelectValue placeholder="Select email template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {(templates as any)?.map((template: any) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="domain">Sending Domain</Label>
              <Select value={formData.domainId} onValueChange={(value) => setFormData({ ...formData, domainId: value })}>
                <SelectTrigger data-testid="select-domain">
                  <SelectValue placeholder="Select verified domain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Use default domain</SelectItem>
                  {verifiedDomains.map((domain: any) => (
                    <SelectItem key={domain.id} value={domain.id}>
                      {domain.domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="contactGroup">Target Contact Group</Label>
              <Select value={formData.contactGroupId} onValueChange={(value) => setFormData({ ...formData, contactGroupId: value })}>
                <SelectTrigger data-testid="select-contact-group">
                  <SelectValue placeholder="Select contact group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All contacts</SelectItem>
                  {contactGroups?.map((group: any) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scheduling */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Schedule</h3>
            <div>
              <RadioGroup 
                value={formData.schedule} 
                onValueChange={(value) => setFormData({ ...formData, schedule: value })}
                className="flex items-center space-x-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="now" id="now" />
                  <Label htmlFor="now">Save as draft</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="later" id="later" />
                  <Label htmlFor="later">Schedule for later</Label>
                </div>
              </RadioGroup>
              
              {formData.schedule === "later" && (
                <div className="mt-4">
                  <Label htmlFor="scheduledAt">Scheduled Date & Time</Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                    min={new Date().toISOString().slice(0, 16)}
                    data-testid="input-scheduled-at"
                    className="mt-2"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createCampaignMutation.isPending}
              data-testid="button-create-campaign"
            >
              {createCampaignMutation.isPending ? "Creating..." : "Create Campaign"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
