'use client'

import React, { useState, useRef, useEffect } from 'react'
import { TextLayer } from './TextOverlayEditorV2'

interface DraggableTextLayerProps {
  layer: TextLayer
  isSelected: boolean
  isDragging: boolean
  scaleFactor: number
  imageSize: { width: number; height: number }
  containerRef: React.RefObject<HTMLDivElement>
  onSelect: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onPositionUpdate: (position: [number, number]) => void
}

export default function DraggableTextLayer({
  layer,
  isSelected,
  isDragging,
  scaleFactor,
  imageSize,
  containerRef,
  onSelect,
  onDragStart,
  onDragEnd,
  onPositionUpdate
}: DraggableTextLayerProps) {
  const [localPosition, setLocalPosition] = useState(layer.position)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocalPosition(layer.position)
  }, [layer.position])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    onSelect()
    onDragStart()
    
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    
    setDragStart({
      x: e.clientX - rect.left - (localPosition[0] * scaleFactor),
      y: e.clientY - rect.top - (localPosition[1] * scaleFactor)
    })
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = (e.clientX - rect.left - dragStart.x) / scaleFactor
      const y = (e.clientY - rect.top - dragStart.y) / scaleFactor

      // Constrain to image bounds
      const constrainedX = Math.max(0, Math.min(imageSize.width, x))
      const constrainedY = Math.max(0, Math.min(imageSize.height, y))

      setLocalPosition([constrainedX, constrainedY])
    }

    const handleMouseUp = () => {
      onDragEnd()
      onPositionUpdate(localPosition)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart, scaleFactor, imageSize, localPosition, onDragEnd, onPositionUpdate])

  // Calculate display position
  const displayX = localPosition[0] * scaleFactor
  const displayY = localPosition[1] * scaleFactor

  // Calculate text dimensions (approximate)
  const textWidth = layer.text.length * layer.font_size * 0.6 * scaleFactor
  const textHeight = layer.font_size * scaleFactor

  // Adjust position based on alignment
  let adjustedX = displayX
  if (layer.alignment === 'center') {
    adjustedX = displayX - textWidth / 2
  } else if (layer.alignment === 'right') {
    adjustedX = displayX - textWidth
  }

  return (
    <div
      ref={layerRef}
      className={`absolute cursor-move select-none ${
        isSelected ? 'z-20' : 'z-10'
      } ${isDragging ? 'opacity-75' : ''}`}
      style={{
        left: `${adjustedX}px`,
        top: `${displayY}px`,
        transform: 'translate(0, -50%)'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Text preview */}
      <div
        className="relative"
        style={{
          fontSize: `${layer.font_size * scaleFactor}px`,
          fontWeight: layer.font_style === 'bold' ? 'bold' : 'normal',
          color: layer.font_color,
          textAlign: layer.alignment as any,
          whiteSpace: 'nowrap'
        }}
      >
        {/* Background box */}
        {layer.background_box && (
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: layer.background_color,
              opacity: layer.background_opacity / 255,
              margin: '-8px',
              borderRadius: '4px'
            }}
          />
        )}
        
        {/* Shadow */}
        {layer.shadow && (
          <div
            className="absolute"
            style={{
              color: layer.shadow_color,
              left: `${layer.shadow_offset[0]}px`,
              top: `${layer.shadow_offset[1]}px`,
              zIndex: -1
            }}
          >
            {layer.text}
          </div>
        )}
        
        {/* Main text */}
        <span className="relative z-10">{layer.text}</span>
        
        {/* Selection indicator */}
        {isSelected && (
          <div
            className="absolute inset-0 border-2 border-blue-500 rounded"
            style={{
              margin: '-8px',
              pointerEvents: 'none'
            }}
          >
            <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-full" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 rounded-full" />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
          </div>
        )}
      </div>
    </div>
  )
}