import { useCallback, useEffect, useRef, useState } from 'react'
import { LogOut, MessageCircle, Send } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Message } from '../types'

export function EmployeeChat() {
  const { user, logout } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('employee_id', user.user_id)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
  }, [user])

  useEffect(() => {
    void load()
    if (!user) return

    const channel = supabase
      .channel(`employee-chat-${user.user_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `employee_id=eq.${user.user_id}`
        },
        () => void load()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, load])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !draft.trim() || sending) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      employee_id: user.user_id,
      message: draft.trim(),
      sender_type: 'employee'
    })
    setSending(false)
    if (!error) {
      setDraft('')
      await load()
    }
  }

  if (!user) return null

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">Chat Support</h1>
            <p className="text-xs text-gray-500">Signed in as {user.name}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <MessageCircle className="w-12 h-12 mx-auto mb-3" />
            <p>No messages yet — say hi to start the conversation.</p>
          </div>
        ) : (
          messages.map((m) =>
            m.sender_type === 'system' ? (
              <div key={m.message_id} className="flex justify-center">
                <span className="text-xs text-gray-500 bg-gray-200 rounded-full px-3 py-1">
                  {m.message}
                </span>
              </div>
            ) : (
              <div
                key={m.message_id}
                className={`flex ${m.sender_type === 'employee' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    m.sender_type === 'employee'
                      ? 'bg-green-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      m.sender_type === 'employee' ? 'text-green-100' : 'text-gray-400'
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
          )
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="bg-white border-t border-gray-200 p-4 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your message…"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 disabled:bg-gray-300 flex items-center gap-1 text-sm"
        >
          <Send className="w-4 h-4" />
          Send
        </button>
      </form>
    </div>
  )
}
