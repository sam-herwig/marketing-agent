'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  Upload, Search, Folder, Image, Video, FileText, Music, 
  MoreVertical, Download, Edit, Trash2, X, Check 
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MediaAsset, getMediaAssets, uploadMedia, updateMediaAsset, deleteMediaAsset } from '@/lib/cms';
import { useToast } from '@/components/ui/use-toast';

interface MediaGalleryProps {
  onSelectMedia?: (asset: MediaAsset) => void;
  selectable?: boolean;
  allowMultiple?: boolean;
  mediaType?: string;
}

export function MediaGallery({ 
  onSelectMedia, 
  selectable = false, 
  allowMultiple = false,
  mediaType 
}: MediaGalleryProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>(mediaType || 'all');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [selectedAssets, setSelectedAssets] = useState<Set<number>>(new Set());
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Edit dialog state
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    folder: '',
    tags: [] as string[],
  });

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (mediaType) params.media_type = mediaType;
      const data = await getMediaAssets(params);
      setAssets(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load media assets',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadPromises = Array.from(files).map(async (file) => {
      try {
        const result = await uploadMedia(file);
        return result;
      } catch (error) {
        toast({
          title: 'Upload Failed',
          description: `Failed to upload ${file.name}`,
          variant: 'destructive',
        });
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    const successful = results.filter(Boolean);
    
    if (successful.length > 0) {
      toast({
        title: 'Success',
        description: `Uploaded ${successful.length} file(s) successfully`,
      });
      loadAssets(); // Reload to show new assets
    }
    
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpdateAsset = async () => {
    if (!editingAsset) return;

    try {
      const updated = await updateMediaAsset(editingAsset.id, editForm);
      setAssets(assets.map(a => a.id === updated.id ? updated : a));
      toast({ title: 'Success', description: 'Media asset updated successfully' });
      setEditingAsset(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update media asset',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAsset = async (assetId: number) => {
    if (!confirm('Are you sure you want to delete this media asset?')) return;

    try {
      await deleteMediaAsset(assetId);
      setAssets(assets.filter(a => a.id !== assetId));
      toast({ title: 'Success', description: 'Media asset deleted successfully' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete media asset',
        variant: 'destructive',
      });
    }
  };

  const toggleAssetSelection = (assetId: number) => {
    const newSelection = new Set(selectedAssets);
    if (newSelection.has(assetId)) {
      newSelection.delete(assetId);
    } else {
      if (!allowMultiple) {
        newSelection.clear();
      }
      newSelection.add(assetId);
    }
    setSelectedAssets(newSelection);
  };

  const openEditDialog = (asset: MediaAsset) => {
    setEditingAsset(asset);
    setEditForm({
      name: asset.name,
      description: asset.description || '',
      folder: asset.folder || '',
      tags: asset.tags,
    });
  };

  // Filter assets
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = !searchQuery || 
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedType === 'all' || asset.media_type === selectedType;
    const matchesFolder = selectedFolder === 'all' || asset.folder === selectedFolder;
    
    return matchesSearch && matchesType && matchesFolder;
  });

  // Get unique folders
  const folders = Array.from(new Set(assets.map(a => a.folder).filter(Boolean)));

  // Get icon for media type
  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-8 w-8" />;
      case 'video': return <Video className="h-8 w-8" />;
      case 'document': return <FileText className="h-8 w-8" />;
      case 'audio': return <Music className="h-8 w-8" />;
      default: return <FileText className="h-8 w-8" />;
    }
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Media Gallery</CardTitle>
              <CardDescription>
                Manage your images, videos, and documents
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {selectable && selectedAssets.size > 0 && (
                <Button 
                  onClick={() => {
                    const selected = assets.filter(a => selectedAssets.has(a.id));
                    if (allowMultiple) {
                      selected.forEach(asset => onSelectMedia?.(asset));
                    } else {
                      onSelectMedia?.(selected[0]);
                    }
                  }}
                >
                  Select {selectedAssets.size} Item{selectedAssets.size > 1 ? 's' : ''}
                </Button>
              )}
              <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search media..."
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
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="document">Documents</option>
              <option value="audio">Audio</option>
              <option value="other">Other</option>
            </Select>
            <Select 
              value={selectedFolder} 
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="w-48"
            >
              <option value="all">All Folders</option>
              {folders.map(folder => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
            </Select>
          </div>

          {/* Media Grid */}
          {loading ? (
            <div className="text-center py-8">Loading media assets...</div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No media assets found
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className={`
                    relative group cursor-pointer rounded-lg border-2 transition-all
                    ${selectedAssets.has(asset.id) 
                      ? 'border-2' 
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                  style={selectedAssets.has(asset.id) ? {
                    borderColor: 'var(--status-scheduled-text)',
                    backgroundColor: 'var(--status-scheduled-bg)'
                  } : {}}
                  onClick={() => selectable && toggleAssetSelection(asset.id)}
                >
                  {/* Selection Indicator */}
                  {selectable && (
                    <div className={`
                      absolute top-2 left-2 w-5 h-5 rounded-full border-2 bg-white
                      flex items-center justify-center transition-all z-10
                      ${selectedAssets.has(asset.id) 
                        ? '' 
                        : 'border-gray-300'
                      }
                    `}
                    style={selectedAssets.has(asset.id) ? {
                      borderColor: 'var(--status-scheduled-text)',
                      backgroundColor: 'var(--status-scheduled-text)'
                    } : {}}>
                      {selectedAssets.has(asset.id) && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </div>
                  )}

                  {/* Media Preview */}
                  <div className="aspect-square p-4 flex items-center justify-center bg-gray-50">
                    {asset.media_type === 'image' ? (
                      <img
                        src={asset.file_url}
                        alt={asset.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-gray-400">
                        {getMediaIcon(asset.media_type)}
                      </div>
                    )}
                  </div>

                  {/* Asset Info */}
                  <div className="p-2">
                    <p className="text-sm font-medium truncate">{asset.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(asset.file_size)}
                    </p>
                  </div>

                  {/* Actions Menu */}
                  {!selectable && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => window.open(asset.file_url, '_blank')}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(asset)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteAsset(asset.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingAsset} onOpenChange={() => setEditingAsset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Media Asset</DialogTitle>
            <DialogDescription>
              Update the metadata for this media asset
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="asset-name">Name</Label>
              <Input
                id="asset-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset-description">Description</Label>
              <Input
                id="asset-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Brief description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset-folder">Folder</Label>
              <Input
                id="asset-folder"
                value={editForm.folder}
                onChange={(e) => setEditForm({ ...editForm, folder: e.target.value })}
                placeholder="e.g., campaigns/summer-2024"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setEditingAsset(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateAsset}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}