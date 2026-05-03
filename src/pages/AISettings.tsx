import { useState, useEffect } from 'react'
import { Settings, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function AISettings() {
  const [provider, setProvider] = useState('openai')
  const [model, setModel] = useState('gpt-5-mini')
  const [systemPrompt, setSystemPrompt] = useState('You are an HR support assistant.\nHelp the admin draft a helpful, professional, and concise reply to the employee.')
  const [enableRag, setEnableRag] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase.from('xin_ai_settings').select('*').eq('id', 1).single()
      if (error) throw error
      if (data) {
        setProvider(data.provider)
        setModel(data.model)
        setSystemPrompt(data.system_prompt)
        setEnableRag(data.enable_rag)
      }
    } catch (err) {
      console.error('Error loading AI settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('xin_ai_settings').upsert({
        id: 1,
        provider,
        model,
        system_prompt: systemPrompt,
        enable_rag: enableRag,
        updated_at: new Date().toISOString()
      })
      if (error) throw error
      alert('Settings saved successfully! Future AI drafts will use these settings.')
    } catch (err) {
      console.error('Error saving AI settings:', err)
      alert('Failed to save settings. Please make sure you ran the SQL script.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-8 h-[calc(100vh-4rem)]">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Settings</h1>
            <p className="text-gray-500">Configure how the AI Assistant behaves and responds.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Model Configuration</h2>
          </div>
          <div className="p-6">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Model
              </label>
              <select
                value={model}
                onChange={(e) => {
                  setModel(e.target.value)
                  setProvider('openai')
                }}
                disabled={loading}
                className="w-full md:w-1/2 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50"
              >
                <optgroup label="OpenAI">
                  <option value="gpt-5-mini">GPT-5 Mini (Fast & Cost-effective)</option>
                  <option value="gpt-5-nano">GPT-5 Nano (Ultra Fast)</option>
                </optgroup>
              </select>
            </div>

            <div className="mb-6 border-b border-gray-100 pb-6">
              <div className="flex items-center justify-between w-full md:w-1/2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Enable Knowledge Retrieval (RAG)
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Allow the AI to search company policies and documents before answering.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={enableRag}
                    onChange={(e) => setEnableRag(e.target.checked)}
                    disabled={loading}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 disabled:opacity-50"></div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                System Prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                disabled={loading}
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-y disabled:opacity-50"
              />
              <p className="mt-2 text-xs text-gray-500">
                This prompt tells the AI how to behave. It will be combined with the employee context and conversation history.
              </p>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
