'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Smartphone, Monitor, Mail, MessageSquare } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { previewTemplate, ContentTemplate, TemplateVariable } from '@/lib/cms';
import { useToast } from '@/components/ui/use-toast';
import { createSafeHtml, sanitizeUserInput } from '@/lib/sanitize';

interface TemplatePreviewProps {
  template?: ContentTemplate;
  content?: string;
  variables?: TemplateVariable[];
  onVariableChange?: (variables: Record<string, any>) => void;
}

export function TemplatePreview({ 
  template, 
  content, 
  variables = [],
  onVariableChange 
}: TemplatePreviewProps) {
  const [variableValues, setVariableValues] = useState<Record<string, any>>({});
  const [previewContent, setPreviewContent] = useState('');
  const [missingVariables, setMissingVariables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [deviceView, setDeviceView] = useState<'desktop' | 'mobile'>('desktop');
  const { toast } = useToast();

  // Initialize variable values with defaults
  useEffect(() => {
    const initialValues: Record<string, any> = {};
    const templateVars = template?.variables || variables;
    
    templateVars.forEach(v => {
      initialValues[v.name] = v.default || '';
    });
    
    setVariableValues(initialValues);
  }, [template, variables]);

  // Load preview whenever content or variables change
  useEffect(() => {
    if (template?.id || content) {
      loadPreview();
    }
  }, [template, content, variableValues]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      const response = await previewTemplate({
        template_id: template?.id,
        content: content || template?.content,
        variables: variableValues,
      });
      
      setPreviewContent(response.rendered_content);
      setMissingVariables(response.missing_variables);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load preview',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVariableChange = (name: string, value: string) => {
    const newValues = { ...variableValues, [name]: value };
    setVariableValues(newValues);
    onVariableChange?.(newValues);
  };

  const getContentTypeIcon = () => {
    switch (template?.content_type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'social_media':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const renderPreviewFrame = () => {
    const frameClasses = deviceView === 'mobile' 
      ? 'w-[375px] h-[667px] mx-auto border-8 border-gray-800 rounded-[2.5rem] overflow-hidden' 
      : 'w-full h-full';

    if (template?.content_type === 'email') {
      return (
        <div className={frameClasses}>
          <div className="bg-white h-full overflow-auto">
            {/* Email Header */}
            <div className="bg-gray-100 p-4 border-b">
              <div className="text-sm text-gray-600">From: noreply@company.com</div>
              <div className="text-sm text-gray-600">To: customer@example.com</div>
              <div className="font-semibold mt-1">{template.subject || 'Email Subject'}</div>
            </div>
            {/* Email Body */}
            <div className="p-6">
              <div dangerouslySetInnerHTML={createSafeHtml(previewContent)} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={frameClasses}>
        <div className="bg-white h-full overflow-auto p-6">
          <div dangerouslySetInnerHTML={createSafeHtml(previewContent)} />
        </div>
      </div>
    );
  };

  const templateVars = template?.variables || variables;

  return (
    <div className="space-y-6">
      {/* Variable Inputs */}
      {templateVars.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Template Variables</CardTitle>
            <CardDescription>
              Fill in the variables to see how your template will look
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templateVars.map((variable) => (
                <div key={variable.name} className="space-y-2">
                  <Label htmlFor={`var-${variable.name}`}>
                    {variable.name}
                    {variable.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <Input
                    id={`var-${variable.name}`}
                    value={variableValues[variable.name] || ''}
                    onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                    placeholder={variable.description || `Enter ${variable.name}`}
                  />
                </div>
              ))}
            </div>

            {missingVariables.length > 0 && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Missing variables: {missingVariables.join(', ')}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Preview</CardTitle>
              {getContentTypeIcon()}
              {template?.content_type && (
                <Badge variant="outline">{template.content_type}</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={deviceView === 'desktop' ? 'default' : 'outline'}
                onClick={() => setDeviceView('desktop')}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={deviceView === 'mobile' ? 'default' : 'outline'}
                onClick={() => setDeviceView('mobile')}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Loading preview...
            </div>
          ) : previewContent ? (
            <div className="bg-gray-100 p-4 rounded-lg min-h-[400px] flex items-center justify-center">
              {renderPreviewFrame()}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No content to preview
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Info */}
      {template && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Template Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="mt-1 text-sm">{sanitizeUserInput(template.name)}</dd>
              </div>
              {template.description && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Description</dt>
                  <dd className="mt-1 text-sm">{sanitizeUserInput(template.description)}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Category</dt>
                <dd className="mt-1 text-sm">{sanitizeUserInput(template.category || 'Uncategorized')}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <Badge variant={template.is_active ? 'default' : 'secondary'}>
                    {template.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </dd>
              </div>
              {template.tags.length > 0 && (
                <div className="md:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Tags</dt>
                  <dd className="mt-1 flex flex-wrap gap-2">
                    {template.tags.map((tag, index) => (
                      <Badge key={index} variant="outline">{sanitizeUserInput(tag)}</Badge>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}