'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import api from '@/lib/api'
import { instagramAPI, InstagramAccount } from '@/lib/instagram'
import { getTemplates, ContentTemplate } from '@/lib/cms'
import ImageModal from '@/components/ui/ImageModal'

interface CreateCampaignModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface Workflow {
  id: string
  name: string
  description: string
  type?: string
}

export default function CreateCampaignModal({ isOpen, onClose, onSuccess }: CreateCampaignModalProps) {
  const [loading, setLoading] = useState(false)
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imagePrompt, setImagePrompt] = useState('')
  const [editImagePrompt, setEditImagePrompt] = useState('')
  const [showEditPrompt, setShowEditPrompt] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [useSplitPrompts, setUseSplitPrompts] = useState(false)
  const [backgroundPrompt, setBackgroundPrompt] = useState('')
  const [textPrompt, setTextPrompt] = useState('')
  const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccount[]>([])
  const [contentTemplates, setContentTemplates] = useState<ContentTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<ContentTemplate | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_type: 'manual',
    scheduled_at: '',
    tags: '',
    workflow_id: '',
    workflow_config: {},
    image_url: '',
    content: {},
    content_template_id: null as number | null,
    template_variables: {} as Record<string, any>,
    instagram_account_id: null as number | null,
    instagram_caption: '',
    instagram_hashtags: [] as string[],
    instagram_publish: false
  })

  useEffect(() => {
    if (isOpen) {
      fetchWorkflows()
      fetchInstagramAccounts()
      fetchContentTemplates()
    }
  }, [isOpen])

  const fetchWorkflows = async () => {
    try {
      const response = await api.get('/api/campaigns/workflows')
      const allWorkflows = [
        ...(response.data.templates || []),
        ...(response.data.workflows || [])
      ]
      setWorkflows(allWorkflows)
    } catch (error) {
      console.error('Failed to fetch workflows:', error)
    }
  }

  const fetchInstagramAccounts = async () => {
    try {
      const accounts = await instagramAPI.getAccounts()
      setInstagramAccounts(accounts.filter(acc => acc.status === 'connected'))
    } catch (error) {
      console.error('Failed to fetch Instagram accounts:', error)
    }
  }

  const fetchContentTemplates = async () => {
    try {
      const templates = await getTemplates({ include_public: true })
      setContentTemplates(templates.filter(t => t.is_active))
    } catch (error) {
      console.error('Failed to fetch content templates:', error)
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    const template = contentTemplates.find(t => t.id === parseInt(templateId))
    setSelectedTemplate(template || null)
    
    if (template) {
      // Initialize template variables with defaults
      const defaultVariables: Record<string, any> = {}
      template.variables.forEach(v => {
        defaultVariables[v.name] = v.default || ''
      })
      
      setFormData({
        ...formData,
        content_template_id: template.id,
        template_variables: defaultVariables
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
      // Check if we're in demo mode
      const session = await fetch('/api/auth/session').then(res => res.json())
      const isDemo = session?.user?.name === 'demo'
      
      if (isDemo) {
        // Mock campaign creation for demo mode
        console.log('Using mock campaign creation for demo mode')
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Store campaign in localStorage for demo
        const campaigns = JSON.parse(localStorage.getItem('demo_campaigns') || '[]')
        const newCampaign = {
          id: Date.now().toString(),
          ...formData,
          tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
          scheduled_at: formData.scheduled_at || null,
          instagram_account_id: formData.instagram_account_id || null,
          created_at: new Date().toISOString(),
          status: 'draft'
        }
        campaigns.push(newCampaign)
        localStorage.setItem('demo_campaigns', JSON.stringify(campaigns))
        
        onSuccess()
        onClose()
        resetForm()
        return
      }
      
      const payload = {
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        scheduled_at: formData.scheduled_at || null,
        instagram_account_id: formData.instagram_account_id || null
      }

      await api.post('/api/campaigns', payload)
      onSuccess()
      onClose()
      resetForm()
    } catch (error) {
      console.error('Failed to create campaign:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateImage = async (prompt?: string) => {
    setGeneratingImage(true)
    try {
      // Always use real DALL-E generation, no demo mode
      console.log('Using real DALL-E image generation')
      
      let requestData: any = { provider: 'openai' }
      
      if (useSplitPrompts && !prompt) {
        // Use split prompts
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
        // Use single prompt
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
      
      // If authentication fails, show error
      if (error.response?.status === 401) {
        alert('Session expired. Please refresh the page and login again.')
      }
      // If OpenAI fails, try with a placeholder
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

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      trigger_type: 'manual',
      scheduled_at: '',
      tags: '',
      workflow_id: '',
      workflow_config: {},
      image_url: '',
      content: {},
      content_template_id: null,
      template_variables: {},
      instagram_account_id: null,
      instagram_caption: '',
      instagram_hashtags: [],
      instagram_publish: false
    })
    setImagePrompt('')
    setEditImagePrompt('')
    setShowEditPrompt(false)
    setShowImageModal(false)
    setSelectedTemplate(null)
    setUseSplitPrompts(false)
    setBackgroundPrompt('')
    setTextPrompt('')
  }

  return (
    <>
      <Transition.Root show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <form onSubmit={handleSubmit}>
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start">
                      <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                        <Dialog.Title as="h3" className="text-lg leading-6 font-medium text-gray-900">
                          Create New Campaign
                        </Dialog.Title>
                        
                        <div className="mt-6 space-y-4">
                          <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                              Campaign Name
                            </label>
                            <input
                              type="text"
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
                              id="description"
                              rows={3}
                              value={formData.description}
                              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                          </div>

                          <div>
                            <label htmlFor="trigger_type" className="block text-sm font-medium text-gray-700">
                              Trigger Type
                            </label>
                            <select
                              id="trigger_type"
                              value={formData.trigger_type}
                              onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            >
                              <option value="manual">Manual</option>
                              <option value="scheduled">Scheduled</option>
                              <option value="webhook">Webhook</option>
                              <option value="event">Event</option>
                            </select>
                          </div>

                          {formData.trigger_type === 'scheduled' && (
                            <div>
                              <label htmlFor="scheduled_at" className="block text-sm font-medium text-gray-700">
                                Schedule Date & Time
                              </label>
                              <input
                                type="datetime-local"
                                id="scheduled_at"
                                value={formData.scheduled_at}
                                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              />
                            </div>
                          )}

                          <div>
                            <label htmlFor="workflow_id" className="block text-sm font-medium text-gray-700">
                              Workflow Template
                            </label>
                            <select
                              id="workflow_id"
                              value={formData.workflow_id}
                              onChange={(e) => setFormData({ ...formData, workflow_id: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            >
                              <option value="">Select a workflow (optional)</option>
                              {workflows.map((workflow) => (
                                <option key={workflow.id} value={workflow.id}>
                                  {workflow.name} {workflow.type === 'template' ? '(Template)' : ''}
                                </option>
                              ))}
                            </select>
                            {formData.workflow_id && (
                              <p className="mt-1 text-sm text-gray-500">
                                {workflows.find(w => w.id === formData.workflow_id)?.description}
                              </p>
                            )}
                          </div>

                          <div>
                            <label htmlFor="content_template" className="block text-sm font-medium text-gray-700">
                              Content Template
                            </label>
                            <select
                              id="content_template"
                              value={formData.content_template_id?.toString() || ''}
                              onChange={(e) => handleTemplateSelect(e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            >
                              <option value="">Select a content template (optional)</option>
                              {contentTemplates.map((template) => (
                                <option key={template.id} value={template.id.toString()}>
                                  {template.name} ({template.content_type})
                                </option>
                              ))}
                            </select>
                            {selectedTemplate && (
                              <div className="mt-2 space-y-2">
                                <p className="text-sm text-gray-500">{selectedTemplate.description}</p>
                                
                                {selectedTemplate.variables.length > 0 && (
                                  <div className="border-t pt-2">
                                    <p className="text-sm font-medium text-gray-700 mb-2">Template Variables</p>
                                    {selectedTemplate.variables.map((variable) => (
                                      <div key={variable.name} className="mb-2">
                                        <label htmlFor={`var-${variable.name}`} className="block text-xs font-medium text-gray-600">
                                          {variable.name} {variable.description && `(${variable.description})`}
                                        </label>
                                        <input
                                          type="text"
                                          id={`var-${variable.name}`}
                                          value={formData.template_variables[variable.name] || ''}
                                          onChange={(e) => setFormData({
                                            ...formData,
                                            template_variables: {
                                              ...formData.template_variables,
                                              [variable.name]: e.target.value
                                            }
                                          })}
                                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                                          placeholder={variable.default || `Enter ${variable.name}`}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div>
                            <label htmlFor="image" className="block text-sm font-medium text-gray-700">
                              Campaign Image
                            </label>
                            <div className="mt-1 space-y-2">
                              <input
                                type="text"
                                id="image_url"
                                value={formData.image_url}
                                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                                placeholder="Image URL or generate one below"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              />
                              
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="useSplitPrompts"
                                  checked={useSplitPrompts}
                                  onChange={(e) => setUseSplitPrompts(e.target.checked)}
                                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                />
                                <label htmlFor="useSplitPrompts" className="text-sm text-gray-700">
                                  Use split prompts (background + text)
                                </label>
                              </div>
                              
                              {useSplitPrompts ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={backgroundPrompt}
                                    onChange={(e) => setBackgroundPrompt(e.target.value)}
                                    placeholder="Describe the background graphic"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                  />
                                  <input
                                    type="text"
                                    value={textPrompt}
                                    onChange={(e) => setTextPrompt(e.target.value)}
                                    placeholder="Text to display (will be styled as bold white sans-serif, centered)"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                  />
                                  <div className="flex space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => handleGenerateImage()}
                                      disabled={generatingImage || !backgroundPrompt.trim() || !textPrompt.trim()}
                                      className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                                    >
                                      {generatingImage ? 'Generating...' : 'Generate with DALL-E'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const placeholderUrl = `https://via.placeholder.com/1024x1024/7C3AED/FFFFFF?text=${encodeURIComponent(textPrompt.slice(0, 50))}`
                                        setFormData({ ...formData, image_url: placeholderUrl })
                                        setEditImagePrompt(`Background: ${backgroundPrompt} | Text: ${textPrompt}`)
                                        setShowEditPrompt(false)
                                      }}
                                      disabled={!textPrompt.trim()}
                                      className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                    >
                                      Use Placeholder
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex space-x-2">
                                    <input
                                      type="text"
                                      value={imagePrompt}
                                      onChange={(e) => setImagePrompt(e.target.value)}
                                      placeholder="Describe the image you want to generate"
                                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                    />
                                  </div>
                                  <div className="flex space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => handleGenerateImage()}
                                      disabled={generatingImage || !imagePrompt || !imagePrompt.trim()}
                                      className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                                    >
                                      {generatingImage ? 'Generating...' : 'Generate with DALL-E'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const placeholderUrl = `https://via.placeholder.com/1024x1024/7C3AED/FFFFFF?text=${encodeURIComponent(imagePrompt.slice(0, 50))}`
                                        setFormData({ ...formData, image_url: placeholderUrl })
                                        setEditImagePrompt(imagePrompt)
                                        setShowEditPrompt(false)
                                      }}
                                      disabled={!imagePrompt || !imagePrompt.trim()}
                                      className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                    >
                                      Use Placeholder
                                    </button>
                                  </div>
                                </div>
                              )}
                              {formData.image_url && (
                                <div className="mt-4 space-y-3">
                                  <div className="relative group">
                                    <img 
                                      src={formData.image_url} 
                                      alt="Campaign preview" 
                                      className="h-48 w-full object-cover rounded-md cursor-pointer transition-transform hover:scale-105"
                                      onClick={() => setShowImageModal(true)}
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded-md flex items-center justify-center pointer-events-none">
                                      <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                                        Click to enlarge
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {!showEditPrompt ? (
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditImagePrompt(imagePrompt)
                                          setShowEditPrompt(true)
                                        }}
                                        className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                                      >
                                        Edit image prompt
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setShowImageModal(true)}
                                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                      >
                                        View full size
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <label className="block text-sm font-medium text-gray-700">
                                        Edit Image Prompt
                                      </label>
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          value={editImagePrompt}
                                          onChange={(e) => setEditImagePrompt(e.target.value)}
                                          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                                          placeholder="Describe your edited image..."
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleGenerateImage(editImagePrompt)}
                                          disabled={generatingImage || !editImagePrompt || !editImagePrompt.trim()}
                                          className="px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                                        >
                                          {generatingImage ? 'Regenerating...' : 'Regenerate'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setShowEditPrompt(false)}
                                          className="px-3 py-2 border text-sm font-medium rounded-md"
                                          style={{
                                            borderColor: 'var(--color-border)',
                                            color: 'var(--color-text-body)',
                                            backgroundColor: 'var(--color-background)',
                                            transition: 'background-color 0.2s'
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
                                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-background)'}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
                              Tags (comma-separated)
                            </label>
                            <input
                              type="text"
                              id="tags"
                              value={formData.tags}
                              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                              placeholder="social, instagram, discount"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                          </div>

                          {/* Instagram Integration Section */}
                          <div className="border-t pt-4">
                            <h4 className="text-sm font-medium text-gray-900 mb-3">Instagram Integration (Optional)</h4>
                            
                            {instagramAccounts.length > 0 ? (
                              <>
                                <div>
                                  <label htmlFor="instagram_account" className="block text-sm font-medium text-gray-700">
                                    Instagram Account
                                  </label>
                                  <select
                                    id="instagram_account"
                                    value={formData.instagram_account_id?.toString() || ''}
                                    onChange={(e) => setFormData({ 
                                      ...formData, 
                                      instagram_account_id: e.target.value ? parseInt(e.target.value) : null 
                                    })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                  >
                                    <option value="">None - Don't post to Instagram</option>
                                    {instagramAccounts.map((account) => (
                                      <option key={account.id} value={account.id.toString()}>
                                        @{account.instagram_username}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {formData.instagram_account_id && (
                                  <>
                                    <div className="mt-3">
                                      <label htmlFor="instagram_caption" className="block text-sm font-medium text-gray-700">
                                        Instagram Caption
                                      </label>
                                      <textarea
                                        id="instagram_caption"
                                        rows={3}
                                        value={formData.instagram_caption}
                                        onChange={(e) => setFormData({ ...formData, instagram_caption: e.target.value })}
                                        placeholder="Write your Instagram caption here..."
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        maxLength={2200}
                                      />
                                      <p className="mt-1 text-sm text-gray-500">
                                        {formData.instagram_caption.length}/2200 characters
                                      </p>
                                    </div>

                                    <div className="mt-3">
                                      <label htmlFor="instagram_hashtags" className="block text-sm font-medium text-gray-700">
                                        Instagram Hashtags (comma-separated)
                                      </label>
                                      <input
                                        type="text"
                                        id="instagram_hashtags"
                                        value={formData.instagram_hashtags.join(', ')}
                                        onChange={(e) => setFormData({ 
                                          ...formData, 
                                          instagram_hashtags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                                        })}
                                        placeholder="#marketing, #socialmedia, #business"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                      />
                                    </div>

                                    <div className="mt-3">
                                      <label className="flex items-center">
                                        <input
                                          type="checkbox"
                                          checked={formData.instagram_publish}
                                          onChange={(e) => setFormData({ ...formData, instagram_publish: e.target.checked })}
                                          className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">
                                          Publish to Instagram when campaign is executed
                                        </span>
                                      </label>
                                    </div>
                                  </>
                                )}
                              </>
                            ) : (
                              <p className="text-sm text-gray-500">
                                No Instagram accounts connected. Connect an account in the Instagram dashboard to enable posting.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-base font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                      style={{
                        backgroundColor: 'var(--status-scheduled-text)',
                        color: 'white',
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      {loading ? 'Creating...' : 'Create Campaign'}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-3 inline-flex w-full justify-center rounded-md border px-4 py-2 text-base font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                      style={{
                        borderColor: 'var(--color-border)',
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text-body)',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-background)'}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
    
    {showImageModal && formData.image_url && (
      <ImageModal
        src={formData.image_url}
        alt="Campaign image"
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
      />
    )}
  </>
)
}