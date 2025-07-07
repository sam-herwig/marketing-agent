'use client'

import React from 'react'
import SessionProvider from '@/components/SessionProvider'
import { ToastProvider } from '@/components/ui/use-toast'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </SessionProvider>
  )
}