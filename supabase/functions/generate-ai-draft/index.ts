// supabase/functions/generate-ai-draft/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function buildConfidence(draft: string) {
  let score = 70

  if (draft.length > 60) score += 5
  if (draft.length > 120) score += 5
  if (draft.toLowerCase().includes("i will")) score += 3
  if (draft.toLowerCase().includes("please")) score += 2
  if (draft.toLowerCase().includes("thank")) score += 2

  if (draft.toLowerCase().includes("not sure")) score -= 15
  if (draft.toLowerCase().includes("i think")) score -= 5
  if (draft.toLowerCase().includes("maybe")) score -= 5

  if (score > 95) score = 95
  if (score < 40) score = 40

  return score
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const OPEN_AI_API_KEY = Deno.env.get("OPEN_AI_API_KEY")
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!OPEN_AI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({
          error: "Missing environment variables",
          debug: {
            OPEN_AI_API_KEY: !!OPEN_AI_API_KEY,
            SUPABASE_URL: !!SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY,
          },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: corsHeaders,
      })
    }

    const { employee_id } = await req.json()

    if (!employee_id) {
      return new Response(JSON.stringify({ error: "employee_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Fetch full employee profile
    const { data: employee, error: empError } = await supabase
      .from("xin_employees")
      .select(`
        user_id, employee_id, first_name, last_name, middle_name,
        email, contact_no, company_id, designation_id, user_role_id,
        gender, marital_status, date_of_birth, date_of_joining, date_of_leaving,
        is_active, sub_location, biometric_id,
        sss_no, philhealth_no, pagibig_no, tin_no,
        nbi_exp, healthcard_exp
      `)
      .eq("user_id", employee_id)
      .maybeSingle()

    if (empError) throw empError
    if (!employee) {
      return new Response(JSON.stringify({ error: "Employee not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // 2. Fetch company, designation, role + last 3 payroll records in parallel
    const [companyRes, designationRes, roleRes, payrollRes] = await Promise.all([
      employee.company_id
        ? supabase.from("xin_companies").select("name").eq("company_id", employee.company_id).maybeSingle()
        : Promise.resolve({ data: null }),
      employee.designation_id
        ? supabase.from("xin_designations").select("designation_name").eq("designation_id", employee.designation_id).maybeSingle()
        : Promise.resolve({ data: null }),
      employee.user_role_id
        ? supabase.from("xin_user_roles").select("role_name").eq("role_id", employee.user_role_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("xin_payroll_report_temp")
        .select(`
          cutoff_date_start, cutoff_date_end,
          regular_pay, overtime_pay, holiday_pay, gross_pay,
          sss_contribution, philhealth_contribution, pagibig_contribution, tax,
          total_deduction, net_pay
        `)
        .eq("employee_id", employee_id)
        .order("cutoff_date_end", { ascending: false })
        .limit(3),
    ])

    const companyName = companyRes.data?.name || "N/A"
    const designationName = designationRes.data?.designation_name || "N/A"
    const roleName = roleRes.data?.role_name || "N/A"
    const payrollRecords = payrollRes.data || []

    // 3. Fetch last 10 messages
    const { data: msgs, error: msgError } = await supabase
      .from("xin_employee_messages")
      .select("message, sender_type, created_at")
      .eq("employee_id", employee_id)
      .order("created_at", { ascending: false })
      .limit(10)

    if (msgError) throw msgError

    const last10 = (msgs || []).reverse()
    const messageCount = last10.length

    const formattedMessages = last10
      .map((m) => {
        const sender = m.sender_type === "employee" ? "EMPLOYEE" : m.sender_type === "admin" ? "ADMIN" : "SYSTEM"
        const time = new Date(m.created_at).toLocaleString("en-US", {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
        })
        return `[${time}] ${sender}: ${m.message}`
      })
      .join("\n")

    // 4. Format payroll records for prompt
    const formattedPayroll = payrollRecords.length > 0
      ? payrollRecords.map((p, i) => `
Payslip ${i + 1} (Cutoff: ${p.cutoff_date_start} to ${p.cutoff_date_end}):
  - Regular Pay:    ₱${p.regular_pay}
  - Overtime Pay:   ₱${p.overtime_pay}
  - Holiday Pay:    ₱${p.holiday_pay}
  - Gross Pay:      ₱${p.gross_pay}
  - SSS:            ₱${p.sss_contribution}
  - PhilHealth:     ₱${p.philhealth_contribution}
  - Pag-IBIG:       ₱${p.pagibig_contribution}
  - Tax:            ₱${p.tax}
  - Total Deduction:₱${p.total_deduction}
  - Net Pay:        ₱${p.net_pay}
`.trim()).join("\n\n")
      : "No payroll records found."

    // 5. Detect topics from conversation for context-aware hints
    const allText = last10.map(m => m.message.toLowerCase()).join(" ")
    const topicHints: string[] = []
    const topicLabels: string[] = []

    if (allText.includes("payslip") || allText.includes("payroll")) {
      topicHints.push("- Employee is asking about payroll/payslip. Use the actual payslip data above to give a specific, accurate answer. Reference the exact cutoff period, gross pay, deductions, or net pay as needed.")
      topicLabels.push("Payroll / Payslip")
    }
    if (allText.includes("payout") || allText.includes("schedule") || allText.includes("release")) {
      topicHints.push("- Employee is asking about payout schedule. Reference the most recent cutoff end date from their payroll records above when giving an answer.")
      topicLabels.push("Payout Schedule")
    }
    if (allText.includes("leave") || allText.includes("vacation") || allText.includes("absent")) {
      topicHints.push("- Employee may be asking about leave or absences. Reference checking their leave balance or filing through the proper channel.")
      topicLabels.push("Leave / Absence")
    }
    if (allText.includes("sss") || allText.includes("philhealth") || allText.includes("pagibig") || allText.includes("tin")) {
      topicHints.push("- Employee is asking about government contributions. Use the actual contribution amounts from their payslip data above.")
      topicLabels.push("Government Contributions")
    }
    if (allText.includes("nbi") || allText.includes("health card") || allText.includes("healthcard")) {
      topicHints.push("- Employee may be asking about NBI clearance or health card. Check the expiry dates on file and advise accordingly.")
      topicLabels.push("NBI / Healthcard")
    }

    // 6. Build full prompt
    const employeeContext = `
Employee Profile:
- Full Name: ${employee.first_name} ${employee.middle_name ? employee.middle_name + " " : ""}${employee.last_name}
- Employee ID: ${employee.employee_id || "N/A"}
- Email: ${employee.email || "N/A"}
- Contact: ${employee.contact_no || "N/A"}
- Company: ${companyName}
- Designation: ${designationName}
- Role: ${roleName}
- Gender: ${employee.gender || "N/A"}
- Civil Status: ${employee.marital_status || "N/A"}
- Sub-Location: ${employee.sub_location || "N/A"}
- Status: ${employee.is_active === 1 ? "Active" : "Inactive"}
- Date Joined: ${employee.date_of_joining || "N/A"}
${employee.date_of_leaving ? `- Date of Leaving: ${employee.date_of_leaving}` : ""}
- SSS No: ${employee.sss_no || "N/A"}
- PhilHealth No: ${employee.philhealth_no || "N/A"}
- Pag-IBIG No: ${employee.pagibig_no || "N/A"}
- TIN: ${employee.tin_no || "N/A"}
- NBI Expiry: ${employee.nbi_exp || "N/A"}
- Healthcard Expiry: ${employee.healthcard_exp || "N/A"}
`.trim()

    const systemPrompt = `
You are an HR support admin assistant. Your job is to write a short, professional, and friendly reply to an employee inquiry.

Rules:
- Keep it short (1-4 sentences).
- Never mention you are an AI.
- Address the employee by their first name.
- Be specific — use actual data from the employee profile and payroll records when relevant. Do NOT give generic answers if the data is available.
- If the employee asks about their payslip, reference the actual figures (net pay, deductions, cutoff period, etc.).
- If the employee asks about payout, reference the actual cutoff end date from their latest payslip.
- Only reference government ID numbers if the employee explicitly asked about them.
- If unsure about something not covered by the data, ask a clarifying question.

Return ONLY the reply message. No subject line, no greeting label, just the message body.
`.trim()

    const userPrompt = `
${employeeContext}

Latest Payroll Records (last 3 cutoffs):
${formattedPayroll}

Conversation history (last ${messageCount} messages):
${formattedMessages}

${topicHints.length > 0 ? `Context hints based on detected topics:\n${topicHints.join("\n")}` : ""}

Write the admin reply now.
`.trim()

    // 7. Call OpenAI
    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPEN_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-nano",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    })

    if (!openAiRes.ok) {
      const errText = await openAiRes.text()
      return new Response(
        JSON.stringify({ step: "openai_failed", status: openAiRes.status, error: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const openAiJson = await openAiRes.json()
    const draft = openAiJson.choices?.[0]?.message?.content?.trim()

    if (!draft) {
      return new Response(JSON.stringify({ error: "No draft generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const confidence = buildConfidence(draft)

    // 8. Return draft + metadata for the UI
    return new Response(
      JSON.stringify({
        draft,
        confidence,
        meta: {
          message_count: messageCount,
          payroll_cutoffs_loaded: payrollRecords.length,
          topics_detected: topicLabels,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (err: any) {
    console.error("Edge Function Error:", err)
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})