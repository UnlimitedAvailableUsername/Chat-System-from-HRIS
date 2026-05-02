import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Sparkles, CheckCircle, Edit3, XCircle, Trash2, Search, Filter, Calendar } from 'lucide-react'

export function AIMetrics() {
  const [stats, setStats] = useState({ accepted: 0, edited: 0, rejected: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAction, setFilterAction] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [showDatePicker, setShowDatePicker] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('xin_ai_audit')
        .select('*, employee:xin_employees!xin_ai_audit_employee_id_fkey(first_name, last_name)')
        .order('created_at', { ascending: false })
      
      if (error) throw error

      let accepted = 0, edited = 0, rejected = 0
      data?.forEach(row => {
        if (row.action === 'accepted') accepted++
        if (row.action === 'edited') edited++
        if (row.action === 'rejected') rejected++
      })

      setStats({ accepted, edited, rejected, total: data?.length || 0 })
      setLogs(data || [])
    } catch (err) {
      console.error('Error loading AI stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (auditId: number) => {
    if (!window.confirm('Are you sure you want to delete this log?')) return
    
    try {
      const { error } = await supabase.from('xin_ai_audit').delete().eq('audit_id', auditId)
      if (error) throw error
      await loadData()
    } catch (err) {
      console.error('Error deleting log:', err)
      alert('Failed to delete log')
    }
  }

  const filteredLogs = logs.filter(log => {
    const matchesAction = filterAction === 'all' || log.action === filterAction
    if (!matchesAction) return false

    if (startDate) {
      const logDate = new Date(log.created_at).toISOString().split('T')[0]
      if (logDate < startDate) return false
    }

    if (endDate) {
      const logDate = new Date(log.created_at).toISOString().split('T')[0]
      if (logDate > endDate) return false
    }

    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    const employeeName = log.employee ? `${log.employee.first_name} ${log.employee.last_name}`.toLowerCase() : ''
    
    return (
      (log.ai_response || '').toLowerCase().includes(searchLower) ||
      (log.final_message || '').toLowerCase().includes(searchLower) ||
      employeeName.includes(searchLower)
    )
  })

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-8 h-[calc(100vh-4rem)]">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Assistant Metrics</h1>
            <p className="text-gray-500">Track how often AI suggestions are being used by your team.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="text-sm font-medium text-gray-500 mb-1">Total Generated</div>
                <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-100">
                <div className="flex items-center gap-2 text-sm font-medium text-green-600 mb-1">
                  <CheckCircle className="w-4 h-4" /> Accepted As-Is
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.accepted}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-600 mb-1">
                  <Edit3 className="w-4 h-4" /> Edited Before Send
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.edited}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100">
                <div className="flex items-center gap-2 text-sm font-medium text-red-500 mb-1">
                  <XCircle className="w-4 h-4" /> Rejected
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.rejected}</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-gray-900 whitespace-nowrap">Recent Logs</h2>
                <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search logs, names, drafts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent w-full sm:w-64 outline-none transition-all"
                    />
                  </div>
                  <div className="relative flex items-center w-full sm:w-auto">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={filterAction}
                      onChange={(e) => setFilterAction(e.target.value)}
                      className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white outline-none cursor-pointer w-full"
                    >
                      <option value="all">All Actions</option>
                      <option value="accepted">Accepted</option>
                      <option value="edited">Edited</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="relative w-full sm:w-auto">
                    <button
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      className={`w-full sm:w-auto flex items-center gap-2 px-4 py-2 border rounded-lg text-sm transition-colors ${
                        startDate || endDate 
                          ? 'border-purple-300 bg-purple-50 text-purple-700' 
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Calendar className="w-4 h-4" />
                      {startDate && endDate ? `${startDate} to ${endDate}` :
                       startDate ? `From ${startDate}` :
                       endDate ? `Up to ${endDate}` : 'Select Date'}
                    </button>

                    {showDatePicker && (
                      <div className="absolute right-0 mt-2 p-4 bg-white border border-gray-200 rounded-xl shadow-lg z-10 w-72">
                        <div className="flex flex-col gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                            <input
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                            <input
                              type="date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                          </div>
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={() => { setStartDate(''); setEndDate(''); setShowDatePicker(false); }}
                              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                            >
                              Clear
                            </button>
                            <button
                              onClick={() => setShowDatePicker(false)}
                              className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100">
                      <th className="p-4 font-medium">Date</th>
                      <th className="p-4 font-medium">Action</th>
                      <th className="p-4 font-medium">Sent To</th>
                      <th className="p-4 font-medium w-1/3">Original AI Draft</th>
                      <th className="p-4 font-medium w-1/3">Final Message Sent</th>
                      <th className="p-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLogs.map((log) => (
                      <tr key={log.audit_id} className="hover:bg-gray-50">
                        <td className="p-4 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            log.action === 'accepted' ? 'bg-green-100 text-green-800' :
                            log.action === 'edited' ? 'bg-blue-100 text-blue-800' :
                            log.action === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {log.action || 'pending'}
                          </span>
                        </td>
                        <td className="p-4 text-xs font-medium text-gray-700">
                          {log.employee ? `${log.employee.first_name} ${log.employee.last_name}` : 'Unknown'}
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          <div className="max-h-24 overflow-y-auto whitespace-pre-wrap">{log.ai_response}</div>
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          <div className="max-h-24 overflow-y-auto whitespace-pre-wrap">{log.final_message || '-'}</div>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDelete(log.audit_id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors inline-flex"
                            title="Delete log"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-500">
                          {logs.length === 0 ? 'No AI logs recorded yet.' : 'No logs match your search filters.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
