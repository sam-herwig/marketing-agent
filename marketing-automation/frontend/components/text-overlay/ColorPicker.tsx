'use client'

import React, { useState } from 'react'
import { Palette, Pipette } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface ColorPickerProps {
  label: string
  value: string
  onChange: (color: string) => void
  showOpacity?: boolean
  opacity?: number
  onOpacityChange?: (opacity: number) => void
}

const PRESET_COLORS = [
  '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
  '#FFC0CB', '#A52A2A', '#808080', '#C0C0C0', '#FFD700',
  '#4B0082', '#FF1493', '#00CED1', '#FF6347', '#7FFF00'
]

export default function ColorPicker({
  label,
  value,
  onChange,
  showOpacity = false,
  opacity = 255,
  onOpacityChange
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempColor, setTempColor] = useState(value)

  const handleColorSelect = (color: string) => {
    setTempColor(color)
    onChange(color)
  }

  const handleHexInput = (hex: string) => {
    if (/^#[0-9A-Fa-f]{0,6}$/.test(hex)) {
      setTempColor(hex)
      if (hex.length === 7) {
        onChange(hex)
      }
    }
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Palette className="h-4 w-4" />
        {label}
      </Label>
      
      <div className="flex gap-2">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
            >
              <div
                className="w-6 h-6 rounded border border-gray-300"
                style={{ backgroundColor: value }}
              />
              <span className="flex-1 text-left">{value}</span>
              <Pipette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Color Picker</Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    type="color"
                    value={tempColor}
                    onChange={(e) => handleColorSelect(e.target.value)}
                    className="w-20 h-10 p-1"
                  />
                  <Input
                    value={tempColor}
                    onChange={(e) => handleHexInput(e.target.value)}
                    placeholder="#FFFFFF"
                    className="flex-1"
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-sm">Preset Colors</Label>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      className="w-12 h-12 rounded border-2 border-gray-300 hover:border-gray-500 transition-colors"
                      style={{ backgroundColor: color }}
                      onClick={() => handleColorSelect(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              
              {showOpacity && onOpacityChange && (
                <div>
                  <Label className="text-sm">
                    Opacity: {Math.round((opacity / 255) * 100)}%
                  </Label>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={opacity}
                    onChange={(e) => onOpacityChange(parseInt(e.target.value))}
                    className="w-full mt-2"
                  />
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}