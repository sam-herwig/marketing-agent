'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import api from '@/lib/api'
import { instagramAPI, InstagramAccount } from '@/lib/instagram'
import { getTemplates, ContentTemplate } from '@/lib/cms'
import ImageModal from '@/components/ui/ImageModal'

interface EditCampaignModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  campaign: any
}

interface Workflow {
  id: string
  name: string
  description: string
  type?: string
}

export default function EditCampaignModal({ isOpen, onClose, onSuccess, campaign }: EditCampaignModalProps) {
  const [loading, setLoading] = useState(false)
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imagePrompt, setImagePrompt] = useState('')
  const [editImagePrompt, setEditImagePrompt] = useState('')
  const [showEditPrompt, setShowEditPrompt] = useState(false)
  const [useSplitPrompts, setUseSplitPrompts] = useState(false)
  const [backgroundPrompt, setBackgroundPrompt] = useState('')
  const [textPrompt, setTextPrompt] = useState('')
  const [generateImageError, setGenerateImageError] = useState('')
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccount[]>([])
  const [templates, setTemplates] = useState<ContentTemplate[]>([])
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_type: 'manual',
    workflow_id: '',
    content: {},
    scheduled_at: '',
    tags: '',
    image_url: '',
    instagram_account_id: '',
    content_template_id: null as string | null,
    template_variables: {} as Record<string, string>
  })

  useEffect(() => {
    if (campaign && isOpen) {
      // Pre-populate form with campaign data
      setFormData({
        name: campaign.name || '',
        description: campaign.description || '',
        trigger_type: campaign.trigger_type || 'manual',
        workflow_id: campaign.workflow_id || '',
        content: campaign.content || {},
        scheduled_at: campaign.scheduled_at || '',
        tags: Array.isArray(campaign.tags) ? campaign.tags.join(', ') : '',
        image_url: campaign.image_url || '',
        instagram_account_id: campaign.instagram_account_id || '',
        content_template_id: campaign.content_template_id || null,
        template_variables: campaign.template_variables || {}
      })
    }
  }, [campaign, isOpen])

  useEffect(() => {
    if (isOpen) {
      fetchWorkflows()
      fetchInstagramAccounts()
      fetchTemplates()
    }
  }, [isOpen])

  const fetchWorkflows = async () => {
    try {
      const session = await fetch('/api/auth/session').then(res => res.json())
      const isDemo = session?.user?.name === 'demo'
      
      if (isDemo) {
        setWorkflows([
          { id: 'workflow-1', name: 'Social Media Post', description: 'Post to social media platforms' },
          { id: 'workflow-2', name: 'Email Campaign', description: 'Send email to subscribers' }
        ])
        return
      }
      
      const response = await api.get('/api/workflows')
      setWorkflows(response.data)
    } catch (error) {
      console.error('Failed to fetch workflows:', error)
    }
  }

  const fetchInstagramAccounts = async () => {
    try {
      const accounts = await instagramAPI.getAccounts()
      setInstagramAccounts(accounts)
    } catch (error) {
      console.error('Failed to fetch Instagram accounts:', error)
    }
  }

  const fetchTemplates = async () => {
    try {
      const templateList = await getTemplates()
      setTemplates(templateList)
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    }
  }

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      const variables: Record<string, string> = {}
      template.variables.forEach(v => {
        variables[v] = formData.template_variables[v] || ''
      })
      setFormData({
        ...formData,
        content_template_id: templateId,
        template_variables: variables
      })
    } else {
      setFormData({
        ...formData,
        content_template_id: null,
        template_variables: {}
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const session = await fetch('/api/auth/session').then(res => res.json())
      const isDemo = session?.user?.name === 'demo'
      
      if (isDemo) {
        console.log('Using mock campaign update for demo mode')
        
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const campaigns = JSON.parse(localStorage.getItem('demo_campaigns') || '[]')
        const index = campaigns.findIndex((c: any) => c.id === campaign.id)
        
        if (index !== -1) {
          campaigns[index] = {
            ...campaigns[index],
            ...formData,
            tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
            scheduled_at: formData.scheduled_at || null,
            instagram_account_id: formData.instagram_account_id || null,
            updated_at: new Date().toISOString()
          }
          localStorage.setItem('demo_campaigns', JSON.stringify(campaigns))
        }
        
        onSuccess()
        onClose()
        return
      }
      
      const payload = {
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        scheduled_at: formData.scheduled_at || null,
        instagram_account_id: formData.instagram_account_id || null
      }

      await api.put(`/api/campaigns/${campaign.id}`, payload)
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to update campaign:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateImage = async (prompt?: string) => {
    setGeneratingImage(true)
    try {
      const session = await fetch('/api/auth/session').then(res => res.json())
      const isDemo = session?.user?.name === 'demo'
      
      if (isDemo) {
        console.log('Using mock image generation for demo mode')
        
        let mockImageUrl = ''
        if (useSplitPrompts && !prompt) {
          if (!backgroundPrompt.trim() || !textPrompt.trim()) {
            alert('Please provide both background and text prompts')
            setGeneratingImage(false)
            return
          }
          const text = encodeURIComponent(textPrompt.slice(0, 30))
          mockImageUrl = `https://via.placeholder.com/1024x1024/7C3AED/FFFFFF?text=${text}`
        } else {
          const promptText = prompt || imagePrompt || 'Demo Image'
          const text = encodeURIComponent(promptText.slice(0, 30))
          mockImageUrl = `https://via.placeholder.com/1024x1024/7C3AED/FFFFFF?text=${text}`
        }
        
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        setFormData({ ...formData, image_url: mockImageUrl })
        if (useSplitPrompts) {
          setEditImagePrompt(`Background: ${backgroundPrompt} | Text: ${textPrompt}`)
        } else {
          setEditImagePrompt(prompt || imagePrompt || '')
        }
        setShowEditPrompt(false)
        setGeneratingImage(false)
        return
      }
      
      let requestData: any = { provider: 'openai' }
      
      if (useSplitPrompts && !prompt) {
        if (!backgroundPrompt.trim() || !textPrompt.trim()) {
          alert('Please provide both background and text prompts')
          setGeneratingImage(false)
          return
        }
        requestData = {
          ...requestData,
          use_split_prompts: true,
          background_prompt: backgroundPrompt,
          text_prompt: textPrompt
        }
      } else {
        const promptToUse = prompt || imagePrompt || ''
        if (!promptToUse.trim()) {
          setGeneratingImage(false)
          return
        }
        requestData = {
          ...requestData,
          prompt: promptToUse
        }
      }
      
      const response = await api.post('/api/campaigns/generate-image', requestData)
      
      if (response.data.image_url) {
        setFormData({ ...formData, image_url: response.data.image_url })
        if (useSplitPrompts) {
          setEditImagePrompt(`Background: ${backgroundPrompt} | Text: ${textPrompt}`)
        } else {
          setEditImagePrompt(prompt || imagePrompt || '')
        }
        setShowEditPrompt(false)
      }
    } catch (error: any) {
      console.error('Failed to generate image:', error)
      console.error('Error response:', error.response?.data)
      
      if (error.response?.status === 401) {
        alert('Session expired. Please refresh the page and login again.')
      }
      else if (error.response?.status === 500 || error.response?.status === 400) {
        const placeholderText = useSplitPrompts ? textPrompt : (prompt || imagePrompt || '')
        const placeholderUrl = `https://via.placeholder.com/1024x1024/7C3AED/FFFFFF?text=${encodeURIComponent(placeholderText.slice(0, 50))}`
        setFormData({ ...formData, image_url: placeholderUrl })
        if (useSplitPrompts) {
          setEditImagePrompt(`Background: ${backgroundPrompt} | Text: ${textPrompt}`)
        } else {
          setEditImagePrompt(prompt || imagePrompt || '')
        }
        setShowEditPrompt(false)
      }
    } finally {
      setGeneratingImage(false)
    }
  }

  return (
    <>
      <Transition.Root show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={onClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                  <div className="absolute right-0 top-0 pr-4 pt-4">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                      onClick={onClose}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                      <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                        Edit Campaign
                      </Dialog.Title>

                      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                        <div>
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                            Name
                          </label>
                          <input
                            type="text"
                            name="name"
                            id="name"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>

                        <div>
                          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                            Description
                          </label>
                          <textarea
                            name="description"
                            id="description"
                            rows={3}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>

                        <div>
                          <label htmlFor="workflow" className="block text-sm font-medium text-gray-700">
                            Workflow
                          </label>
                          <select
                            id="workflow"
                            name="workflow"
                            value={formData.workflow_id}
                            onChange={(e) => setFormData({ ...formData, workflow_id: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          >
                            <option value="">No workflow</option>
                            {workflows.map((workflow) => (
                              <option key={workflow.id} value={workflow.id}>
                                {workflow.name} - {workflow.description}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="trigger_type" className="block text-sm font-medium text-gray-700">
                            Trigger Type
                          </label>
                          <select
                            id="trigger_type"
                            name="trigger_type"
                            value={formData.trigger_type}
                            onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          >
                            <option value="manual">Manual</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="event">Event</option>
                          </select>
                        </div>

                        {formData.trigger_type === 'scheduled' && (
                          <div>
                            <label htmlFor="scheduled_at" className="block text-sm font-medium text-gray-700">
                              Scheduled Time
                            </label>
                            <input
                              type="datetime-local"
                              name="scheduled_at"
                              id="scheduled_at"
                              value={formData.scheduled_at}
                              onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                          </div>
                        )}

                        <div>
                          <label htmlFor="instagram_account" className="block text-sm font-medium text-gray-700">
                            Instagram Account
                          </label>
                          <select
                            id="instagram_account"
                            name="instagram_account"
                            value={formData.instagram_account_id}
                            onChange={(e) => setFormData({ ...formData, instagram_account_id: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          >
                            <option value="">No Instagram account</option>
                            {instagramAccounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                @{account.username} ({account.name})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="template" className="block text-sm font-medium text-gray-700">
                            Content Template
                          </label>
                          <select
                            id="template"
                            name="template"
                            value={formData.content_template_id || ''}
                            onChange={(e) => handleTemplateChange(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          >
                            <option value="">No template</option>
                            {templates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {formData.content_template_id && (
                          <div className="space-y-4">
                            {Object.entries(formData.template_variables).map(([variable, value]) => (
                              <div key={variable}>
                                <label htmlFor={variable} className="block text-sm font-medium text-gray-700">
                                  {variable}
                                </label>
                                <input
                                  type="text"
                                  id={variable}
                                  value={value as string}
                                  onChange={(e) => setFormData({
                                    ...formData,
                                    template_variables: {
                                      ...formData.template_variables,
                                      [variable]: e.target.value
                                    }
                                  })}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Campaign Image
                          </label>
                          {formData.image_url && (
                            <div className="mb-4">
                              <img 
                                src={formData.image_url} 
                                alt="Campaign" 
                                className="w-full max-w-md h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => setSelectedImageUrl(formData.image_url)}
                              />
                            </div>
                          )}
                          
                          <div className="flex items-center gap-4 mb-2">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={useSplitPrompts}
                                onChange={(e) => setUseSplitPrompts(e.target.checked)}
                                className="mr-2"
                              />
                              <span className="text-sm text-gray-600">Use separate background and text prompts</span>
                            </label>
                          </div>

                          {useSplitPrompts ? (
                            <div className="space-y-3">
                              <div>
                                <label htmlFor="backgroundPrompt" className="block text-sm font-medium text-gray-700">
                                  Background Prompt
                                </label>
                                <input
                                  type="text"
                                  id="backgroundPrompt"
                                  value={backgroundPrompt}
                                  onChange={(e) => setBackgroundPrompt(e.target.value)}
                                  placeholder="Describe the background scene..."
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                />
                              </div>
                              <div>
                                <label htmlFor="textPrompt" className="block text-sm font-medium text-gray-700">
                                  Text Prompt
                                </label>
                                <input
                                  type="text"
                                  id="textPrompt"
                                  value={textPrompt}
                                  onChange={(e) => setTextPrompt(e.target.value)}
                                  placeholder="Enter the text to display..."
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label htmlFor="imagePrompt" className="block text-sm font-medium text-gray-700">
                                Image Prompt
                              </label>
                              <input
                                type="text"
                                id="imagePrompt"
                                value={imagePrompt}
                                onChange={(e) => setImagePrompt(e.target.value)}
                                placeholder="Describe the image you want to generate..."
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              />
                            </div>
                          )}
                          
                          <button
                            type="button"
                            onClick={() => handleGenerateImage()}
                            disabled={generatingImage}
                            className="mt-2 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                          >
                            {generatingImage ? 'Generating...' : 'Generate New Image'}
                          </button>
                        </div>

                        <div>
                          <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
                            Tags (comma-separated)
                          </label>
                          <input
                            type="text"
                            name="tags"
                            id="tags"
                            value={formData.tags}
                            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                            placeholder="marketing, social, instagram"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>

                        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                          >
                            {loading ? 'Updating...' : 'Update Campaign'}
                          </button>
                          <button
                            type="button"
                            onClick={onClose}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {selectedImageUrl && (
        <ImageModal
          isOpen={!!selectedImageUrl}
          onClose={() => setSelectedImageUrl(null)}
          imageUrl={selectedImageUrl}
          alt="Campaign Image"
        />
      )}
    </>
  )
}