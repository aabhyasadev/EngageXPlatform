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
    template: "",
    domain: "",
    contactGroup: "",
    subject: "",
    fromEmail: "",
    fromName: "",
    htmlContent: "",
    textContent: "",
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
        template: "",
        domain: "",
        contactGroup: "",
        subject: "",
        fromEmail: "",
        fromName: "",
        htmlContent: "",
        textContent: "",
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
      template: formData.template && formData.template !== "none" ? formData.template : null,
      domain: formData.domain && formData.domain !== "none" ? formData.domain : null,
      contact_group: formData.contactGroup && formData.contactGroup !== "none" ? formData.contactGroup : null,
      subject: formData.subject,
      from_email: formData.fromEmail,
      from_name: formData.fromName,
      html_content: formData.htmlContent,
      text_content: formData.textContent,
      status: formData.schedule === "now" ? "draft" : "scheduled",
      scheduled_at: formData.schedule === "later" ? new Date(formData.scheduledAt) : null,
    };

    createCampaignMutation.mutate(campaignData);
  };

  const verifiedDomains = domains?.filter((domain) => domain.status === 'verified') || [];

  // Handle template selection and auto-populate content
  const handleTemplateChange = (templateId: string) => {
    setFormData({ ...formData, template: templateId });
    
    if (templateId && templateId !== "none") {
      const selectedTemplate = templates?.find((t: any) => t.id === templateId);
      if (selectedTemplate) {
        setFormData({
          ...formData,
          template: templateId,
          subject: selectedTemplate.subject || formData.subject,
          htmlContent: selectedTemplate.html_content || formData.htmlContent,
          textContent: selectedTemplate.text_content || formData.textContent,
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campaign Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Campaign Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <div className="col-span-full">
                <Label htmlFor="template">Email Template</Label>
                <p className="text-sm text-muted-foreground mb-4">Choose from existing templates or start from scratch</p>
                
                {/* Quick Template Selection */}
                <div className="space-y-4">
                  {/* Quick Access Options */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={formData.template === "none" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleTemplateChange("none")}
                      className="flex items-center gap-2"
                      data-testid="select-no-template"
                    >
                      <i className="fas fa-plus w-4 h-4"></i>
                      Create from Scratch
                    </Button>
                    {(templates as any)?.slice(0, 3).map((template: any) => (
                      <Button
                        key={template.id}
                        type="button"
                        variant={formData.template === template.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleTemplateChange(template.id)}
                        className="flex items-center gap-2"
                        data-testid={`quick-select-template-${template.id}`}
                      >
                        <i className="fas fa-star w-4 h-4"></i>
                        {template.name}
                      </Button>
                    ))}
                  </div>
                  
                  {/* Template Grid */}
                  {(templates as any)?.length > 0 && (
                    <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(templates as any)?.map((template: any) => (
                          <div
                            key={template.id}
                            className={`relative p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                              formData.template === template.id
                                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                : 'border-border hover:border-primary/50'
                            }`}
                            onClick={() => handleTemplateChange(template.id)}
                            data-testid={`template-card-${template.id}`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between">
                                <h4 className="font-medium text-sm truncate">{template.name}</h4>
                                {template.category && (
                                  <span className="text-xs px-2 py-1 bg-muted rounded-full">
                                    {template.category}
                                  </span>
                                )}
                              </div>
                              
                              {template.subject && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {template.subject}
                                </p>
                              )}
                              
                              {/* Mini Preview */}
                              <div className="h-16 bg-muted/30 rounded text-xs p-2 overflow-hidden">
                                <div 
                                  dangerouslySetInnerHTML={{ 
                                    __html: template.html_content?.substring(0, 120) + '...' || 'No content preview' 
                                  }}
                                  className="text-muted-foreground leading-tight"
                                />
                              </div>
                              
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                  {template.isDefault ? (
                                    <i className="fas fa-star text-yellow-500 mr-1"></i>
                                  ) : (
                                    <i className="fas fa-clock mr-1"></i>
                                  )}
                                  {template.isDefault ? 'Default' : 'Custom'}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Preview functionality could be added here
                                  }}
                                >
                                  <i className="fas fa-eye w-3 h-3"></i>
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Selected Template Info */}
                  {formData.template && formData.template !== "none" && (
                    <div className="p-3 bg-muted/50 rounded-lg border-l-4 border-l-primary">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-check-circle text-green-600"></i>
                        <span className="font-medium text-sm">
                          Template Selected: {(templates as any)?.find((t: any) => t.id === formData.template)?.name}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Content and subject will be auto-populated from this template
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sending Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Sending Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="domain">Sending Domain</Label>
                <Select value={formData.domain} onValueChange={(value) => setFormData({ ...formData, domain: value })}>
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
                <Select value={formData.contactGroup} onValueChange={(value) => setFormData({ ...formData, contactGroup: value })}>
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
          </div>

          {/* Email Content */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Email Content</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Enter email subject"
                  data-testid="input-campaign-subject"
                />
              </div>
              <div>
                <Label htmlFor="fromName">From Name</Label>
                <Input
                  id="fromName"
                  value={formData.fromName}
                  onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                  placeholder="Your Organization Name"
                  data-testid="input-from-name"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="htmlContent">Email Content (HTML)</Label>
            <Textarea
              id="htmlContent"
              value={formData.htmlContent}
              onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
              placeholder="Enter HTML content for your email"
              rows={6}
              data-testid="textarea-html-content"
            />
          </div>

          <div>
            <Label htmlFor="textContent">Text Content (Optional)</Label>
            <Textarea
              id="textContent"
              value={formData.textContent}
              onChange={(e) => setFormData({ ...formData, textContent: e.target.value })}
              placeholder="Enter plain text version of your email"
              rows={4}
              data-testid="textarea-text-content"
            />
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
