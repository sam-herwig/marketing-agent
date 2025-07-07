'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Search, Edit, Trash2, Copy, Eye, Code } from 'lucide-react';
import { ContentBlock, getContentBlocks, createContentBlock, updateContentBlock, deleteContentBlock } from '@/lib/cms';
import { useToast } from '@/components/ui/use-toast';

interface ContentBlockLibraryProps {
  onSelectBlock?: (block: ContentBlock) => void;
  selectable?: boolean;
}

export function ContentBlockLibrary({ onSelectBlock, selectable = false }: ContentBlockLibraryProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ContentBlock | null>(null);
  const [showPreview, setShowPreview] = useState<number | null>(null);
  const { toast } = useToast();

  // Block editor state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    block_type: '',
    category: '',
    tags: [] as string[],
    is_active: true,
    is_public: false,
  });

  useEffect(() => {
    loadBlocks();
  }, []);

  const loadBlocks = async () => {
    try {
      setLoading(true);
      const data = await getContentBlocks({ include_public: true });
      setBlocks(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load content blocks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async () => {
    try {
      if (editingBlock) {
        const updated = await updateContentBlock(editingBlock.id, formData);
        setBlocks(blocks.map(b => b.id === updated.id ? updated : b));
        toast({ title: 'Success', description: 'Block updated successfully' });
      } else {
        const created = await createContentBlock({
          ...formData,
          variables: [],
        });
        setBlocks([created, ...blocks]);
        toast({ title: 'Success', description: 'Block created successfully' });
      }
      setShowEditor(false);
      resetForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save content block',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (blockId: number) => {
    if (!confirm('Are you sure you want to delete this content block?')) return;
    
    try {
      await deleteContentBlock(blockId);
      setBlocks(blocks.filter(b => b.id !== blockId));
      toast({ title: 'Success', description: 'Block deleted successfully' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete content block',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (block: ContentBlock) => {
    try {
      const duplicated = await createContentBlock({
        ...block,
        name: `${block.name} (Copy)`,
        is_public: false,
      });
      setBlocks([duplicated, ...blocks]);
      toast({ title: 'Success', description: 'Block duplicated successfully' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to duplicate content block',
        variant: 'destructive',
      });
    }
  };

  const openEditor = (block?: ContentBlock) => {
    if (block) {
      setEditingBlock(block);
      setFormData({
        name: block.name,
        description: block.description || '',
        content: block.content,
        block_type: block.block_type || '',
        category: block.category || '',
        tags: block.tags,
        is_active: block.is_active,
        is_public: block.is_public,
      });
    } else {
      resetForm();
    }
    setShowEditor(true);
  };

  const resetForm = () => {
    setEditingBlock(null);
    setFormData({
      name: '',
      description: '',
      content: '',
      block_type: '',
      category: '',
      tags: [],
      is_active: true,
      is_public: false,
    });
  };

  // Filter blocks
  const filteredBlocks = blocks.filter(block => {
    const matchesSearch = !searchQuery || 
      block.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      block.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedType === 'all' || block.block_type === selectedType;
    const matchesCategory = selectedCategory === 'all' || block.category === selectedCategory;
    
    return matchesSearch && matchesType && matchesCategory;
  });

  // Get unique block types and categories
  const blockTypes = Array.from(new Set(blocks.map(b => b.block_type).filter(Boolean)));
  const categories = Array.from(new Set(blocks.map(b => b.category).filter(Boolean)));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Content Block Library</CardTitle>
              <CardDescription>
                Reusable content blocks for your templates
              </CardDescription>
            </div>
            <Button onClick={() => openEditor()}>
              <Plus className="h-4 w-4 mr-2" />
              New Block
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search blocks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select 
              value={selectedType} 
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-48"
            >
              <option value="all">All Types</option>
              {blockTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </Select>
            <Select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-48"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </Select>
          </div>

          {/* Blocks Grid */}
          {loading ? (
            <div className="text-center py-8">Loading content blocks...</div>
          ) : filteredBlocks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No content blocks found
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBlocks.map((block) => (
                <Card key={block.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-base">{block.name}</CardTitle>
                        {block.description && (
                          <CardDescription className="text-sm mt-1">
                            {block.description}
                          </CardDescription>
                        )}
                      </div>
                      {block.is_public && (
                        <Badge variant="secondary" className="ml-2">Public</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Preview */}
                      <div className="bg-gray-50 rounded p-3 text-sm text-gray-600 max-h-24 overflow-hidden">
                        <pre className="whitespace-pre-wrap font-mono text-xs">
                          {block.content.substring(0, 150)}
                          {block.content.length > 150 && '...'}
                        </pre>
                      </div>

                      {/* Metadata */}
                      <div className="flex flex-wrap gap-1">
                        {block.block_type && (
                          <Badge variant="outline" className="text-xs">
                            {block.block_type}
                          </Badge>
                        )}
                        {block.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex justify-between items-center pt-2">
                        {selectable ? (
                          <Button
                            size="sm"
                            onClick={() => onSelectBlock?.(block)}
                            className="w-full"
                          >
                            Select Block
                          </Button>
                        ) : (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setShowPreview(block.id)}
                              title="Preview"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditor(block)}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDuplicate(block)}
                              title="Duplicate"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(block.id)}
                              title="Delete"
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Block Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingBlock ? 'Edit Content Block' : 'Create Content Block'}
            </DialogTitle>
            <DialogDescription>
              Create reusable content blocks for your templates
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="block-name">Name</Label>
                <Input
                  id="block-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Block name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="block-type">Type</Label>
                <Input
                  id="block-type"
                  value={formData.block_type}
                  onChange={(e) => setFormData({ ...formData, block_type: e.target.value })}
                  placeholder="e.g., header, footer, cta"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="block-description">Description</Label>
              <Input
                id="block-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="block-content">Content</Label>
              <Textarea
                id="block-content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Block content (HTML, text, or markdown)"
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Active</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_public}
                  onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Make Public</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowEditor(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateOrUpdate}>
                {editingBlock ? 'Update' : 'Create'} Block
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {showPreview && (
        <Dialog open={!!showPreview} onOpenChange={() => setShowPreview(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Block Preview</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded font-mono text-sm">
                {blocks.find(b => b.id === showPreview)?.content}
              </pre>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}