import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { MessageSquare, RefreshCw, Search, Send, Paperclip, X, FileText, Image as ImageIcon, CheckCheck, CheckCircle, Info, User, Briefcase, CreditCard, ExternalLink, Sparkles, BarChart2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { NotificationDialog, NotificationType } from '../components/NotificationDialog'
import { generateAISuggestion, AISuggestion } from '../lib/ai'
import { Message } from '../types'

// Copied from production. Stripped from this version:
//  - Applicant chat support (the demo only has employee↔admin chat).
//  - Agora voice/video call buttons + useAgoraCall + CallModal.
//  - canAccessChatInquiries / canReplyAllChats permission gates (routing protects this page).
//  - Head-RO designation lookup (no applicants → no need).

interface EmployeeChat {
  chat_id: string
  employee_id: number
  employee_name: string
  last_message: string
  last_message_time: string
  unread_count: number
  employee_email?: string
  employee_company?: string
  employee_contact?: string
}


interface EmployeeDetail {
  user_id: number
  employee_id: string
  first_name: string
  middle_name: string
  last_name: string
  email: string
  contact_no: string
  designation_name?: string
  company_name?: string
  company_id: number
  designation_id: number
  sss_no: string
  philhealth_no: string
  pagibig_no: string
  tin_no: string
  date_of_birth: string
  date_of_joining: string
  date_of_leaving: string
  gender: string
  marital_status: string
  birth_place: string
  is_active: number
  biometric_id: string
  sub_location?: string
  role_name?: string
  nbi_exp: string
  healthcard_exp: string
}

function InfoRow({ icon, label, value, mono }: { icon?: React.ReactNode; label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {icon && <span className="text-gray-400">{icon}</span>}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <span className={`text-xs text-right text-gray-800 font-medium break-all ${mono ? 'font-mono' : ''}`}>{value || <span className="text-gray-400 font-normal">—</span>}</span>
    </div>
  )
}

function InfoSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-blue-500">{icon}</span>
        <h5 className="text-[11px] font-semibold text-blue-500 uppercase tracking-wider">{title}</h5>
      </div>
      <div className="bg-gray-50 rounded-xl px-3 py-1 divide-y divide-gray-100">
        {children}
      </div>
    </div>
  )
}

const EMPLOYEE_OFFSET = 1_000_000

function encodeThreadId(chat: EmployeeChat): string {
  return String(EMPLOYEE_OFFSET + chat.employee_id)
}

function decodeThreadId(threadId: string): string | null {
  const num = parseInt(threadId, 10)
  if (isNaN(num)) return null
  if (num >= EMPLOYEE_OFFSET) {
    return `employee_${num - EMPLOYEE_OFFSET}`
  }
  return null
}

export function ChatInquiries() {
  const { user } = useAuth()
  const { threadId } = useParams<{ threadId: string }>()
  const navigate = useNavigate()
  const urlChatId = threadId ? decodeThreadId(threadId) : null
  const [employeeChats, setEmployeeChats] = useState<EmployeeChat[]>([])
  const [filteredChats, setFilteredChats] = useState<EmployeeChat[]>([])
  const [selectedChatId, setSelectedChatId] = useState<string | null>(urlChatId)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const prevMessageCountRef = useRef<number>(0)
  const shouldScrollRef = useRef<boolean>(true)
  const [resolving, setResolving] = useState(false)
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [infoPanelData, setInfoPanelData] = useState<EmployeeDetail | null>(null)
  const [infoPanelLoading, setInfoPanelLoading] = useState(false)

  // AI state
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAuditId, setAiAuditId] = useState<number | null>(null)
  const [aiOriginalText, setAiOriginalText] = useState<string>('')
  const [isEditingSuggestion, setIsEditingSuggestion] = useState(false)
  const [aiStats, setAiStats] = useState({ accepted: 0, edited: 0, rejected: 0 })
  const [showAiStats, setShowAiStats] = useState(false)

  const [notification, setNotification] = useState<{ isOpen: boolean; type: NotificationType; title: string; message: string }>({
    isOpen: false, type: 'error', title: '', message: ''
  })
  const notify = useCallback((type: NotificationType, title: string, message: string) => {
    setNotification({ isOpen: true, type, title, message })
  }, [])

  useEffect(() => {
    const decoded = threadId ? decodeThreadId(threadId) : null
    setSelectedChatId(decoded)
  }, [threadId])

  const selectedEmployee = employeeChats.find(chat => chat.chat_id === selectedChatId) || null

  const loadAiStats = async () => {
    try {
      const { data, error } = await supabase.from('xin_ai_audit').select('action')
      if (error) throw error
      const stats = { accepted: 0, edited: 0, rejected: 0 }
      data?.forEach(row => {
        if (row.action === 'accepted') stats.accepted++
        if (row.action === 'edited') stats.edited++
        if (row.action === 'rejected') stats.rejected++
      })
      setAiStats(stats)
    } catch (err) {
      console.error('Error loading AI stats:', err)
    }
  }

  useEffect(() => {
    loadAiStats()
    loadEmployeeChats(true)

    const channel = supabase
      .channel('admin-chat-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'xin_employee_messages' },
        () => loadEmployeeChats(false)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  useEffect(() => {
    filterChats()
  }, [employeeChats, searchTerm])

  useEffect(() => {
    if (selectedEmployee) {
      loadMessages(selectedEmployee)

      const channel = supabase
        .channel(`admin-chat-messages-${selectedEmployee.chat_id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'xin_employee_messages',
            filter: `employee_id=eq.${selectedEmployee.employee_id}`
          },
          () => {
            loadMessages(selectedEmployee)
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [selectedChatId])

  useEffect(() => {
    const prevCount = prevMessageCountRef.current
    const newCount = messages.length
    prevMessageCountRef.current = newCount

    if (shouldScrollRef.current || newCount > prevCount) {
      scrollToBottom()
      shouldScrollRef.current = false
    }
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadEmployeeChats = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true)

      const { data: employeeMessagesData, error: empMessagesError } = await supabase
        .from('xin_employee_messages')
        .select('message_id, employee_id, message, created_at, sender_type')
        .order('created_at', { ascending: false })

      if (empMessagesError) throw empMessagesError

      const { data: adminReads } = await supabase
        .from('xin_admin_message_reads')
        .select('message_type, message_id')
        .eq('admin_user_id', user!.user_id)

      const readEmployeeIds = new Set(
        (adminReads || []).filter(r => r.message_type === 'employee').map(r => r.message_id)
      )

      const employeeIds = [...new Set(employeeMessagesData?.map(m => m.employee_id) || [])]

      const chats: EmployeeChat[] = []

      if (employeeIds.length > 0) {
        const { data: employees, error: empError } = await supabase
          .from('xin_employees')
          .select('user_id, first_name, last_name, email, company_id, contact_no')
          .in('user_id', employeeIds)

        if (empError) throw empError

        const companyIds = [...new Set(employees?.map(e => e.company_id).filter(Boolean) || [])]
        let companyMap = new Map<number, string>()
        if (companyIds.length > 0) {
          const { data: companies } = await supabase
            .from('xin_companies')
            .select('company_id, name')
            .in('company_id', companyIds)
          companyMap = new Map(companies?.map(c => [c.company_id, c.name]) || [])
        }
        const employeeMap = new Map(employees?.map(e => [e.user_id, e]) || [])

        const chatsByEmployee = new Map<number, {
          lastMessage: string
          lastMessageTime: string
          unreadCount: number
        }>()

        employeeMessagesData?.forEach(msg => {
          if (!chatsByEmployee.has(msg.employee_id)) {
            const unreadCount = employeeMessagesData.filter(
              m => m.employee_id === msg.employee_id &&
              m.sender_type === 'employee' &&
              !readEmployeeIds.has(m.message_id)
            ).length

            chatsByEmployee.set(msg.employee_id, {
              lastMessage: msg.message,
              lastMessageTime: msg.created_at,
              unreadCount
            })
          }
        })

        const employeeChatsData: EmployeeChat[] = Array.from(chatsByEmployee.entries()).map(([empId, data]) => {
          const emp = employeeMap.get(empId)
          return {
            chat_id: `employee_${empId}`,
            employee_id: empId,
            employee_name: emp ? `${emp.first_name} ${emp.last_name}` : `Employee ${empId}`,
            employee_email: emp?.email,
            employee_company: emp ? companyMap.get(emp.company_id) : undefined,
            employee_contact: emp?.contact_no,
            last_message: data.lastMessage,
            last_message_time: data.lastMessageTime,
            unread_count: data.unreadCount
          }
        })

        chats.push(...employeeChatsData)
      }

      chats.sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime())

      setEmployeeChats(chats)
    } catch (error) {
      console.error('Error loading employee chats:', error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const filterChats = () => {
    if (!searchTerm) {
      setFilteredChats(employeeChats)
      return
    }
    const filtered = employeeChats.filter(chat =>
      chat.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chat.employee_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chat.last_message.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredChats(filtered)
  }

  const loadMessages = async (chat: EmployeeChat) => {
    try {
      const { data: messageData, error } = await supabase
        .from('xin_employee_messages')
        .select('*')
        .eq('employee_id', chat.employee_id)
        .order('created_at', { ascending: true })

      if (error) throw error
      const data = messageData || []

      if (data.length > 0) {
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

        if (user) {
          const incomingIds = data
            .filter(msg => msg.sender_type === 'employee')
            .map(msg => msg.message_id)

          if (incomingIds.length > 0) {
            const readRecords = incomingIds.map(msgId => ({
              admin_user_id: user.user_id,
              message_type: 'employee',
              message_id: msgId
            }))
            await supabase
              .from('xin_admin_message_reads')
              .upsert(readRecords, { onConflict: 'admin_user_id,message_type,message_id' })
          }
        }
      } else {
        setMessages([])
      }
    } catch (error) {
      console.error('Error loading messages:', error)
      setMessages([])
    }
  }

  const handleMarkAllRead = async () => {
    if (!user) return
    try {
      const { data: empMessages } = await supabase
        .from('xin_employee_messages')
        .select('message_id')
        .eq('sender_type', 'employee')

      const readRecords = (empMessages || []).map(m => ({
        admin_user_id: user.user_id, message_type: 'employee', message_id: m.message_id
      }))

      if (readRecords.length > 0) {
        for (let i = 0; i < readRecords.length; i += 500) {
          const batch = readRecords.slice(i, i + 500)
          await supabase
            .from('xin_admin_message_reads')
            .upsert(batch, { onConflict: 'admin_user_id,message_type,message_id' })
        }
      }
      await loadEmployeeChats(false)
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const handleSelectEmployee = (chat: EmployeeChat) => {
    prevMessageCountRef.current = 0
    shouldScrollRef.current = true
    setSelectedChatId(chat.chat_id)
    setShowInfoPanel(false)
    setInfoPanelData(null)
    navigate(`/admin/chat-inquiries/${encodeThreadId(chat)}`, { replace: true })
  }

  const loadInfoPanel = async () => {
    if (!selectedEmployee) return
    if (showInfoPanel) {
      setShowInfoPanel(false)
      return
    }
    try {
      setInfoPanelLoading(true)
      setShowInfoPanel(true)
      setInfoPanelData(null)

      const { data, error } = await supabase
        .from('xin_employees')
        .select('*')
        .eq('user_id', selectedEmployee.employee_id)
        .maybeSingle()

      if (error) throw error

      if (data) {
        const [companyData, designationData, roleData] = await Promise.all([
          data.company_id ? supabase.from('xin_companies').select('name').eq('company_id', data.company_id).maybeSingle() : null,
          data.designation_id ? supabase.from('xin_designations').select('designation_name').eq('designation_id', data.designation_id).maybeSingle() : null,
          data.user_role_id ? supabase.from('xin_user_roles').select('role_name').eq('role_id', data.user_role_id).maybeSingle() : null
        ])

        setInfoPanelData({
          ...data,
          company_name: companyData?.data?.name || '',
          designation_name: designationData?.data?.designation_name || '',
          role_name: roleData?.data?.role_name || ''
        })
      }
    } catch (error) {
      console.error('Error loading info panel:', error)
    } finally {
      setInfoPanelLoading(false)
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

  const handleSuggestReply = async () => {
    if (!selectedEmployee || aiLoading) return
    setAiLoading(true)
    setAiSuggestion(null)

    const employeeContext = [
      `Name: ${selectedEmployee.employee_name}`,
      selectedEmployee.employee_email ? `Email: ${selectedEmployee.employee_email}` : '',
      selectedEmployee.employee_company ? `Company: ${selectedEmployee.employee_company}` : ''
    ].filter(Boolean).join('\n')

    const adminName = user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.username || 'Admin'

    const suggestion = await generateAISuggestion(messages, selectedEmployee.employee_name, employeeContext, adminName)
    if (suggestion) {
      setAiSuggestion(suggestion)
      setAiOriginalText(suggestion.text)
      setIsEditingSuggestion(false)

      // Log to audit table (pending action)
      try {
        const recentHistory = messages
          .slice(-10)
          .map(m => `${m.sender_type}: ${m.message}`)
          .join('\n')

        const { data } = await supabase
          .from('xin_ai_audit')
          .insert({
            admin_user_id: user!.user_id,
            employee_id: selectedEmployee.employee_id,
            prompt: recentHistory,
            ai_response: suggestion.text,
            confidence: suggestion.confidence,
            citations: suggestion.citations,
            action: null
          })
          .select('audit_id')
          .single()
        if (data) setAiAuditId(data.audit_id)
      } catch (err) {
        console.error('Failed to log AI suggestion:', err)
      }
    } else {
      notify('error', 'AI Error', 'Could not generate a suggestion. Check your API key.')
    }
    setAiLoading(false)
  }

  const handleDiscardSuggestion = async () => {
    if (aiAuditId) {
      await supabase.from('xin_ai_audit').update({ action: 'rejected' }).eq('audit_id', aiAuditId)
      await loadAiStats()
    }
    setAiSuggestion(null)
    setAiAuditId(null)
    setAiOriginalText('')
    setIsEditingSuggestion(false)
  }

  const handleApplySuggestion = () => {
    if (!aiSuggestion) return
    setNewMessage(aiSuggestion.text)
    setAiSuggestion(null)
    setIsEditingSuggestion(false)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!newMessage.trim() && !selectedFile) || !selectedEmployee || !user) return

    try {
      setSendingMessage(true)
      setUploading(!!selectedFile)

      let attachmentUrl = null
      let attachmentName = null
      let attachmentType = null

      if (selectedFile) {
        const timestamp = Date.now()
        const filePath = `admin/${selectedEmployee.employee_id}/${timestamp}/${selectedFile.name}`
        const { error: uploadError } = await supabase.storage
          .from('chat-attachments').upload(filePath, selectedFile)
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(filePath)
        attachmentUrl = publicUrl
        attachmentName = selectedFile.name
        attachmentType = selectedFile.type
      }

      const finalMessage = newMessage.trim() || '(Attachment)'
      const isAiAssisted = !!aiAuditId
      const wasEdited = isAiAssisted && finalMessage !== aiOriginalText

      const { error } = await supabase
        .from('xin_employee_messages')
        .insert({
          employee_id: selectedEmployee.employee_id,
          message: finalMessage,
          sender_type: 'admin',
          is_read: false,
          admin_user_id: user.user_id,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          attachment_type: attachmentType,
          is_ai_assisted: isAiAssisted,
          ai_original_content: isAiAssisted ? aiOriginalText : null
        })
      if (error) throw error

      // Update audit record with final action
      if (aiAuditId) {
        await supabase.from('xin_ai_audit').update({
          action: wasEdited ? 'edited' : 'accepted',
          final_message: finalMessage
        }).eq('audit_id', aiAuditId)
        setAiAuditId(null)
        setAiOriginalText('')
        await loadAiStats()
      }

      setNewMessage('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      shouldScrollRef.current = true
      await loadMessages(selectedEmployee)
      await loadEmployeeChats(false)
    } catch (error: any) {
      console.error('Error sending message:', error)
      notify('error', 'Send Failed', `Failed to send message: ${error.message || 'Unknown error'}`)
    } finally {
      setSendingMessage(false)
      setUploading(false)
    }
  }

  const isConversationResolved = () => {
    if (messages.length === 0) return false
    const lastResolvedIdx = messages.findLastIndex(m => m.sender_type === 'system')
    if (lastResolvedIdx === -1) return false
    const hasNewMessageAfter = messages.slice(lastResolvedIdx + 1).some(m => m.sender_type === 'employee')
    return !hasNewMessageAfter
  }

  const handleResolve = async () => {
    if (!selectedEmployee || !user || resolving) return
    try {
      setResolving(true)
      const adminName = user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.username || 'Admin'
      const { error } = await supabase
        .from('xin_employee_messages')
        .insert({
          employee_id: selectedEmployee.employee_id,
          message: `Your concern has been marked as resolved by ${adminName}`,
          sender_type: 'system',
          is_read: false,
          admin_user_id: user.user_id
        })
      if (error) throw error
      shouldScrollRef.current = true
      await loadMessages(selectedEmployee)
    } catch (error: any) {
      console.error('Error marking as resolved:', error)
      notify('error', 'Resolve Failed', `Failed to mark as resolved: ${error.message || 'Unknown error'}`)
    } finally {
      setResolving(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const diff = Date.now() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const getFileIcon = (type?: string) => {
    if (!type) return <FileText className="w-4 h-4" />
    if (type.startsWith('image/')) return <ImageIcon className="w-4 h-4" />
    return <FileText className="w-4 h-4" />
  }
  const isImageFile = (type?: string) => type?.startsWith('image/')

  return (
    <div className="flex h-[calc(100vh-6rem)] lg:h-[calc(100vh-4rem)] bg-gray-100">
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-6 h-6 text-gray-700" />
            <h1 className="text-xl font-bold text-gray-900">Chat Inquiries</h1>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Admin Online</span>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => loadEmployeeChats(false)}
              className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded text-blue-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 px-3 h-10 bg-gray-100 hover:bg-gray-200 rounded text-green-600 transition-colors text-sm font-medium"
              title="Mark all conversations as read"
            >
              <CheckCheck className="w-4 h-4" />
              Read All
            </button>
            <button
              onClick={() => setShowAiStats(!showAiStats)}
              className={`flex items-center justify-center w-10 h-10 rounded transition-colors ml-auto ${
                showAiStats ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 hover:bg-gray-200 text-purple-600'
              }`}
              title="AI Metrics Dashboard"
            >
              <BarChart2 className="w-5 h-5" />
            </button>
          </div>

          {showAiStats && (
            <div className="mb-4 bg-purple-50 border border-purple-100 rounded-lg p-3">
              <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI Metrics
              </h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white rounded py-1.5 border border-purple-100">
                  <div className="text-lg font-bold text-green-600 leading-none">{aiStats.accepted}</div>
                  <div className="text-[10px] text-gray-500 font-medium uppercase mt-1">Accepted</div>
                </div>
                <div className="bg-white rounded py-1.5 border border-purple-100">
                  <div className="text-lg font-bold text-blue-600 leading-none">{aiStats.edited}</div>
                  <div className="text-[10px] text-gray-500 font-medium uppercase mt-1">Edited</div>
                </div>
                <div className="bg-white rounded py-1.5 border border-purple-100">
                  <div className="text-lg font-bold text-red-500 leading-none">{aiStats.rejected}</div>
                  <div className="text-[10px] text-gray-500 font-medium uppercase mt-1">Rejected</div>
                </div>
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No chats found</p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <div
                key={chat.chat_id}
                onClick={() => handleSelectEmployee(chat)}
                className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                  selectedEmployee?.chat_id === chat.chat_id
                    ? 'bg-blue-50 border-l-4 border-l-blue-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold flex-shrink-0">
                    {chat.employee_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">
                        {chat.employee_name}
                      </h3>
                      {chat.unread_count > 0 && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full ml-2 flex-shrink-0">
                          {chat.unread_count}
                        </span>
                      )}
                    </div>
                    {chat.employee_email && (
                      <p className="text-xs text-gray-500 truncate mb-1">{chat.employee_email}</p>
                    )}
                    {chat.employee_company && (
                      <p className="text-xs text-gray-500 truncate mb-1">{chat.employee_company}</p>
                    )}
                    <p className="text-xs text-gray-600 truncate">{chat.last_message}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(chat.last_message_time)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedEmployee ? (
          <>
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-gray-900">{selectedEmployee.employee_name}</h2>
                      <button
                        onClick={loadInfoPanel}
                        className={`p-1.5 rounded-full transition-colors ${
                          showInfoPanel
                            ? 'bg-blue-100 text-blue-600'
                            : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                        }`}
                        title="View details"
                      >
                        <Info className="w-5 h-5" />
                      </button>
                    </div>
                    {selectedEmployee.employee_company && (
                      <p className="text-sm font-semibold text-blue-600 mb-0.5">{selectedEmployee.employee_company}</p>
                    )}
                    {selectedEmployee.employee_contact && (
                      <p className="text-sm text-gray-600 mb-0.5">{selectedEmployee.employee_contact}</p>
                    )}
                    {selectedEmployee.employee_email && (
                      <p className="text-sm text-gray-500">{selectedEmployee.employee_email}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleResolve}
                  disabled={resolving || isConversationResolved()}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isConversationResolved()
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  } disabled:opacity-70`}
                >
                  <CheckCircle className="w-4 h-4" />
                  {resolving ? 'Resolving...' : isConversationResolved() ? 'Resolved ✓' : 'Resolve'}
                </button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>No messages yet</p>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      message.sender_type === 'system' ? (
                        <div key={message.message_id} className="mb-4 flex justify-center">
                          <div className="bg-gray-200 rounded-full px-4 py-2 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <p className="text-xs text-gray-600">{message.message}</p>
                          </div>
                        </div>
                      ) : (
                      <div key={message.message_id} className="mb-4 flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${
                          message.sender_type === 'admin'
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-green-100 text-green-600'
                        }`}>
                          {message.sender_type === 'admin' ? 'A' : selectedEmployee.employee_name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="bg-white rounded-lg shadow-sm p-4">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-sm text-gray-900">
                                {message.sender_type === 'admin'
                                  ? (message.admin_name || 'Admin')
                                  : selectedEmployee.employee_name}
                              </h4>
                              {message.is_ai_assisted && message.ai_original_content && message.ai_original_content !== message.message && (
                                <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full flex items-center gap-1 font-medium" title="Admin edited the AI's draft before sending">
                                  ✏️ edited by admin
                                </span>
                              )}
                              {message.is_ai_assisted && message.ai_original_content && message.ai_original_content === message.message && (
                                <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full flex items-center gap-1 font-medium" title="Sent exactly as drafted by AI">
                                  ✨ AI Drafted
                                </span>
                              )}
                            </div>
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
                                    className="flex items-center gap-2 p-2 bg-gray-100 hover:bg-gray-200 rounded"
                                  >
                                    {getFileIcon(message.attachment_type)}
                                    <span className="text-xs truncate">{message.attachment_name}</span>
                                  </a>
                                )}
                              </div>
                            )}
                            {message.message !== '(Attachment)' && (
                              <p className="text-sm text-gray-800">{message.message}</p>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1 ml-4">
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                      )
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {showInfoPanel && (
                <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto flex-shrink-0 flex flex-col">
                  <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
                    <h3 className="font-semibold text-gray-800 text-sm tracking-tight">Profile Details</h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => window.open(`/admin/employees/detail/${selectedEmployee.employee_id}`, '_blank')}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Open Employee Details Page"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowInfoPanel(false)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {infoPanelLoading ? (
                    <div className="flex justify-center items-center py-16">
                      <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-200 border-t-blue-500"></div>
                    </div>
                  ) : infoPanelData ? (
                    <div className="p-4 space-y-4">
                      <div className="p-4 text-center">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-2.5 shadow-sm">
                          {infoPanelData.first_name.charAt(0)}{infoPanelData.last_name.charAt(0)}
                        </div>
                        <h4 className="font-bold text-gray-900 text-sm leading-snug">
                          {infoPanelData.first_name} {infoPanelData.middle_name ? infoPanelData.middle_name + ' ' : ''}{infoPanelData.last_name}
                        </h4>
                        <p className="text-xs text-blue-600 font-medium mt-0.5">{infoPanelData.designation_name || '—'}</p>
                        <div className="mt-2.5 flex items-center justify-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            infoPanelData.is_active === 1
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              infoPanelData.is_active === 1 ? 'bg-green-500' : 'bg-gray-400'
                            }`}></span>
                            {infoPanelData.is_active === 1 ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>

                      <InfoSection icon={<User className="w-3.5 h-3.5" />} title="Personal">
                        <InfoRow label="Email" value={infoPanelData.email} />
                        <InfoRow label="Contact" value={infoPanelData.contact_no} />
                        <InfoRow label="Birthday" value={infoPanelData.date_of_birth} />
                        <InfoRow label="Birth Place" value={infoPanelData.birth_place} />
                        <InfoRow label="Gender" value={infoPanelData.gender} />
                        <InfoRow label="Civil Status" value={infoPanelData.marital_status} />
                      </InfoSection>

                      <InfoSection icon={<Briefcase className="w-3.5 h-3.5" />} title="Employment">
                        <InfoRow label="Company" value={infoPanelData.company_name} />
                        <InfoRow label="Designation" value={infoPanelData.designation_name} />
                        <InfoRow label="Role" value={infoPanelData.role_name} />
                        <InfoRow label="Employee ID" value={infoPanelData.employee_id} mono />
                        <InfoRow label="Biometric ID" value={infoPanelData.biometric_id} mono />
                        <InfoRow label="Sub Location" value={infoPanelData.sub_location} />
                        <InfoRow label="Date Joined" value={infoPanelData.date_of_joining} />
                      </InfoSection>

                      <InfoSection icon={<CreditCard className="w-3.5 h-3.5" />} title="Government IDs">
                        <InfoRow label="SSS" value={infoPanelData.sss_no} mono />
                        <InfoRow label="PhilHealth" value={infoPanelData.philhealth_no} mono />
                        <InfoRow label="Pag-IBIG" value={infoPanelData.pagibig_no} mono />
                        <InfoRow label="TIN" value={infoPanelData.tin_no} mono />
                        <InfoRow label="NBI Issuance" value={infoPanelData.nbi_exp} />
                        <InfoRow label="Healthcard Exp" value={infoPanelData.healthcard_exp} />
                      </InfoSection>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                        <User className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-medium text-gray-500">No details available</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white border-t border-gray-200 p-4">
              {/* AI Suggestion Card */}
              {aiSuggestion && (
                <div className="mb-3 border border-purple-200 bg-purple-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      <span className="text-xs font-semibold text-purple-700">AI Suggested Reply</span>
                      <span className="text-xs text-purple-400">via OpenAI</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        aiSuggestion.confidence >= 75 ? 'bg-green-100 text-green-700' :
                        aiSuggestion.confidence >= 50 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {aiSuggestion.confidence}% confident
                      </span>
                    </div>
                    <button onClick={handleDiscardSuggestion} className="text-gray-400 hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {isEditingSuggestion ? (
                    <textarea
                      value={aiSuggestion.text}
                      onChange={(e) => setAiSuggestion({ ...aiSuggestion, text: e.target.value })}
                      className="w-full text-sm text-gray-800 mb-2 p-2 rounded border border-purple-300 focus:ring-2 focus:ring-purple-500 outline-none"
                      rows={4}
                    />
                  ) : (
                    <>
                      {aiOriginalText && aiSuggestion.text !== aiOriginalText && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium mb-1">
                          ✏️ edited by admin
                        </span>
                      )}
                      <p className="text-sm text-gray-800 mb-2 leading-relaxed">{aiSuggestion.text}</p>
                    </>
                  )}
                  {aiSuggestion.citations.length > 0 && (
                    <p className="text-xs text-purple-500 mb-2 italic">Based on: {aiSuggestion.citations.join(' · ')}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleApplySuggestion}
                      className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Apply to input
                    </button>
                    <button
                      onClick={() => setIsEditingSuggestion(!isEditingSuggestion)}
                      className="text-xs px-3 py-1.5 bg-white text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
                    >
                      {isEditingSuggestion ? 'Done Editing' : 'Edit'}
                    </button>
                  </div>
                </div>
              )}

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

              {aiAuditId && newMessage.trim() && (
                <div className="mb-2 flex items-center">
                  {newMessage !== aiOriginalText ? (
                    <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium shadow-sm">
                      ✏️ edited by admin
                    </span>
                  ) : (
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium shadow-sm">
                      ✨ AI Draft
                    </span>
                  )}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
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
                  disabled={sendingMessage || uploading}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded transition-colors disabled:opacity-50"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={sendingMessage || uploading}
                />
                <button
                  type="button"
                  onClick={handleSuggestReply}
                  disabled={aiLoading || sendingMessage || messages.length === 0}
                  className="px-3 py-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50 flex items-center gap-1.5 text-sm font-medium"
                  title="Generate AI reply suggestion"
                >
                  <Sparkles className="w-4 h-4" />
                  {aiLoading ? 'Thinking...' : 'Suggest'}
                </button>
                <button
                  type="submit"
                  disabled={(!newMessage.trim() && !selectedFile) || sendingMessage || uploading}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {uploading ? 'UPLOADING...' : 'SEND'}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-500">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg">Select an employee to view conversation</p>
            </div>
          </div>
        )}
      </div>

      <NotificationDialog
        isOpen={notification.isOpen}
        onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />
    </div>
  )
}
