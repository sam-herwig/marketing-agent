'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { ArrowLeftIcon, PlayIcon, PauseIcon, ClockIcon, PencilIcon } from '@heroicons/react/24/outline'
import EditCampaignModal from '@/components/campaigns/EditCampaignModal'

interface Campaign {
  id: number
  name: string
  description: string
  status: string
  workflow_id: string
  trigger_type: string
  image_url: string | null
  content: any
  created_at: string
  executed_at: string | null
}

interface Execution {
  id: number
  status: string
  started_at: string
  completed_at: string | null
  result: any
  error: string | null
}

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [executions, setExecutions] = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  useEffect(() => {
    fetchCampaign()
    fetchExecutions()
  }, [params.id])

  const fetchCampaign = async () => {
    try {
      // Check if we're in demo mode
      const session = await fetch('/api/auth/session').then(res => res.json())
      const isDemo = session?.user?.name === 'demo'
      
      if (isDemo) {
        // Get campaign from localStorage for demo mode
        const demoCampaigns = JSON.parse(localStorage.getItem('demo_campaigns') || '[]')
        const campaign = demoCampaigns.find((c: any) => c.id === params.id)
        if (campaign) {
          setCampaign(campaign)
        }
        setLoading(false)
        return
      }
      
      const response = await api.get(`/api/campaigns/${params.id}`)
      setCampaign(response.data)
    } catch (error) {
      console.error('Failed to fetch campaign:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchExecutions = async () => {
    try {
      // Check if we're in demo mode
      const session = await fetch('/api/auth/session').then(res => res.json())
      const isDemo = session?.user?.name === 'demo'
      
      if (isDemo) {
        // Return empty executions for demo mode
        setExecutions([])
        return
      }
      
      const response = await api.get(`/api/campaigns/${params.id}/executions`)
      setExecutions(response.data)
    } catch (error) {
      console.error('Failed to fetch executions:', error)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      // Check if we're in demo mode
      const session = await fetch('/api/auth/session').then(res => res.json())
      const isDemo = session?.user?.name === 'demo'
      
      if (isDemo) {
        // Update campaign in localStorage for demo mode
        const demoCampaigns = JSON.parse(localStorage.getItem('demo_campaigns') || '[]')
        const index = demoCampaigns.findIndex((c: any) => c.id === params.id)
        if (index !== -1) {
          demoCampaigns[index].status = newStatus
          localStorage.setItem('demo_campaigns', JSON.stringify(demoCampaigns))
        }
        setCampaign(prev => prev ? { ...prev, status: newStatus } : null)
        return
      }
      
      await api.patch(`/api/campaigns/${params.id}`, { status: newStatus })
      setCampaign(prev => prev ? { ...prev, status: newStatus } : null)
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const handleExecute = async () => {
    setExecuting(true)
    try {
      // Check if we're in demo mode
      const session = await fetch('/api/auth/session').then(res => res.json())
      const isDemo = session?.user?.name === 'demo'
      
      if (isDemo) {
        // Simulate execution for demo mode
        console.log('Simulating campaign execution for demo mode')
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Create mock execution
        const mockExecution = {
          id: Date.now(),
          status: 'completed',
          started_at: new Date().toISOString(),
          completed_at: new Date(Date.now() + 1000).toISOString(),
          result: { message: 'Demo execution completed successfully' },
          error: null
        }
        setExecutions([mockExecution, ...executions])
        setExecuting(false)
        return
      }
      
      await api.post(`/api/campaigns/${params.id}/execute`)
      // Refresh executions after a delay
      setTimeout(() => {
        fetchExecutions()
      }, 2000)
    } catch (error) {
      console.error('Failed to execute campaign:', error)
    } finally {
      setExecuting(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12">Loading...</div>
  }

  if (!campaign) {
    return <div className="text-center py-12">Campaign not found</div>
  }

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-purple-100 text-purple-800',
      failed: 'bg-red-100 text-red-800',
      running: 'bg-blue-100 text-blue-800',
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard/campaigns')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Campaigns
          </button>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-lg leading-6 font-medium text-gray-900">{campaign.name}</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">{campaign.description}</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm leading-5 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <PencilIcon className="-ml-1 mr-2 h-4 w-4 text-gray-500" aria-hidden="true" />
                  Edit
                </button>
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(campaign.status)}`}>
                  {campaign.status}
                </span>
              </div>
            </div>
            {campaign.image_url && (
              <div className="mt-4">
                <img 
                  src={campaign.image_url} 
                  alt={campaign.name}
                  className="w-full max-w-md h-64 object-cover rounded-lg shadow-md"
                />
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Trigger Type</dt>
                <dd className="mt-1 text-sm text-gray-900">{campaign.trigger_type}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Workflow</dt>
                <dd className="mt-1 text-sm text-gray-900">{campaign.workflow_id || 'None'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="mt-1 text-sm text-gray-900">{new Date(campaign.created_at).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Executed</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {campaign.executed_at ? new Date(campaign.executed_at).toLocaleString() : 'Never'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <div className="flex space-x-3">
              {campaign.status === 'draft' && (
                <button
                  onClick={() => handleStatusChange('active')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                >
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Activate
                </button>
              )}
              
              {campaign.status === 'active' && (
                <>
                  <button
                    onClick={handleExecute}
                    disabled={executing || !campaign.workflow_id}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    <PlayIcon className="h-4 w-4 mr-2" />
                    {executing ? 'Executing...' : 'Execute Now'}
                  </button>
                  <button
                    onClick={() => handleStatusChange('paused')}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <PauseIcon className="h-4 w-4 mr-2" />
                    Pause
                  </button>
                </>
              )}
              
              {campaign.status === 'paused' && (
                <button
                  onClick={() => handleStatusChange('active')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                >
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Resume
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Execution History</h3>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {executions.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                No executions yet
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {executions.map((execution) => (
                  <li key={execution.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(execution.status)}`}>
                          {execution.status}
                        </span>
                        <div className="ml-4">
                          <p className="text-sm text-gray-900">
                            Started: {new Date(execution.started_at).toLocaleString()}
                          </p>
                          {execution.completed_at && (
                            <p className="text-sm text-gray-500">
                              Completed: {new Date(execution.completed_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      {execution.result && (
                        <div className="text-sm text-gray-500">
                          <pre className="bg-gray-100 p-2 rounded text-xs">
                            {JSON.stringify(execution.result, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                    {execution.error && (
                      <div className="mt-2 text-sm text-red-600">
                        Error: {execution.error}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {campaign && (
        <EditCampaignModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            setIsEditModalOpen(false)
            fetchCampaign() // Refresh campaign data
          }}
          campaign={campaign}
        />
      )}
    </div>
  )
}