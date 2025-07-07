'use client'

import { useState } from 'react'
import CampaignList from '@/components/campaigns/CampaignList'
import CreateCampaignModal from '@/components/campaigns/CreateCampaignModal'
import { PlusIcon } from '@heroicons/react/24/outline'

export default function CampaignsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleCampaignCreated = () => {
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-gray-900">Campaigns</h1>
            <p className="mt-2 text-sm text-gray-700">
              Create and manage your marketing automation campaigns
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              New Campaign
            </button>
          </div>
        </div>
        
        <div className="mt-8">
          <CampaignList key={refreshKey} />
        </div>
      </div>

      <CreateCampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleCampaignCreated}
      />
    </div>
  )
}