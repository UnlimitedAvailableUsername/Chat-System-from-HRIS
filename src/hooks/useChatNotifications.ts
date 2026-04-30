import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Copied from production, with applicant message tracking removed (this build
// only handles employee chat).
export function useChatNotifications() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (user) {
      loadUnreadCount()

      const channel = supabase
        .channel(`chat-notifications-${user.user_id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'xin_employee_messages' },
          () => loadUnreadCount()
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'xin_admin_message_reads' },
          () => loadUnreadCount()
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user])

  const loadUnreadCount = async () => {
    try {
      if (!user) return

      const { data: empMessages, error: empError } = await supabase
        .from('xin_employee_messages')
        .select('message_id')
        .eq('sender_type', 'employee')

      if (empError) throw empError

      const { data: adminReads, error: readsError } = await supabase
        .from('xin_admin_message_reads')
        .select('message_type, message_id')
        .eq('admin_user_id', user.user_id)

      if (readsError) throw readsError

      const readEmployeeIds = new Set(
        (adminReads || []).filter(r => r.message_type === 'employee').map(r => r.message_id)
      )

      const unreadEmp = (empMessages || []).filter(m => !readEmployeeIds.has(m.message_id)).length
      setUnreadCount(unreadEmp)
    } catch (error) {
      console.error('Error loading unread count:', error)
    }
  }

  return unreadCount
}
