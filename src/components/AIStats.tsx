import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Stats {
  accepted: number
  edited: number
  rejected: number
}

export default function AIStats() {
  const [stats, setStats] = useState<Stats>({
    accepted: 0,
    edited: 0,
    rejected: 0,
  })

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)

    const getCount = async (action: string) => {
      const { count, error } = await supabase
        .from('xin_ai_audit')
        .select('*', { count: 'exact', head: true })
        .eq('admin_action', action)

      if (error) {
        console.error(error)
        return 0
      }

      return count || 0
    }

    const [accepted, edited, rejected] = await Promise.all([
      getCount('accepted'),
      getCount('edited'),
      getCount('rejected'),
    ])

    setStats({ accepted, edited, rejected })
    setLoading(false)
  }

  if (loading) return (
    <div className="flex items-center gap-1 text-xs text-indigo-300 animate-pulse">
      <span>···</span>
    </div>
  )

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex items-center gap-1 text-emerald-600 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
        {stats.accepted} accepted
      </span>
      <span className="flex items-center gap-1 text-amber-500 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
        {stats.edited} edited
      </span>
      <span className="flex items-center gap-1 text-rose-500 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
        {stats.rejected} rejected
      </span>
    </div>
  )
}