import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { RichEditor } from "@/components/templates/rich-editor";
import { EmailTemplate, InsertEmailTemplate } from "@shared/schema";
import { 
  FileText, 
  Search, 
  Filter,
  Plus,
  Eye,
  Edit,
  Copy,
  Trash2,
  Star,
  Mail,
  Zap,
  Megaphone,
  Tag,
  Clock,
  Settings,
  Globe
} from "lucide-react";

export default function Templates() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    subject: "",
    htmlContent: "",
    textContent: "",
    category: "marketing",
    isDefault: false,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/templates"],
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: any) => {
      const response = await apiRequest("POST", "/api/templates", templateData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Template created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setShowCreateModal(false);
      setNewTemplate({
        name: "",
        subject: "",
        htmlContent: "",
        textContent: "",
        category: "marketing",
        isDefault: false,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create template",
        variant: "destructive",
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, templateData }: { id: string; templateData: Partial<InsertEmailTemplate> }) => {
      // Only send allowed fields to prevent mutation of immutable fields
      const safeData = {
        name: templateData.name,
        subject: templateData.subject,
        htmlContent: templateData.htmlContent,
        textContent: templateData.textContent,
        category: templateData.category,
        isDefault: templateData.isDefault,
      };
      const response = await apiRequest("PUT", `/api/templates/${id}`, safeData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Template updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setShowEditModal(false);
      setSelectedTemplate(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update template",
        variant: "destructive",
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      await apiRequest("DELETE", `/api/templates/${templateId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Template deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete template",
        variant: "destructive",
      });
    },
  });

  const filteredTemplates = (templates as any)?.filter((template: any) => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.subject?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  const categories = [
    { value: "marketing", label: "Marketing" },
    { value: "transactional", label: "Transactional" },
    { value: "newsletter", label: "Newsletter" },
    { value: "promotional", label: "Promotional" },
    { value: "announcement", label: "Announcement" },
  ];

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'marketing': return 'bg-blue-100 text-blue-800';
      case 'transactional': return 'bg-green-100 text-green-800';
      case 'newsletter': return 'bg-purple-100 text-purple-800';
      case 'promotional': return 'bg-yellow-100 text-yellow-800';
      case 'announcement': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplate.name || !newTemplate.htmlContent) {
      toast({
        title: "Validation Error",
        description: "Name and HTML content are required",
        variant: "destructive",
      });
      return;
    }
    createTemplateMutation.mutate(newTemplate);
  };

  const handleEditTemplate = (template: any) => {
    setSelectedTemplate({ ...template });
    setShowEditModal(true);
  };

  const handleUpdateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate?.name || !selectedTemplate?.htmlContent) {
      toast({
        title: "Validation Error",
        description: "Name and HTML content are required",
        variant: "destructive",
      });
      return;
    }
    updateTemplateMutation.mutate({
      id: selectedTemplate.id,
      templateData: selectedTemplate
    });
  };

  const handlePreviewTemplate = (template: any) => {
    setSelectedTemplate(template);
    setShowPreviewModal(true);
  };

  const handleDuplicateTemplate = async (template: any) => {
    const duplicatedTemplate = {
      ...template,
      name: `${template.name} (Copy)`,
      isDefault: false
    };
    delete duplicatedTemplate.id;
    delete duplicatedTemplate.createdAt;
    delete duplicatedTemplate.updatedAt;
    
    createTemplateMutation.mutate(duplicatedTemplate);
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
          <h2 className="text-2xl font-semibold text-foreground">Templates</h2>
          <p className="text-sm text-muted-foreground">
            Design and organize your email templates.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} data-testid="button-new-template">
          <i className="fas fa-plus mr-2"></i>
          New Template
        </Button>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="relative overflow-hidden border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground" data-testid="text-total-templates">
                  {(templates as any)?.length || 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Total Templates</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground" data-testid="text-marketing-templates">
                  {(templates as any)?.filter((t: any) => t.category === 'marketing').length || 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Marketing</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                <Megaphone className="h-6 w-6 text-green-600 dark:text-green-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground" data-testid="text-transactional-templates">
                  {(templates as any)?.filter((t: any) => t.category === 'transactional').length || 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Transactional</p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
                <Zap className="h-6 w-6 text-purple-600 dark:text-purple-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-orange-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground" data-testid="text-default-templates">
                  {(templates as any)?.filter((t: any) => t.isDefault).length || 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Default Templates</p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
                <Star className="h-6 w-6 text-orange-600 dark:text-orange-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates by name or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-templates"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48" data-testid="select-category-filter">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
          </span>
          {selectedCategory !== "all" && (
            <Badge variant="secondary" className="capitalize">
              {categories.find(c => c.value === selectedCategory)?.label}
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-auto p-0 text-xs"
                onClick={() => setSelectedCategory("all")}
              >
                ×
              </Button>
            </Badge>
          )}
          {searchTerm && (
            <Badge variant="secondary">
              "{searchTerm}"
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-auto p-0 text-xs"
                onClick={() => setSearchTerm("")}
              >
                ×
              </Button>
            </Badge>
          )}
        </div>
      </div>

      {/* Enhanced Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template: any) => (
          <Card key={template.id} className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-1 border-l-4 border-l-transparent hover:border-l-primary">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg leading-tight truncate" data-testid={`text-template-name-${template.id}`}>
                    {template.name}
                  </CardTitle>
                  {template.subject && (
                    <CardDescription className="mt-1 line-clamp-2">
                      {template.subject}
                    </CardDescription>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePreviewTemplate(template)}
                    className="opacity-60 hover:opacity-100 transition-opacity"
                    data-testid={`button-preview-template-${template.id}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditTemplate(template)}
                    className="opacity-60 hover:opacity-100 transition-opacity"
                    data-testid={`button-edit-template-${template.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicateTemplate(template)}
                    className="opacity-60 hover:opacity-100 transition-opacity"
                    data-testid={`button-duplicate-template-${template.id}`}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteTemplateMutation.mutate(template.id)}
                    disabled={deleteTemplateMutation.isPending}
                    className="opacity-60 hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    data-testid={`button-delete-template-${template.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {/* Category and Status Badges */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {template.category === 'marketing' && <Megaphone className="h-3 w-3 text-blue-600" />}
                    {template.category === 'transactional' && <Zap className="h-3 w-3 text-green-600" />}
                    {template.category === 'newsletter' && <Mail className="h-3 w-3 text-purple-600" />}
                    {template.category === 'promotional' && <Tag className="h-3 w-3 text-yellow-600" />}
                    {template.category === 'announcement' && <Globe className="h-3 w-3 text-red-600" />}
                    <Badge variant="secondary" className="capitalize text-xs">
                      {categories.find(c => c.value === template.category)?.label || template.category}
                    </Badge>
                  </div>
                  {template.isDefault && (
                    <Badge variant="outline" className="text-xs">
                      <Star className="h-3 w-3 mr-1" />
                      Default
                    </Badge>
                  )}
                </div>
                
                {/* Enhanced Preview */}
                <div className="group/preview relative h-32 bg-gradient-to-br from-muted/50 to-muted rounded-lg border overflow-hidden cursor-pointer" onClick={() => handlePreviewTemplate(template)}>
                  <div className="absolute inset-0 bg-white/90 dark:bg-gray-900/90">
                    <div 
                      className="h-full w-full text-xs p-3 overflow-hidden leading-relaxed"
                      dangerouslySetInnerHTML={{ 
                        __html: template.htmlContent?.substring(0, 180) + '...' || '<div class="flex items-center justify-center h-full text-muted-foreground">No content</div>' 
                      }}
                    />
                  </div>
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
                      <Eye className="h-3 w-3 mr-1 inline" />
                      Preview
                    </div>
                  </div>
                </div>
                
                {/* Footer */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(template.createdAt).toLocaleDateString()}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                    data-testid={`button-use-template-${template.id}`}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Use Template
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredTemplates.length === 0 && (
          <div className="col-span-full text-center py-16">
            <div className="mx-auto max-w-sm">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm || selectedCategory !== "all" ? "No templates found" : "No templates yet"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || selectedCategory !== "all" ? 
                  "Try adjusting your search or filters to find what you're looking for." : 
                  "Create your first email template to get started with your campaigns!"
                }
              </p>
              {!searchTerm && selectedCategory === "all" && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Template Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  placeholder="Enter template name"
                  required
                  data-testid="input-template-name"
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={newTemplate.category} 
                  onValueChange={(value) => setNewTemplate({ ...newTemplate, category: value })}
                >
                  <SelectTrigger data-testid="select-template-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="subject">Default Subject Line</Label>
              <Input
                id="subject"
                value={newTemplate.subject}
                onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                placeholder="Enter default subject line"
                data-testid="input-template-subject"
              />
            </div>

            <div>
              <Label htmlFor="htmlContent">HTML Content *</Label>
              <RichEditor
                value={newTemplate.htmlContent}
                onChange={(value) => setNewTemplate({ ...newTemplate, htmlContent: value })}
                placeholder="Design your email template with rich text formatting..."
                className="min-h-[300px]"
                data-testid="rich-editor-template-html"
              />
            </div>

            <div>
              <Label htmlFor="textContent">Text Content</Label>
              <Textarea
                id="textContent"
                value={newTemplate.textContent}
                onChange={(e) => setNewTemplate({ ...newTemplate, textContent: e.target.value })}
                placeholder="Enter plain text version"
                rows={6}
                data-testid="textarea-template-text"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-6 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createTemplateMutation.isPending}
                data-testid="button-save-template"
              >
                {createTemplateMutation.isPending ? "Creating..." : "Create Template"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Template Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleUpdateTemplate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="editName">Template Name *</Label>
                <Input
                  id="editName"
                  value={selectedTemplate?.name || ""}
                  onChange={(e) => setSelectedTemplate(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="Enter template name"
                  required
                  data-testid="input-edit-template-name"
                />
              </div>
              <div>
                <Label htmlFor="editCategory">Category</Label>
                <Select 
                  value={selectedTemplate?.category || "marketing"} 
                  onValueChange={(value) => setSelectedTemplate(prev => prev ? { ...prev, category: value } : null)}
                >
                  <SelectTrigger data-testid="select-edit-template-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="editSubject">Default Subject Line</Label>
              <Input
                id="editSubject"
                value={selectedTemplate?.subject || ""}
                onChange={(e) => setSelectedTemplate(prev => prev ? { ...prev, subject: e.target.value } : null)}
                placeholder="Enter default subject line"
                data-testid="input-edit-template-subject"
              />
            </div>

            <div>
              <Label htmlFor="editHtmlContent">HTML Content *</Label>
              <RichEditor
                value={selectedTemplate?.htmlContent || ""}
                onChange={(value) => setSelectedTemplate(prev => prev ? { ...prev, htmlContent: value } : null)}
                placeholder="Design your email template with rich text formatting..."
                className="min-h-[300px]"
                data-testid="rich-editor-edit-template-html"
              />
            </div>

            <div>
              <Label htmlFor="editTextContent">Text Content</Label>
              <Textarea
                id="editTextContent"
                value={selectedTemplate?.textContent || ""}
                onChange={(e) => setSelectedTemplate(prev => prev ? { ...prev, textContent: e.target.value } : null)}
                placeholder="Enter plain text version"
                rows={6}
                data-testid="textarea-edit-template-text"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-6 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateTemplateMutation.isPending}
                data-testid="button-update-template"
              >
                {updateTemplateMutation.isPending ? "Updating..." : "Update Template"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Template Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Template: {selectedTemplate?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Template Info */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <h3 className="font-semibold">{selectedTemplate?.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Category: {selectedTemplate?.category} • 
                  Subject: {selectedTemplate?.subject || "No subject"}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className={getCategoryColor(selectedTemplate?.category || "")}>
                  {selectedTemplate?.category}
                </Badge>
                {selectedTemplate?.isDefault && (
                  <Badge variant="outline">Default</Badge>
                )}
              </div>
            </div>

            {/* HTML Preview */}
            <div>
              <Label>HTML Preview</Label>
              <div className="border rounded-lg p-4 bg-white min-h-[400px] max-h-[600px] overflow-y-auto">
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: selectedTemplate?.htmlContent || '<p>No HTML content</p>' 
                  }}
                />
              </div>
            </div>

            {/* Text Version */}
            {selectedTemplate?.textContent && (
              <div>
                <Label>Text Version</Label>
                <div className="border rounded-lg p-4 bg-muted min-h-[200px] max-h-[300px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-mono text-sm">
                    {selectedTemplate.textContent}
                  </pre>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-6 border-t border-border">
              <Button variant="outline" onClick={() => setShowPreviewModal(false)}>
                Close
              </Button>
              <Button onClick={() => {
                handleEditTemplate(selectedTemplate);
                setShowPreviewModal(false);
              }}>
                <i className="fas fa-edit mr-2"></i>
                Edit Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
