'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FileText, Puzzle, Image, Plus } from 'lucide-react';
import { TemplateEditor } from '@/components/cms/TemplateEditor';
import { ContentBlockLibrary } from '@/components/cms/ContentBlockLibrary';
import { MediaGallery } from '@/components/cms/MediaGallery';
import { TemplatePreview } from '@/components/cms/TemplatePreview';
import { 
  ContentTemplate, 
  ContentTemplateWithBlocks,
  getTemplates, 
  getTemplate,
  createTemplate, 
  updateTemplate, 
  deleteTemplate 
} from '@/lib/cms';
import { useToast } from '@/components/ui/use-toast';

export default function CMSPage() {
  const [activeTab, setActiveTab] = useState('templates');
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ContentTemplateWithBlocks | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContentTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (activeTab === 'templates') {
      loadTemplates();
    }
  }, [activeTab]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await getTemplates();
      setTemplates(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setShowTemplateEditor(true);
  };

  const handleEditTemplate = async (template: ContentTemplate) => {
    try {
      const fullTemplate = await getTemplate(template.id);
      setEditingTemplate(fullTemplate);
      setShowTemplateEditor(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load template details',
        variant: 'destructive',
      });
    }
  };

  const handleSaveTemplate = async (templateData: Partial<ContentTemplate>) => {
    try {
      if (editingTemplate) {
        const updated = await updateTemplate(editingTemplate.id, templateData);
        setTemplates(templates.map(t => t.id === updated.id ? updated : t));
        toast({ title: 'Success', description: 'Template updated successfully' });
      } else {
        const created = await createTemplate(templateData as any);
        setTemplates([created, ...templates]);
        toast({ title: 'Success', description: 'Template created successfully' });
      }
      setShowTemplateEditor(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save template',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await deleteTemplate(templateId);
      setTemplates(templates.filter(t => t.id !== templateId));
      toast({ title: 'Success', description: 'Template deleted successfully' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        variant: 'destructive',
      });
    }
  };

  const handlePreviewTemplate = async (template: ContentTemplate) => {
    try {
      const fullTemplate = await getTemplate(template.id);
      setSelectedTemplate(fullTemplate);
      setShowPreview(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load template for preview',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Content Management</h1>
        <p className="text-muted-foreground">
          Create and manage templates, content blocks, and media assets for your campaigns
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="blocks" className="flex items-center gap-2">
            <Puzzle className="h-4 w-4" />
            Blocks
          </TabsTrigger>
          <TabsTrigger value="media" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Media
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Content Templates</CardTitle>
                  <CardDescription>
                    Create reusable templates for emails, social media posts, and more
                  </CardDescription>
                </div>
                <Button onClick={handleCreateTemplate}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading templates...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No templates found. Create your first template to get started.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template) => (
                    <Card key={template.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                            {template.description && (
                              <CardDescription className="text-sm mt-1">
                                {template.description}
                              </CardDescription>
                            )}
                          </div>
                          <span className={`
                            px-2 py-1 text-xs rounded-full
                            ${template.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                            }
                          `}>
                            {template.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <FileText className="h-4 w-4" />
                            <span className="capitalize">{template.content_type.replace('_', ' ')}</span>
                          </div>
                          {template.variables.length > 0 && (
                            <div className="text-sm text-gray-500">
                              {template.variables.length} variable{template.variables.length > 1 ? 's' : ''}
                            </div>
                          )}
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePreviewTemplate(template)}
                            >
                              Preview
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditTemplate(template)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteTemplate(template.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocks">
          <ContentBlockLibrary />
        </TabsContent>

        <TabsContent value="media">
          <MediaGallery />
        </TabsContent>
      </Tabs>

      {/* Template Editor Dialog */}
      <Dialog open={showTemplateEditor} onOpenChange={setShowTemplateEditor}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <TemplateEditor
            template={editingTemplate || undefined}
            onSave={handleSaveTemplate}
            onCancel={() => setShowTemplateEditor(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Template Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedTemplate && (
            <TemplatePreview template={selectedTemplate} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}