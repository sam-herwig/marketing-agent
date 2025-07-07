'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import ImageModal from '@/components/ui/ImageModal'
import { sanitizeUserInput, sanitizeImageUrl } from '@/lib/sanitize'

interface Campaign {
  id: number
  name: string
  description: string
  status: string
  created_at: string
  scheduled_at: string | null
  trigger_type: string
  workflow_id: string | null
  image_url: string | null
}

export default function CampaignList() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<{url: string, name: string} | null>(null)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      // Check if we're in demo mode
      const session = await fetch('/api/auth/session').then(res => res.json())
      const isDemo = session?.user?.name === 'demo'
      
      if (isDemo) {
        // Get campaigns from localStorage for demo mode
        const demoCampaigns = JSON.parse(localStorage.getItem('demo_campaigns') || '[]')
        setCampaigns(demoCampaigns)
        setLoading(false)
        return
      }
      
      const response = await api.get('/api/campaigns')
      setCampaigns(response.data)
    } catch (error) {
      console.error('Failed to fetch campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-[var(--status-draft-bg)] text-[var(--status-draft-text)]',
      scheduled: 'bg-[var(--status-scheduled-bg)] text-[var(--status-scheduled-text)]',
      active: 'bg-[var(--status-active-bg)] text-[var(--status-active-text)]',
      paused: 'bg-[var(--status-paused-bg)] text-[var(--status-paused-text)]',
      completed: 'bg-[var(--status-completed-bg)] text-[var(--status-completed-text)]',
      failed: 'bg-[var(--status-failed-bg)] text-[var(--status-failed-text)]'
    }
    return colors[status as keyof typeof colors] || 'bg-[var(--status-draft-bg)] text-[var(--status-draft-text)]'
  }

  if (loading) {
    return <div className="text-center py-12">Loading campaigns...</div>
  }

  return (
    <>
      <div className="bg-[var(--color-background)] theme-shadow overflow-hidden sm:theme-radius-md">
        <ul className="divide-y divide-[var(--color-border)]">
          {campaigns.length === 0 ? (
            <li className="px-[var(--spacing-md)] py-[calc(var(--spacing-md)*2)] text-center text-[var(--color-text-subtle)]">
              No campaigns yet. Create your first campaign!
            </li>
          ) : (
            campaigns.map((campaign) => (
              <li key={campaign.id}>
                <Link href={`/dashboard/campaigns/${campaign.id}`} className="block hover:bg-[var(--color-surface)] px-[var(--spacing-md)] py-[var(--spacing-sm)]">
                  <div className="flex items-center space-x-4">
                    {campaign.image_url && (
                      <div className="flex-shrink-0">
                        <img 
                          src={sanitizeImageUrl(campaign.image_url)} 
                          alt={sanitizeUserInput(campaign.name)}
                          className="h-16 w-16 object-cover theme-radius-md cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={(e) => {
                            e.preventDefault()
                            setSelectedImage({ url: campaign.image_url!, name: campaign.name })
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-[var(--font-size-lg)] font-[var(--font-weight-medium)] text-[var(--color-text-heading)] truncate">{sanitizeUserInput(campaign.name)}</p>
                        <div className="ml-2 flex-shrink-0">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(campaign.status)}`}>
                            {campaign.status}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-[var(--font-size-sm)] text-[var(--color-text-subtle)] truncate">{sanitizeUserInput(campaign.description)}</p>
                      <div className="mt-2 flex items-center text-[var(--font-size-sm)] text-[var(--color-text-subtle)]">
                        <span>Trigger: {campaign.trigger_type}</span>
                        {campaign.workflow_id && (
                          <span className="ml-4">Workflow: {campaign.workflow_id}</span>
                        )}
                        {campaign.scheduled_at && (
                          <span className="ml-4">
                            Scheduled: {new Date(campaign.scheduled_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
      
      {selectedImage && (
        <ImageModal
          src={sanitizeImageUrl(selectedImage.url)}
          alt={sanitizeUserInput(selectedImage.name)}
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </>
  )
}