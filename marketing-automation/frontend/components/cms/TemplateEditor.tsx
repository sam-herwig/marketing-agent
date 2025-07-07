'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Plus, X, Eye, Code, Save } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ContentTemplate, TemplateVariable, extractTemplateVariables } from '@/lib/cms';
import { createSafeHtml } from '@/lib/sanitize';

interface TemplateEditorProps {
  template?: ContentTemplate;
  onSave: (template: Partial<ContentTemplate>) => void;
  onCancel: () => void;
}

export function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    content_type: template?.content_type || 'general',
    subject: template?.subject || '',
    content: template?.content || '',
    preview_text: template?.preview_text || '',
    category: template?.category || '',
    tags: template?.tags || [],
    is_active: template?.is_active ?? true,
    is_public: template?.is_public ?? false,
  });

  const [variables, setVariables] = useState<TemplateVariable[]>(template?.variables || []);
  const [newTag, setNewTag] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewMode, setPreviewMode] = useState<'source' | 'preview'>('source');

  // Extract variables from content
  useEffect(() => {
    const extractedVars = extractTemplateVariables(formData.content);
    const existingVarNames = variables.map(v => v.name);
    
    // Add new variables that were found
    const newVars = extractedVars
      .filter(varName => !existingVarNames.includes(varName))
      .map(varName => ({
        name: varName,
        description: '',
        default: '',
        required: false,
      }));
    
    if (newVars.length > 0) {
      setVariables([...variables, ...newVars]);
    }
    
    // Remove variables that are no longer in the content
    const updatedVars = variables.filter(v => extractedVars.includes(v.name));
    if (updatedVars.length !== variables.length) {
      setVariables(updatedVars);
    }
  }, [formData.content]);

  const handleInputChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handleVariableUpdate = (index: number, field: keyof TemplateVariable, value: any) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], [field]: value };
    setVariables(updated);
  };

  const handleAddTag = () => {
    if (newTag && !formData.tags.includes(newTag)) {
      handleInputChange('tags', [...formData.tags, newTag]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    handleInputChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Template name is required';
    }
    
    if (!formData.content.trim()) {
      newErrors.content = 'Template content is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSave({
        ...formData,
        variables,
      });
    }
  };

  const renderPreview = () => {
    // Create sample variables for preview
    const sampleVariables: Record<string, string> = {};
    variables.forEach(v => {
      sampleVariables[v.name] = v.default || `[${v.name}]`;
    });
    
    let previewContent = formData.content;
    Object.entries(sampleVariables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      previewContent = previewContent.replace(regex, value);
    });
    
    return previewContent;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{template ? 'Edit Template' : 'Create Template'}</CardTitle>
          <CardDescription>
            Create reusable content templates with dynamic variables
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name*</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Welcome Email"
              />
              {errors.name && (
                <p className="text-sm" style={{ color: 'var(--status-failed-text)' }}>{errors.name}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="content_type">Content Type</Label>
              <Select
                id="content_type"
                value={formData.content_type}
                onChange={(e) => handleInputChange('content_type', e.target.value)}
                className="w-full"
              >
                <option value="general">General</option>
                <option value="email">Email</option>
                <option value="social_media">Social Media</option>
                <option value="blog">Blog</option>
                <option value="landing_page">Landing Page</option>
                <option value="sms">SMS</option>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe what this template is for..."
              rows={2}
            />
          </div>

          {formData.content_type === 'email' && (
            <div className="space-y-2">
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                placeholder="e.g., Welcome to {{company_name}}!"
              />
            </div>
          )}

          {/* Content Editor */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="content">Content*</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={previewMode === 'source' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewMode('source')}
                >
                  <Code className="h-4 w-4 mr-1" />
                  Source
                </Button>
                <Button
                  type="button"
                  variant={previewMode === 'preview' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewMode('preview')}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
              </div>
            </div>
            
            <Tabs value={previewMode} className="w-full">
              <TabsContent value="source" className="mt-2">
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => handleInputChange('content', e.target.value)}
                  placeholder="Enter your template content. Use {{variable_name}} for dynamic variables."
                  rows={10}
                  className="font-mono text-sm"
                />
              </TabsContent>
              <TabsContent value="preview" className="mt-2">
                <div className="border rounded-md p-4 min-h-[240px] theme-surface">
                  <div dangerouslySetInnerHTML={createSafeHtml(renderPreview())} />
                </div>
              </TabsContent>
            </Tabs>
            {errors.content && (
              <p className="text-sm" style={{ color: 'var(--status-failed-text)' }}>{errors.content}</p>
            )}
          </div>

          {/* Variables */}
          {variables.length > 0 && (
            <div className="space-y-2">
              <Label>Template Variables</Label>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Variables found in your template. Configure default values and descriptions.
                </AlertDescription>
              </Alert>
              <div className="space-y-3">
                {variables.map((variable, index) => (
                  <div key={variable.name} className="flex gap-3 items-start">
                    <div className="flex-1 grid grid-cols-4 gap-3">
                      <div>
                        <Input
                          value={variable.name}
                          disabled
                          className="font-mono"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          value={variable.description}
                          onChange={(e) => handleVariableUpdate(index, 'description', e.target.value)}
                          placeholder="Description"
                        />
                      </div>
                      <div>
                        <Input
                          value={variable.default}
                          onChange={(e) => handleVariableUpdate(index, 'default', e.target.value)}
                          placeholder="Default value"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add a tag"
              />
              <Button type="button" onClick={handleAddTag} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1"
                    style={{ 
                      transition: 'color 0.2s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--status-failed-text)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Additional Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                placeholder="e.g., Marketing, Transactional"
              />
            </div>
            
            <div className="flex items-center space-x-4 pt-8">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => handleInputChange('is_active', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Active</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_public}
                  onChange={(e) => handleInputChange('is_public', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Public</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit}>
              <Save className="h-4 w-4 mr-2" />
              {template ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}