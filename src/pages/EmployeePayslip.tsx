import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext'
import { EmployeeLayout } from '../components/EmployeeLayout'
import { supabase } from '../lib/supabase'
import { FileText, ChevronDown, ChevronUp, Wallet } from 'lucide-react'

interface Payslip {
  payroll_report_id: number
  employee_id: number
  cutoff_date_start: string
  cutoff_date_end: string
  regular_pay: string
  overtime_pay: string
  holiday_pay: string
  gross_pay: string
  sss_contribution: string
  philhealth_contribution: string
  pagibig_contribution: string
  tax: string
  total_deduction: string
  net_pay: string
}

const peso = (s: string | null | undefined) => {
  const n = parseFloat((s ?? '0').replace(/,/g, '')) || 0
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

const formatRange = (start: string, end: string) => {
  const fmt = (d: string) => {
    if (!d) return ''
    const date = new Date(d)
    return isNaN(date.getTime())
      ? d
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return `${fmt(start)} – ${fmt(end)}`
}

export function EmployeePayslip() {
  const { user, loading: authLoading } = useEmployeeAuth()
  const navigate = useNavigate()
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<number | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/employee')
      return
    }
    if (user) loadPayslips()
  }, [user, authLoading, navigate])

  async function loadPayslips() {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('xin_payroll_report_temp')
      .select('*')
      .eq('employee_id', user.user_id)
      .order('cutoff_date_end', { ascending: false })
    if (!error && data) setPayslips(data)
    setLoading(false)
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <EmployeeLayout>
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <Wallet className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">My Payslips</h2>
            <p className="text-xs text-gray-600">{user.first_name} {user.last_name}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Loading payslips...
        </div>
      ) : payslips.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No payslips yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payslips.map((p) => {
            const isOpen = openId === p.payroll_report_id
            return (
              <div key={p.payroll_report_id} className="bg-white rounded-lg shadow overflow-hidden">
                <button
                  onClick={() => setOpenId(isOpen ? null : p.payroll_report_id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      {formatRange(p.cutoff_date_start, p.cutoff_date_end)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Net Pay</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-[#006a22] text-lg">{peso(p.net_pay)}</p>
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3 text-sm">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
                        Earnings
                      </p>
                      <div className="bg-white rounded-lg px-3 py-2 divide-y divide-gray-100">
                        <Row label="Regular Pay"  value={peso(p.regular_pay)} />
                        <Row label="Overtime Pay" value={peso(p.overtime_pay)} />
                        <Row label="Holiday Pay"  value={peso(p.holiday_pay)} />
                        <Row label="Gross Pay"    value={peso(p.gross_pay)} bold />
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
                        Deductions
                      </p>
                      <div className="bg-white rounded-lg px-3 py-2 divide-y divide-gray-100">
                        <Row label="SSS"        value={peso(p.sss_contribution)} />
                        <Row label="PhilHealth" value={peso(p.philhealth_contribution)} />
                        <Row label="Pag-IBIG"   value={peso(p.pagibig_contribution)} />
                        <Row label="Tax"        value={peso(p.tax)} />
                        <Row label="Total Deductions" value={peso(p.total_deduction)} bold />
                      </div>
                    </div>

                    <div className="bg-[#006a22] rounded-lg px-4 py-3 flex items-center justify-between">
                      <span className="text-white font-semibold text-sm">Net Pay</span>
                      <span className="text-white font-bold text-lg">{peso(p.net_pay)}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </EmployeeLayout>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-xs ${bold ? 'text-gray-800 font-semibold' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-xs ${bold ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>{value}</span>
    </div>
  )
}
