import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface EmployeeChatNotificationState {
  unreadCount: number
  loading: boolean
}

/**
 * Hook to fetch unread chat message count for an employee.
 * Counts messages from admin that the employee hasn't read yet.
 */
export function useEmployeeChatNotifications(employeeId: number | undefined): EmployeeChatNotificationState {
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!employeeId) {
      setLoading(false)
      return
    }

    let cancelled = false

    const fetchCount = async () => {
      try {
        const { count, error } = await supabase
          .from('xin_employee_messages')
          .select('message_id', { count: 'exact', head: true })
          .eq('employee_id', employeeId)
          .eq('sender_type', 'admin')
          .eq('is_read', false)

        if (error) throw error
        if (cancelled) return

        setUnreadCount(count || 0)
      } catch (err) {
        console.error('Error fetching employee chat notifications:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchCount()

    const channel = supabase
      .channel(`emp-chat-notif-${employeeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'xin_employee_messages',
          filter: `employee_id=eq.${employeeId}`,
        },
        () => { fetchCount() }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [employeeId])

  return { unreadCount, loading }
}
