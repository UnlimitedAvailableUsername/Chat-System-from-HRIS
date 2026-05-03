import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext'
import { EmployeeLayout } from '../components/EmployeeLayout'
import { supabase } from '../lib/supabase'
import { Send, MessageCircle, Paperclip, X, FileText, Image as ImageIcon, CheckCircle } from 'lucide-react'
import {
  ChatFeedbackCard,
  shouldShowFeedbackCard,
  getLastRespondingAdmin,
  hasFeedbackSinceLastResolve
} from '../components/ChatFeedbackCard'
import { NotificationDialog } from '../components/NotificationDialog'

interface Message {
  message_id: number
  employee_id: number
  message: string
  sender_type: 'employee' | 'admin' | 'system'
  created_at: string
  is_read: boolean
  attachment_url?: string
  attachment_name?: string
  attachment_type?: string
  admin_user_id?: number
  admin_name?: string
}

export function EmployeeChatSupport() {
  const { user, loading } = useEmployeeAuth()
  const navigate = useNavigate()
  const [notification, setNotification] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }>({
    isOpen: false, type: 'info', title: '', message: ''
  })
  const notify = useCallback((type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    setNotification({ isOpen: true, type, title, message })
  }, [])
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prevMessageCountRef = useRef<number>(0)
  const shouldScrollRef = useRef<boolean>(true)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackAdminId, setFeedbackAdminId] = useState<number | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      navigate('/employee')
    } else if (user) {
      loadMessages()

      const channel = supabase
        .channel(`employee-chat-${user.user_id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'xin_employee_messages',
            filter: `employee_id=eq.${user.user_id}`
          },
          () => {
            loadMessages()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user, loading, navigate])

  useEffect(() => {
    const prevCount = prevMessageCountRef.current
    const newCount = messages.length
    prevMessageCountRef.current = newCount

    if (shouldScrollRef.current || newCount > prevCount) {
      scrollToBottom()
      shouldScrollRef.current = false
    }
  }, [messages])

  useEffect(() => {
    const checkFeedback = async () => {
      if (!user || messages.length < 3) {
        setShowFeedback(false)
        return
      }

      const dismissKey = `feedback_dismissed_employee_${user.user_id}`
      const dismissedTs = localStorage.getItem(dismissKey)
      const dismissedTimestamp = dismissedTs ? parseInt(dismissedTs) : null

      const feedbackSubmitted = await hasFeedbackSinceLastResolve('employee', user.user_id, messages)
      const shouldShow = shouldShowFeedbackCard(messages, 'employee', feedbackSubmitted, dismissedTimestamp)

      if (shouldShow) {
        const adminId = getLastRespondingAdmin(messages)
        setFeedbackAdminId(adminId)
        setShowFeedback(true)
      } else {
        setShowFeedback(false)
      }
    }

    checkFeedback()
  }, [messages, user])

  const handleFeedbackSubmitted = useCallback(() => {
    setShowFeedback(false)
  }, [])

  const handleFeedbackSkip = useCallback(() => {
    if (!user) return
    const dismissKey = `feedback_dismissed_employee_${user.user_id}`
    localStorage.setItem(dismissKey, Date.now().toString())
    setShowFeedback(false)
  }, [user])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('xin_employee_messages')
        .select('*')
        .eq('employee_id', user.user_id)
        .order('created_at', { ascending: true })

      if (error) throw error

      if (data && data.length > 0) {
        const adminUserIds = [...new Set(data.filter(msg => msg.admin_user_id).map(msg => msg.admin_user_id))]

        let adminMap = new Map<number, string>()
        if (adminUserIds.length > 0) {
          const { data: adminUsers } = await supabase
            .from('xin_employees')
            .select('user_id, first_name, last_name')
            .in('user_id', adminUserIds)
          adminMap = new Map(adminUsers?.map(admin => [admin.user_id, `${admin.first_name} ${admin.last_name}`]) || [])
        }

        const messagesWithAdminNames = data.map(msg => ({
          ...msg,
          admin_name: msg.admin_user_id ? adminMap.get(msg.admin_user_id) : undefined
        }))

        setMessages(messagesWithAdminNames)

        const unreadIds = data
          .filter(msg => msg.sender_type === 'admin' && !msg.is_read)
          .map(msg => msg.message_id)

        if (unreadIds.length > 0) {
          await supabase
            .from('xin_employee_messages')
            .update({ is_read: true })
            .in('message_id', unreadIds)
        }
      } else {
        setMessages([])
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = [
      'image/png','image/jpeg','image/jpg','image/gif','image/webp',
      'application/pdf','application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]

    if (!allowedTypes.includes(file.type)) {
      notify('warning', 'Invalid File', 'Please select an image (PNG, JPG, GIF, WEBP), PDF, or Excel file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      notify('warning', 'File Too Large', 'File size must be less than 10MB')
      return
    }

    setSelectedFile(file)
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!newMessage.trim() && !selectedFile) || !user || sending) return

    try {
      setSending(true)
      setUploading(!!selectedFile)
      shouldScrollRef.current = true

      let attachmentUrl = null
      let attachmentName = null
      let attachmentType = null

      if (selectedFile) {
        const timestamp = Date.now()
        const filePath = `${user.user_id}/${timestamp}/${selectedFile.name}`

        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, selectedFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(filePath)

        attachmentUrl = publicUrl
        attachmentName = selectedFile.name
        attachmentType = selectedFile.type
      }

      const { error } = await supabase
        .from('xin_employee_messages')
        .insert({
          employee_id: user.user_id,
          message: newMessage.trim() || '(Attachment)',
          sender_type: 'employee',
          is_read: false,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          attachment_type: attachmentType
        })

      if (error) throw error

      setNewMessage('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadMessages()
    } catch (error) {
      console.error('Error sending message:', error)
      notify('error', 'Send Failed', 'Failed to send message')
    } finally {
      setSending(false)
      setUploading(false)
    }
  }

  const getFileIcon = (type?: string) => {
    if (!type) return <FileText className="w-4 h-4" />
    if (type.startsWith('image/')) return <ImageIcon className="w-4 h-4" />
    return <FileText className="w-4 h-4" />
  }

  const isImageFile = (type?: string) => type?.startsWith('image/')

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const diffInHours = (Date.now() - date.getTime()) / (1000 * 60 * 60)
    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <>
    <EmployeeLayout>
      <div className="flex flex-col h-[calc(100vh-180px)]">
        <div className="bg-white rounded-t-lg shadow p-4 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Chat Support</h2>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                AI-assisted support · Ask us anything
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white shadow overflow-y-auto p-4 space-y-4">
          {loadingMessages ? (
            <div className="text-center py-8 text-gray-600">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No messages yet</p>
              <p className="text-sm text-gray-400">Start a conversation with support</p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                message.sender_type === 'system' ? (
                  <div key={message.message_id} className="flex justify-center">
                    <div className="bg-gray-200 rounded-full px-4 py-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <p className="text-xs text-gray-600">{message.message}</p>
                    </div>
                  </div>
                ) : (
                <div
                  key={message.message_id}
                  className={`flex ${message.sender_type === 'employee' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      message.sender_type === 'employee'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {message.sender_type === 'admin' && (
                      <p className="text-xs font-semibold mb-1 text-gray-600">
                        {message.admin_name || 'Admin'}
                      </p>
                    )}
                    {message.attachment_url && (
                      <div className="mb-2">
                        {isImageFile(message.attachment_type) ? (
                          <a href={message.attachment_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={message.attachment_url}
                              alt={message.attachment_name}
                              className="max-w-full rounded-lg max-h-64 object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            href={message.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 p-2 rounded ${
                              message.sender_type === 'employee'
                                ? 'bg-green-700 hover:bg-green-800'
                                : 'bg-gray-200 hover:bg-gray-300'
                            }`}
                          >
                            {getFileIcon(message.attachment_type)}
                            <span className="text-xs truncate">{message.attachment_name}</span>
                          </a>
                        )}
                      </div>
                    )}
                    {message.message !== '(Attachment)' && (
                      <p className="text-sm break-words">{message.message}</p>
                    )}
                    <p className={`text-xs mt-1 ${
                      message.sender_type === 'employee' ? 'text-green-100' : 'text-gray-500'
                    }`}>
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
                )
              ))}
              {showFeedback && feedbackAdminId && user && (
                <ChatFeedbackCard
                  chatType="employee"
                  employeeId={user.user_id}
                  adminUserId={feedbackAdminId}
                  onSubmitted={handleFeedbackSubmitted}
                  onSkip={handleFeedbackSkip}
                />
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="bg-white rounded-b-lg shadow p-4 flex-shrink-0">
          {selectedFile && (
            <div className="mb-2 flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
              {getFileIcon(selectedFile.type)}
              <span className="text-sm text-gray-700 flex-1 truncate">{selectedFile.name}</span>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="text-gray-500 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept="image/*,.pdf,.xls,.xlsx"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploading}
              className="flex-shrink-0 bg-gray-200 text-gray-700 p-2 rounded-full hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
              title="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={sending || uploading}
            />
            <button
              type="submit"
              disabled={(!newMessage.trim() && !selectedFile) || sending || uploading}
              className="flex-shrink-0 bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
            >
              <Send className="w-4 h-4" />
              <span className="font-medium text-sm">{uploading ? 'Uploading...' : 'Send'}</span>
            </button>
          </form>
        </div>
      </div>
    </EmployeeLayout>
    <NotificationDialog
      isOpen={notification.isOpen}
      onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
      type={notification.type}
      title={notification.title}
      message={notification.message}
    />
    </>
  )
}
