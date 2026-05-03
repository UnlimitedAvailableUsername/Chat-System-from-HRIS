// aiService.ts — Calls Groq API to generate AI-drafted replies for HR chat support.
// The API key is read from VITE_OPENAI_API_KEY in .env.local.
// NOTE: For production, proxy this through a Supabase Edge Function so the key isn't
// exposed in the browser bundle.

import { supabase } from './supabase'

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AIDraftResult {
  draft: string
  confidence: 'low' | 'medium' | 'high'
  confidenceScore: number
  citationNote: string
}

// ── HR FAQ — built-in knowledge base ─────────────────────────────────────────
const HR_FAQ = `
COMMON HR FAQs (use these to answer accurately):
- Payout schedule: Payroll is released every 15th and last day of the month. If it falls on a weekend or holiday, it is released the business day before.
- Payslip access: Employees can view payslips in the Employee Portal under the Payslip section.
- SSS contribution: Based on monthly salary bracket per SSS contribution table.
- PhilHealth contribution: 5% of monthly basic salary, shared equally by employee and employer.
- Pag-IBIG contribution: PHP 100/month for salaries below PHP 1,500; PHP 200/month for higher salaries.
- Overtime pay: 125% of hourly rate on regular days; 130% on rest days.
- Holiday pay: 100% additional pay on regular holidays; 30% on special non-working holidays.
- Leave credits: 15 days vacation leave and 15 days sick leave per year.
- 13th month pay: Released on or before December 24, equivalent to 1/12 of total basic salary for the year.
- Government IDs/numbers: Employees can check their SSS, PhilHealth, and Pag-IBIG numbers in their HRIS profile.
`

// ── Fetch employee's latest payslips from the database ────────────────────────
async function fetchEmployeePayslips(employeeId: number) {
  try {
    const { data } = await supabase
      .from('xin_payroll_report_temp')
      .select('*')
      .eq('employee_id', employeeId)
      .order('cutoff_date_end', { ascending: false })
      .limit(3)
    return data ?? []
  } catch {
    return []
  }
}

// ── Fetch employee profile from the database ──────────────────────────────────
async function fetchEmployeeProfile(employeeId: number) {
  try {
    const { data } = await supabase
      .from('xin_employees')
      .select('first_name, last_name, sss_no, philhealth_no, pagibig_no, tin_no, date_of_joining, contact_no, email')
      .eq('user_id', employeeId)
      .single()
    return data
  } catch {
    return null
  }
}

// ── Format payslips into readable text for the AI ─────────────────────────────
function formatPayslips(payslips: any[]): string {
  if (payslips.length === 0) return 'No payslip data found.'
  return payslips.map((p, i) => `
Payslip ${i + 1} — Cutoff: ${p.cutoff_date_start} to ${p.cutoff_date_end}
  Regular Pay:       PHP ${p.regular_pay}
  Overtime Pay:      PHP ${p.overtime_pay}
  Holiday Pay:       PHP ${p.holiday_pay}
  Gross Pay:         PHP ${p.gross_pay}
  SSS:               PHP ${p.sss_contribution}
  PhilHealth:        PHP ${p.philhealth_contribution}
  Pag-IBIG:          PHP ${p.pagibig_contribution}
  Tax:               PHP ${p.tax}
  Total Deductions:  PHP ${p.total_deduction}
  Net Pay:           PHP ${p.net_pay}
`).join('\n')
}

// ── Format profile into readable text for the AI ──────────────────────────────
function formatProfile(profile: any, name: string): string {
  if (!profile) return `Employee: ${name} (no profile data available)`
  return `
Employee Profile — ${name}
  SSS No:       ${profile.sss_no || 'N/A'}
  PhilHealth:   ${profile.philhealth_no || 'N/A'}
  Pag-IBIG:     ${profile.pagibig_no || 'N/A'}
  TIN:          ${profile.tin_no || 'N/A'}
  Email:        ${profile.email || 'N/A'}
  Contact:      ${profile.contact_no || 'N/A'}
  Date Joined:  ${profile.date_of_joining || 'N/A'}
`
}

// ── Main function ─────────────────────────────────────────────────────────────
export async function generateAIDraft(
  messages: AIMessage[],
  employeeName: string,
  employeeInfo?: { designation?: string; company?: string; employeeId?: number }
): Promise<AIDraftResult> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('VITE_OPENAI_API_KEY is not set in .env.local')
  }

  // Fetch real data from DB in parallel
  const [payslips, profile] = await Promise.all([
    employeeInfo?.employeeId ? fetchEmployeePayslips(employeeInfo.employeeId) : Promise.resolve([]),
    employeeInfo?.employeeId ? fetchEmployeeProfile(employeeInfo.employeeId) : Promise.resolve(null)
  ])

  // Track what data sources are available for the citation note
  const citationSources: string[] = []
  if (profile) citationSources.push('employee profile')
  if (payslips.length > 0) citationSources.push(`${payslips.length} payslip${payslips.length > 1 ? 's' : ''}`)
  citationSources.push('conversation history')

  const contextParts: string[] = []
  if (employeeInfo?.designation) contextParts.push(`Designation: ${employeeInfo.designation}`)
  if (employeeInfo?.company) contextParts.push(`Company: ${employeeInfo.company}`)

  // Build the rich system prompt
  const systemPrompt = `You are an AI assistant helping an HR admin draft short, accurate replies to employee inquiries.

RULES:
- Keep replies to 2-3 sentences maximum — be direct and specific
- Use the actual payslip numbers and profile data below when relevant — do NOT say "check your portal" if the answer is already in the data
- If the data does not cover the question, use the FAQ below
- Never invent numbers, dates, or policies not present in the data or FAQ
- End with one short offer to help further

${HR_FAQ}

${formatProfile(profile, employeeName)}

PAYSLIP DATA:
${formatPayslips(payslips)}

After your reply, write on a new line:
CONFIDENCE: [low|medium|high]
REASON: [one sentence]`

  const openAIMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ]

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      max_tokens: 1000,
      messages: openAIMessages
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const rawText: string = data.choices?.[0]?.message?.content ?? ''

  // Parse confidence
  const confidenceMatch = rawText.match(/CONFIDENCE:\s*(low|medium|high)/i)
  const reasonMatch = rawText.match(/REASON:\s*(.+)/i)

  const confidenceStr = (confidenceMatch?.[1]?.toLowerCase() ?? 'medium') as 'low' | 'medium' | 'high'
  const confidenceScore = confidenceStr === 'high' ? 88 : confidenceStr === 'medium' ? 65 : 38
  const reasonText = reasonMatch?.[1]?.trim() ?? 'Based on available employee data'

  // Strip metadata from draft
  const draft = rawText
    .replace(/\nCONFIDENCE:.*$/im, '')
    .replace(/\nREASON:.*$/im, '')
    .trim()

  // Build citation note
  const msgCount = messages.filter(m => m.role === 'user').length
  const citationNote = `Based on ${citationSources.join(', ')} · ${msgCount} message${msgCount !== 1 ? 's' : ''} from ${employeeName}${contextParts.length > 0 ? ` · ${contextParts.join(' · ')}` : ''}. ${reasonText}`

  return { draft, confidence: confidenceStr, confidenceScore, citationNote }
}

// ── Audit logger ──────────────────────────────────────────────────────────────
export async function logAIAudit(params: {
  employee_id: number
  prompt_summary: string
  ai_draft: string
  action: 'accepted' | 'edited' | 'rejected'
  final_message?: string
  confidence: string
  confidence_score: number
  admin_user_id?: number
}) {
  try {
    await supabase.from('xin_ai_audit').insert({
      employee_id: params.employee_id,
      prompt_summary: params.prompt_summary,
      ai_draft: params.ai_draft,
      action: params.action,
      final_message: params.final_message ?? null,
      confidence: params.confidence,
      confidence_score: params.confidence_score,
      admin_user_id: params.admin_user_id ?? null,
      created_at: new Date().toISOString()
    })
  } catch (err) {
    console.error('Failed to log AI audit:', err)
  }
}
