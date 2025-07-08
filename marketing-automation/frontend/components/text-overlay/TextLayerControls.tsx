'use client'

import React from 'react'
import { TextLayer } from './TextOverlayEditorV2'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ColorPicker from './ColorPicker'
import { Type, Move, Palette, Sparkles } from 'lucide-react'

interface TextLayerControlsProps {
  layer: TextLayer
  textStyles: any
  onUpdate: (updates: Partial<TextLayer>) => void
  onApplyStyle: (styleName: string) => void
}

export default function TextLayerControls({
  layer,
  textStyles,
  onUpdate,
  onApplyStyle
}: TextLayerControlsProps) {
  return (
    <Tabs defaultValue="text" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="text">Text</TabsTrigger>
        <TabsTrigger value="position">Position</TabsTrigger>
        <TabsTrigger value="style">Style</TabsTrigger>
        <TabsTrigger value="effects">Effects</TabsTrigger>
      </TabsList>

      <TabsContent value="text" className="space-y-3">
        <div>
          <Label htmlFor={`text-${layer.id}`} className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            Text Content
          </Label>
          <Input
            id={`text-${layer.id}`}
            value={layer.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Enter text..."
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor={`font-size-${layer.id}`}>Font Size: {layer.font_size}px</Label>
          <Slider
            id={`font-size-${layer.id}`}
            min={12}
            max={200}
            step={1}
            value={[layer.font_size]}
            onValueChange={([value]) => onUpdate({ font_size: value })}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor={`font-style-${layer.id}`}>Font Style</Label>
          <Select value={layer.font_style} onValueChange={(value: 'regular' | 'bold') => onUpdate({ font_style: value })}>
            <SelectTrigger id={`font-style-${layer.id}`} className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="bold">Bold</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ColorPicker
          label="Text Color"
          value={layer.font_color}
          onChange={(color) => onUpdate({ font_color: color })}
        />
      </TabsContent>

      <TabsContent value="position" className="space-y-3">
        <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md mb-3">
          <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <Move className="h-4 w-4" />
            Drag text directly on the preview to reposition
          </p>
        </div>
        
        <div>
          <Label htmlFor={`x-pos-${layer.id}`}>X Position</Label>
          <Input
            id={`x-pos-${layer.id}`}
            type="number"
            value={Math.round(layer.position[0])}
            onChange={(e) => onUpdate({ position: [parseInt(e.target.value) || 0, layer.position[1]] })}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor={`y-pos-${layer.id}`}>Y Position</Label>
          <Input
            id={`y-pos-${layer.id}`}
            type="number"
            value={Math.round(layer.position[1])}
            onChange={(e) => onUpdate({ position: [layer.position[0], parseInt(e.target.value) || 0] })}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor={`alignment-${layer.id}`}>Alignment</Label>
          <Select value={layer.alignment} onValueChange={(value: 'left' | 'center' | 'right') => onUpdate({ alignment: value })}>
            <SelectTrigger id={`alignment-${layer.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </TabsContent>

      <TabsContent value="style" className="space-y-3">
        <div>
          <Label>Quick Styles</Label>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(textStyles).map(styleName => (
              <Button
                key={styleName}
                variant="outline"
                size="sm"
                onClick={() => onApplyStyle(styleName)}
                className="capitalize"
              >
                {styleName}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor={`bg-box-${layer.id}`}>Background Box</Label>
          <Switch
            id={`bg-box-${layer.id}`}
            checked={layer.background_box}
            onCheckedChange={(checked) => onUpdate({ background_box: checked })}
          />
        </div>

        {layer.background_box && (
          <ColorPicker
            label="Background Color"
            value={layer.background_color}
            onChange={(color) => onUpdate({ background_color: color })}
            showOpacity={true}
            opacity={layer.background_opacity}
            onOpacityChange={(opacity) => onUpdate({ background_opacity: opacity })}
          />
        )}
      </TabsContent>

      <TabsContent value="effects" className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor={`shadow-${layer.id}`}>Text Shadow</Label>
          <Switch
            id={`shadow-${layer.id}`}
            checked={layer.shadow}
            onCheckedChange={(checked) => onUpdate({ shadow: checked })}
          />
        </div>

        {layer.shadow && (
          <>
            <ColorPicker
              label="Shadow Color"
              value={layer.shadow_color}
              onChange={(color) => onUpdate({ shadow_color: color })}
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor={`shadow-x-${layer.id}`}>Shadow X</Label>
                <Input
                  id={`shadow-x-${layer.id}`}
                  type="number"
                  value={layer.shadow_offset[0]}
                  onChange={(e) => onUpdate({ shadow_offset: [parseInt(e.target.value) || 0, layer.shadow_offset[1]] })}
                />
              </div>
              <div>
                <Label htmlFor={`shadow-y-${layer.id}`}>Shadow Y</Label>
                <Input
                  id={`shadow-y-${layer.id}`}
                  type="number"
                  value={layer.shadow_offset[1]}
                  onChange={(e) => onUpdate({ shadow_offset: [layer.shadow_offset[0], parseInt(e.target.value) || 0] })}
                />
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between">
          <Label htmlFor={`outline-${layer.id}`}>Text Outline</Label>
          <Switch
            id={`outline-${layer.id}`}
            checked={layer.outline}
            onCheckedChange={(checked) => onUpdate({ outline: checked })}
          />
        </div>

        {layer.outline && (
          <>
            <ColorPicker
              label="Outline Color"
              value={layer.outline_color}
              onChange={(color) => onUpdate({ outline_color: color })}
            />

            <div>
              <Label htmlFor={`outline-width-${layer.id}`}>Outline Width: {layer.outline_width}px</Label>
              <Slider
                id={`outline-width-${layer.id}`}
                min={1}
                max={10}
                step={1}
                value={[layer.outline_width]}
                onValueChange={([value]) => onUpdate({ outline_width: value })}
              />
            </div>
          </>
        )}
      </TabsContent>
    </Tabs>
  )
}