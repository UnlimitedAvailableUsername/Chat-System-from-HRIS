import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Bot, ThumbsUp, ThumbsDown, Pencil, TrendingUp, MessageSquare, BarChart3, Clock } from 'lucide-react'

interface AuditRow {
  audit_id: number
  employee_id: number
  admin_user_id: number
  prompt: string
  ai_response: string
  final_message: string | null
  action: 'accepted' | 'edited' | 'rejected'
  confidence: number
  created_at: string
  employee_name?: string
  admin_name?: string
}

interface Stats {
  total: number
  accepted: number
  edited: number
  rejected: number
  avg_confidence: number
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-600 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function ActionBadge({ action }: { action: 'accepted' | 'edited' | 'rejected' }) {
  const map = {
    accepted: 'bg-green-100 text-green-700',
    edited:   'bg-yellow-100 text-yellow-700',
    rejected: 'bg-red-100 text-red-700',
  }
  const labels = { accepted: 'Accepted', edited: 'Edited', rejected: 'Rejected' }
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${map[action]}`}>
      {labels[action]}
    </span>
  )
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const cls =
    confidence >= 85 ? 'bg-green-100 text-green-700' :
    confidence >= 70 ? 'bg-yellow-100 text-yellow-700' :
                       'bg-red-100 text-red-700'
  const label =
    confidence >= 85 ? 'High' :
    confidence >= 70 ? 'Medium' : 'Low'
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {confidence}% · {label}
    </span>
  )
}

export function AiAuditDashboard() {
  const [rows, setRows]   = useState<AuditRow[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, accepted: 0, edited: 0, rejected: 0, avg_confidence: 0 })
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [actionFilter, setActionFilter] = useState<'all' | 'accepted' | 'edited' | 'rejected'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)

      const { data: auditData, error } = await supabase
        .from('xin_ai_audit')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      const data: AuditRow[] = auditData || []


      const empIds   = [...new Set(data.map(r => r.employee_id))]
      const adminIds = [...new Set(data.map(r => r.admin_user_id))]

      const [empRes, adminRes] = await Promise.all([
        empIds.length   ? supabase.from('xin_employees').select('user_id, first_name, last_name').in('user_id', empIds)   : Promise.resolve({ data: [] }),
        adminIds.length ? supabase.from('xin_employees').select('user_id, first_name, last_name').in('user_id', adminIds) : Promise.resolve({ data: [] }),
      ])

      const empMap   = new Map((empRes.data   || []).map(e => [e.user_id, `${e.first_name} ${e.last_name}`]))
      const adminMap = new Map((adminRes.data  || []).map(e => [e.user_id, `${e.first_name} ${e.last_name}`]))

      const enriched = data.map(r => ({
        ...r,
        employee_name: empMap.get(r.employee_id)   || `Employee ${r.employee_id}`,
        admin_name:    adminMap.get(r.admin_user_id) || `Admin ${r.admin_user_id}`,
      }))

      setRows(enriched)

      const total    = enriched.length
      const accepted = enriched.filter(r => r.action === 'accepted').length
      const edited   = enriched.filter(r => r.action === 'edited').length
      const rejected = enriched.filter(r => r.action === 'rejected').length
      const avg_confidence = total > 0
        ? Math.round(enriched.reduce((s, r) => s + r.confidence, 0) / total)
        : 0

      setStats({ total, accepted, edited, rejected, avg_confidence })
    } catch (err) {
      console.error('Error loading audit:', err)
    } finally {
      setLoading(false)
    }
  }

  const acceptRate = stats.total > 0 ? Math.round(((stats.accepted + stats.edited) / stats.total) * 100) : 0

  const filtered = rows.filter((r) => {
    const matchesAction = actionFilter === 'all' ? true : r.action === actionFilter

    const q = searchTerm.toLowerCase().trim()

    const matchesSearch =
            !q ||
            r.employee_name?.toLowerCase().includes(q) ||
            r.admin_name?.toLowerCase().includes(q) ||
            r.ai_response?.toLowerCase().includes(q) ||
            r.final_message?.toLowerCase().includes(q)

        return matchesAction && matchesSearch
    })

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <Bot className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">AI Draft Audit</h1>
          <p className="text-sm text-gray-500">Track AI suggestion performance and admin decisions</p>
        </div>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<MessageSquare className="w-5 h-5 text-purple-600" />}
              label="Total Suggestions"
              value={stats.total}
              sub="AI drafts generated"
              color="bg-purple-50"
            />
            <StatCard
              icon={<ThumbsUp className="w-5 h-5 text-green-600" />}
              label="Accepted"
              value={stats.accepted}
              sub={`${stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0}% of total`}
              color="bg-green-50"
            />
            <StatCard
              icon={<Pencil className="w-5 h-5 text-yellow-600" />}
              label="Edited"
              value={stats.edited}
              sub={`${stats.total > 0 ? Math.round((stats.edited / stats.total) * 100) : 0}% of total`}
              color="bg-yellow-50"
            />
            <StatCard
              icon={<ThumbsDown className="w-5 h-5 text-red-600" />}
              label="Rejected"
              value={stats.rejected}
              sub={`${stats.total > 0 ? Math.round((stats.rejected / stats.total) * 100) : 0}% of total`}
              color="bg-red-50"
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-700">Decision Breakdown</h2>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm font-semibold text-green-600">{acceptRate}% use rate</span>
                <span className="text-xs text-gray-400">(accepted + edited)</span>
              </div>
            </div>

            {stats.total > 0 ? (
              <div className="space-y-2">
                <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                  {stats.accepted > 0 && (
                    <div
                      className="bg-green-400 transition-all"
                      style={{ width: `${(stats.accepted / stats.total) * 100}%` }}
                      title={`Accepted: ${stats.accepted}`}
                    />
                  )}
                  {stats.edited > 0 && (
                    <div
                      className="bg-yellow-400 transition-all"
                      style={{ width: `${(stats.edited / stats.total) * 100}%` }}
                      title={`Edited: ${stats.edited}`}
                    />
                  )}
                  {stats.rejected > 0 && (
                    <div
                      className="bg-red-400 transition-all"
                      style={{ width: `${(stats.rejected / stats.total) * 100}%` }}
                      title={`Rejected: ${stats.rejected}`}
                    />
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Accepted</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />Edited</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Rejected</span>
                  <span className="ml-auto">Avg confidence: <strong className="text-gray-700">{stats.avg_confidence}%</strong></span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No data yet.</p>
            )}
          </div>

          {/* Audit Log Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                <div className="relative w-full sm:w-72">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search employee, admin, or message..."
                        className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-700">Audit Log</h2>
                <span className="text-xs text-gray-400">({filtered.length} records)</span>
              </div>
              <div className="flex items-center gap-1">
                {(['all', 'accepted', 'edited', 'rejected'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setActionFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                      actionFilter === f
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Bot className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No audit records yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map(row => (
                  <div key={row.audit_id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-gray-900">{row.employee_name}</span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-500">by {row.admin_name}</span>
                          <ActionBadge action={row.action} />
                          <ConfidenceBadge confidence={row.confidence} />
                        </div>
                        <p className="text-xs text-gray-400 mb-2">{formatTime(row.created_at)}</p>

                        <div className="bg-purple-50 rounded-lg px-3 py-2 mb-2">
                          <p className="text-[11px] font-semibold text-purple-600 mb-1">AI Draft</p>
                          <p className="text-xs text-gray-700 line-clamp-2">{row.ai_response}</p>
                        </div>

                        {/* Final message if accepted/edited */}
                        {row.final_message && row.action !== 'rejected' && (
                          <div className={`rounded-lg px-3 py-2 ${row.action === 'edited' ? 'bg-yellow-50' : 'bg-green-50'}`}>
                            <p className={`text-[11px] font-semibold mb-1 ${row.action === 'edited' ? 'text-yellow-600' : 'text-green-600'}`}>
                              {row.action === 'edited' ? 'Edited & Sent' : 'Sent As-Is'}
                            </p>
                            <p className="text-xs text-gray-700 line-clamp-2">{row.final_message}</p>
                          </div>
                        )}

                        {/* Expandable prompt */}
                        {row.prompt && row.prompt !== '(generated server-side)' && (
                          <button
                            onClick={() => setExpandedId(expandedId === row.audit_id ? null : row.audit_id)}
                            className="mt-2 text-[11px] text-purple-500 hover:text-purple-700 font-medium"
                          >
                            {expandedId === row.audit_id ? 'Hide prompt ▲' : 'View prompt ▼'}
                          </button>
                        )}

                        {expandedId === row.audit_id && (
                          <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                            <p className="text-[11px] font-semibold text-gray-500 mb-1">Prompt sent to AI</p>
                            <pre className="text-[11px] text-gray-600 whitespace-pre-wrap font-mono">{row.prompt}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
