'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Plus, Trash2, Eye, EyeOff, Download, Move, Type, Palette } from 'lucide-react'
import { imageApi } from '@/lib/api'
import TextLayerControls from './TextLayerControls'
import DraggableTextLayer from './DraggableTextLayer'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

export interface TextLayer {
  id: string
  text: string
  position: [number, number]
  font_size: number
  font_color: string
  font_style: 'regular' | 'bold'
  alignment: 'left' | 'center' | 'right'
  shadow: boolean
  shadow_color: string
  shadow_offset: [number, number]
  outline: boolean
  outline_color: string
  outline_width: number
  background_box: boolean
  background_color: string
  background_opacity: number
  visible: boolean
}

interface TextOverlayEditorV2Props {
  imageUrl: string
  onSave?: (imageData: string, textLayers: TextLayer[]) => void
  initialLayers?: TextLayer[]
}

export default function TextOverlayEditorV2({ 
  imageUrl, 
  onSave,
  initialLayers = []
}: TextOverlayEditorV2Props) {
  const { toast } = useToast()
  const [textLayers, setTextLayers] = useState<TextLayer[]>(initialLayers)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string>(imageUrl)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const [textStyles, setTextStyles] = useState<any>({})
  const [isDragging, setIsDragging] = useState(false)
  const [dragLayerId, setDragLayerId] = useState<string | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 1024, height: 1024 })

  // Load text styles
  useEffect(() => {
    imageApi.getTextStyles().then(response => {
      setTextStyles(response.data.styles)
    }).catch(error => {
      console.error('Failed to load text styles:', error)
    })
  }, [])

  // Load image dimensions
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height })
    }
    img.src = imageUrl
  }, [imageUrl])

  // Generate preview
  const generatePreview = useCallback(async () => {
    if (textLayers.length === 0 || !imageUrl) {
      setPreviewImage(imageUrl)
      return
    }

    setIsProcessing(true)
    try {
      const visibleLayers = textLayers.filter(layer => layer.visible)
      if (visibleLayers.length === 0) {
        setPreviewImage(imageUrl)
        return
      }

      const response = await imageApi.addTextOverlay({
        image_url: imageUrl,
        text_overlays: visibleLayers.map(layer => ({
          text: layer.text,
          position: layer.position,
          font_size: layer.font_size,
          font_color: layer.font_color,
          font_style: layer.font_style,
          alignment: layer.alignment,
          shadow: layer.shadow,
          shadow_color: layer.shadow_color,
          shadow_offset: layer.shadow_offset,
          outline: layer.outline,
          outline_color: layer.outline_color,
          outline_width: layer.outline_width,
          background_box: layer.background_box,
          background_color: layer.background_color,
          background_opacity: layer.background_opacity
        }))
      })

      setPreviewImage(response.data.image_data)
    } catch (error) {
      console.error('Failed to generate preview:', error)
      toast({
        title: 'Error',
        description: 'Failed to generate preview',
        variant: 'destructive'
      })
    } finally {
      setIsProcessing(false)
    }
  }, [textLayers, imageUrl, toast])

  // Debounced preview generation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isDragging) {
        generatePreview()
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [textLayers, generatePreview, isDragging])

  // Add new text layer
  const addTextLayer = () => {
    const newLayer: TextLayer = {
      id: Date.now().toString(),
      text: 'New Text',
      position: [imageSize.width / 2, imageSize.height / 2],
      font_size: 48,
      font_color: '#FFFFFF',
      font_style: 'bold',
      alignment: 'center',
      shadow: true,
      shadow_color: '#000000',
      shadow_offset: [2, 2],
      outline: false,
      outline_color: '#000000',
      outline_width: 2,
      background_box: false,
      background_color: '#000000',
      background_opacity: 128,
      visible: true
    }
    setTextLayers([...textLayers, newLayer])
    setSelectedLayerId(newLayer.id)
  }

  // Update text layer
  const updateTextLayer = (id: string, updates: Partial<TextLayer>) => {
    setTextLayers(layers => 
      layers.map(layer => 
        layer.id === id ? { ...layer, ...updates } : layer
      )
    )
  }

  // Delete text layer
  const deleteTextLayer = (id: string) => {
    setTextLayers(layers => layers.filter(layer => layer.id !== id))
    if (selectedLayerId === id) {
      setSelectedLayerId(null)
    }
  }

  // Toggle layer visibility
  const toggleLayerVisibility = (id: string) => {
    setTextLayers(layers =>
      layers.map(layer =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer
      )
    )
  }

  // Apply style preset
  const applyStylePreset = (layerId: string, styleName: string) => {
    const style = textStyles[styleName]
    if (!style) return

    updateTextLayer(layerId, style)
  }

  // Add marketing layout
  const addMarketingLayout = () => {
    const headline: TextLayer = {
      id: Date.now().toString(),
      text: 'HEADLINE HERE',
      position: [imageSize.width / 2, imageSize.height * 0.2],
      font_size: 72,
      font_color: '#FFFFFF',
      font_style: 'bold',
      alignment: 'center',
      shadow: true,
      shadow_color: '#000000',
      shadow_offset: [3, 3],
      outline: false,
      outline_color: '#000000',
      outline_width: 2,
      background_box: false,
      background_color: '#000000',
      background_opacity: 128,
      visible: true
    }

    const subtext: TextLayer = {
      id: (Date.now() + 1).toString(),
      text: 'Your subtext goes here',
      position: [imageSize.width / 2, imageSize.height * 0.35],
      font_size: 36,
      font_color: '#EEEEEE',
      font_style: 'regular',
      alignment: 'center',
      shadow: false,
      shadow_color: '#000000',
      shadow_offset: [2, 2],
      outline: false,
      outline_color: '#000000',
      outline_width: 2,
      background_box: false,
      background_color: '#000000',
      background_opacity: 128,
      visible: true
    }

    const cta: TextLayer = {
      id: (Date.now() + 2).toString(),
      text: 'SHOP NOW',
      position: [imageSize.width / 2, imageSize.height * 0.85],
      font_size: 48,
      font_color: '#FFFFFF',
      font_style: 'bold',
      alignment: 'center',
      shadow: false,
      shadow_color: '#000000',
      shadow_offset: [2, 2],
      outline: false,
      outline_color: '#000000',
      outline_width: 2,
      background_box: true,
      background_color: '#FF0000',
      background_opacity: 200,
      visible: true
    }

    setTextLayers([headline, subtext, cta])
    setSelectedLayerId(headline.id)
  }

  // Handle drag start
  const handleDragStart = (layerId: string) => {
    setIsDragging(true)
    setDragLayerId(layerId)
    setSelectedLayerId(layerId)
  }

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false)
    setDragLayerId(null)
  }

  // Handle position update from drag
  const handlePositionUpdate = (layerId: string, position: [number, number]) => {
    updateTextLayer(layerId, { position })
  }

  // Save final image
  const handleSave = async () => {
    if (textLayers.length === 0) {
      toast({
        title: 'No text layers',
        description: 'Add at least one text layer before saving',
        variant: 'destructive'
      })
      return
    }

    setIsProcessing(true)
    try {
      const visibleLayers = textLayers.filter(layer => layer.visible)
      const response = await imageApi.addTextOverlay({
        image_url: imageUrl,
        text_overlays: visibleLayers.map(layer => ({
          text: layer.text,
          position: layer.position,
          font_size: layer.font_size,
          font_color: layer.font_color,
          font_style: layer.font_style,
          alignment: layer.alignment,
          shadow: layer.shadow,
          shadow_color: layer.shadow_color,
          shadow_offset: layer.shadow_offset,
          outline: layer.outline,
          outline_color: layer.outline_color,
          outline_width: layer.outline_width,
          background_box: layer.background_box,
          background_color: layer.background_color,
          background_opacity: layer.background_opacity
        }))
      })

      if (onSave) {
        onSave(response.data.image_data, textLayers)
      }

      toast({
        title: 'Success',
        description: 'Image saved with text overlay'
      })
    } catch (error) {
      console.error('Failed to save image:', error)
      toast({
        title: 'Error',
        description: 'Failed to save image',
        variant: 'destructive'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Get scale factor for display
  const getScaleFactor = () => {
    if (!containerRef.current || !imageRef.current) return 1
    const containerWidth = containerRef.current.offsetWidth
    const imageWidth = imageRef.current.naturalWidth || imageSize.width
    return containerWidth / imageWidth
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Preview Panel with Drag & Drop */}
      <div className="flex-1 flex flex-col">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Type className="h-5 w-5" />
              Preview
            </h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOriginal(!showOriginal)}
              >
                {showOriginal ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                <span className="ml-2">{showOriginal ? 'Show Edit' : 'Show Original'}</span>
              </Button>
            </div>
          </div>
          
          <div 
            ref={containerRef}
            className="relative flex-1 bg-gray-200 dark:bg-gray-900 rounded-lg overflow-hidden"
            style={{ minHeight: '400px' }}
          >
            <img
              ref={imageRef}
              src={showOriginal ? imageUrl : previewImage}
              alt="Preview"
              className="w-full h-full object-contain"
              style={{ display: showOriginal ? 'block' : 'none' }}
            />
            
            {!showOriginal && (
              <div className="relative w-full h-full">
                <img
                  src={previewImage}
                  alt="Preview with overlay"
                  className="w-full h-full object-contain"
                />
                
                {/* Draggable text layers */}
                {textLayers.filter(layer => layer.visible).map((layer) => (
                  <DraggableTextLayer
                    key={layer.id}
                    layer={layer}
                    isSelected={selectedLayerId === layer.id}
                    isDragging={dragLayerId === layer.id}
                    scaleFactor={getScaleFactor()}
                    imageSize={imageSize}
                    containerRef={containerRef}
                    onSelect={() => setSelectedLayerId(layer.id)}
                    onDragStart={() => handleDragStart(layer.id)}
                    onDragEnd={handleDragEnd}
                    onPositionUpdate={(pos) => handlePositionUpdate(layer.id, pos)}
                  />
                ))}
              </div>
            )}
            
            {isProcessing && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="text-white bg-black bg-opacity-75 px-4 py-2 rounded-lg">
                  Processing...
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            <Move className="inline h-4 w-4 mr-1" />
            Drag text layers to reposition them
          </div>
        </div>
      </div>

      {/* Controls Panel */}
      <div className="w-96 space-y-4 overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Text Layers
          </h3>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addMarketingLayout}
            >
              Marketing Layout
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addTextLayer}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {textLayers.map((layer, index) => (
            <div 
              key={layer.id} 
              className={`border rounded-lg p-3 cursor-pointer transition-all ${
                selectedLayerId === layer.id 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                  : 'hover:border-gray-400'
              }`}
              onClick={() => setSelectedLayerId(layer.id)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Layer {index + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleLayerVisibility(layer.id)
                    }}
                  >
                    {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteTextLayer(layer.id)
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>

              {selectedLayerId === layer.id && (
                <TextLayerControls
                  layer={layer}
                  textStyles={textStyles}
                  onUpdate={(updates) => updateTextLayer(layer.id, updates)}
                  onApplyStyle={(styleName) => applyStylePreset(layer.id, styleName)}
                />
              )}
              
              {selectedLayerId !== layer.id && (
                <div className="text-sm text-gray-600">
                  "{layer.text}"
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="pt-4 border-t">
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={isProcessing || textLayers.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Save Image with Text
          </Button>
        </div>
      </div>
    </div>
  )
}