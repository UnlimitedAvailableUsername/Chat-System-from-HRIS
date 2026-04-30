import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LogOut, MessageSquare, RefreshCw, Send } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Message, User } from '../types'

interface ConversationSummary {
  employee: User
  lastMessage: string
  lastTime: string
  unreadFromEmployee: number
}

export function AdminChat() {
  const { user, logout } = useAuth()
  const [employees, setEmployees] = useState<User[]>([])
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const [{ data: emps }, { data: msgs }] = await Promise.all([
      supabase.from('users').select('*').eq('role', 'employee').order('user_id'),
      supabase.from('messages').select('*').order('created_at', { ascending: true })
    ])
    setEmployees(emps ?? [])
    setAllMessages(msgs ?? [])
  }, [])

  useEffect(() => {
    void load()

    const channel = supabase
      .channel('admin-chat')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => void load()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load])

  const conversations: ConversationSummary[] = useMemo(() => {
    return employees
      .map((emp) => {
        const empMsgs = allMessages.filter((m) => m.employee_id === emp.user_id)
        const last = empMsgs[empMsgs.length - 1]
        const unread = empMsgs.filter((m) => m.sender_type === 'employee' && !m.is_read).length
        return {
          employee: emp,
          lastMessage: last?.message ?? '',
          lastTime: last?.created_at ?? '',
          unreadFromEmployee: unread
        }
      })
      .sort((a, b) => (b.lastTime || '').localeCompare(a.lastTime || ''))
  }, [employees, allMessages])

  const selectedMessages = useMemo(
    () => (selectedId ? allMessages.filter((m) => m.employee_id === selectedId) : []),
    [allMessages, selectedId]
  )

  const selectedEmployee = employees.find((e) => e.user_id === selectedId) ?? null

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedMessages.length])

  // Mark employee messages as read when admin opens the conversation.
  useEffect(() => {
    if (!selectedId) return
    const unreadIds = selectedMessages
      .filter((m) => m.sender_type === 'employee' && !m.is_read)
      .map((m) => m.message_id)
    if (unreadIds.length === 0) return
    void supabase.from('messages').update({ is_read: true }).in('message_id', unreadIds)
  }, [selectedId, selectedMessages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedId || !draft.trim() || sending) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      employee_id: selectedId,
      message: draft.trim(),
      sender_type: 'admin',
      admin_user_id: user.user_id
    })
    setSending(false)
    if (!error) {
      setDraft('')
      await load()
    }
  }

  if (!user) return null

  return (
    <div className="h-full flex bg-gray-100">
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <h1 className="font-bold text-gray-900">Chat Inquiries</h1>
            </div>
            <button
              onClick={() => void load()}
              className="p-1.5 text-gray-400 hover:text-blue-600"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-gray-500">Logged in as {user.name}</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">No conversations yet</div>
          ) : (
            conversations.map(({ employee, lastMessage, unreadFromEmployee }) => (
              <button
                key={employee.user_id}
                onClick={() => setSelectedId(employee.user_id)}
                className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition ${
                  selectedId === employee.user_id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-gray-900">{employee.name}</span>
                  {unreadFromEmployee > 0 && (
                    <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                      {unreadFromEmployee}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">{lastMessage || 'No messages yet'}</p>
              </button>
            ))
          )}
        </div>

        <button
          onClick={logout}
          className="border-t border-gray-200 p-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </aside>

      {/* Conversation pane */}
      <main className="flex-1 flex flex-col">
        {!selectedEmployee ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3" />
              <p>Select a conversation to start chatting</p>
            </div>
          </div>
        ) : (
          <>
            <header className="bg-white border-b border-gray-200 px-6 py-4">
              <h2 className="font-semibold text-gray-900">{selectedEmployee.name}</h2>
              <p className="text-xs text-gray-500">{selectedEmployee.email}</p>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {selectedMessages.map((m) =>
                m.sender_type === 'system' ? (
                  <div key={m.message_id} className="flex justify-center">
                    <span className="text-xs text-gray-500 bg-gray-200 rounded-full px-3 py-1">
                      {m.message}
                    </span>
                  </div>
                ) : (
                  <div
                    key={m.message_id}
                    className={`flex ${m.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        m.sender_type === 'admin'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-800'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                      <p
                        className={`text-[10px] mt-1 ${
                          m.sender_type === 'admin' ? 'text-blue-100' : 'text-gray-400'
                        }`}
                      >
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                )
              )}
              <div ref={endRef} />
            </div>

            <form onSubmit={send} className="bg-white border-t border-gray-200 p-4 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type your reply…"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 flex items-center gap-1 text-sm"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  )
}
