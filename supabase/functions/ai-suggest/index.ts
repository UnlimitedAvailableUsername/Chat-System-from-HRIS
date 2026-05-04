/* 
  Proxies OpenAI calls securely from Supabase + pulls employee/payroll
  context from the DB so the AI answers based on REAL data.

  Deploy:
    supabase functions deploy ai-suggest --no-verify-jwt

  Secrets needed:
    supabase secrets set OPENAI_API_KEY=sk-...

  VS Code — add .vscode/settings.json to stop Deno red marks:
  {
    "deno.enablePaths": ["supabase/functions"],
    "deno.lint": true,
    "deno.unstable": false
  }
*/

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY       = Deno.env.get("OPENAI_API_KEY") ?? "";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_URL       = "https://api.openai.com/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Fetch employee context from DB ──────────────────────────────────────────
async function fetchEmployeeContext(employeeId: number): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn("Supabase env vars missing — skipping DB context");
    return "";
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const contextParts: string[] = [];

  console.log("fetchEmployeeContext — querying for user_id:", employeeId);

  try {
    // ── Employee profile ─────────────────────────────────────────────────
    const { data: emp, error: empErr } = await supabase
      .from("xin_employees")
      .select(
        "user_id, employee_id, first_name, last_name, middle_name, " +
        "email, contact_no, gender, marital_status, date_of_birth, birth_place, " +
        "date_of_joining, date_of_leaving, is_active, " +
        "sss_no, philhealth_no, pagibig_no, tin_no, " +
        "nbi_exp, healthcard_exp, biometric_id, sub_location, " +
        "company_id, designation_id, user_role_id"
      )
      .eq("user_id", employeeId)
      .maybeSingle();

    if (empErr) console.error("Employee query error:", empErr);
    console.log("Employee row:", JSON.stringify(emp));

    if (emp) {
      let companyName = "N/A";
      if (emp.company_id) {
        const { data: co } = await supabase
          .from("xin_companies")
          .select("name")
          .eq("company_id", emp.company_id)
          .maybeSingle();
        companyName = co?.name ?? "N/A";
      }

      let designation = "N/A";
      if (emp.designation_id) {
        const { data: des } = await supabase
          .from("xin_designations")
          .select("designation_name")
          .eq("designation_id", emp.designation_id)
          .maybeSingle();
        designation = des?.designation_name ?? "N/A";
      }

      contextParts.push(
        "EMPLOYEE PROFILE:\n" +
        `- Employee ID: ${emp.employee_id ?? "N/A"}\n` +
        `- Name: ${emp.first_name} ${emp.middle_name ? emp.middle_name + " " : ""}${emp.last_name}\n` +
        `- Company: ${companyName}\n` +
        `- Designation: ${designation}\n` +
        `- Status: ${emp.is_active === 1 ? "Active" : "Inactive"}\n` +
        `- Date Joined: ${emp.date_of_joining ?? "N/A"}\n` +
        `- Date of Birth: ${emp.date_of_birth ?? "N/A"}\n` +
        `- Gender: ${emp.gender ?? "N/A"}\n` +
        `- Civil Status: ${emp.marital_status ?? "N/A"}\n` +
        `- Birth Place: ${emp.birth_place ?? "N/A"}\n` +
        `- Contact: ${emp.contact_no ?? "N/A"}\n` +
        `- Email: ${emp.email ?? "N/A"}\n` +
        `- Sub Location: ${emp.sub_location ?? "N/A"}\n` +
        `- Biometric ID: ${emp.biometric_id ?? "N/A"}\n` +
        `- SSS No: ${emp.sss_no ?? "N/A"}\n` +
        `- PhilHealth No: ${emp.philhealth_no ?? "N/A"}\n` +
        `- Pag-IBIG No: ${emp.pagibig_no ?? "N/A"}\n` +
        `- TIN: ${emp.tin_no ?? "N/A"}\n` +
        `- NBI Expiry: ${emp.nbi_exp ?? "N/A"}\n` +
        `- Healthcard Expiry: ${emp.healthcard_exp ?? "N/A"}`
      );
    }

    // ── Payroll records ──────────────────────────────────────────────────
    const { data: payslips, error: payErr } = await supabase
      .from("xin_payroll_report_temp")
      .select(
        "cutoff_date_start, cutoff_date_end, " +
        "regular_pay, overtime_pay, holiday_pay, gross_pay, " +
        "sss_contribution, philhealth_contribution, pagibig_contribution, " +
        "tax, total_deduction, net_pay"
      )
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(3);

    if (payErr) console.error("Payroll query error:", payErr);
    console.log("Payroll rows:", JSON.stringify(payslips));

    if (payslips && payslips.length > 0) {
      const latest = payslips[0];
      contextParts.push(
        "LATEST PAYSLIP:\n" +
        `- Period: ${latest.cutoff_date_start ?? "N/A"} to ${latest.cutoff_date_end ?? "N/A"}\n` +
        `- Regular Pay: ₱${latest.regular_pay ?? "N/A"}\n` +
        `- Overtime Pay: ₱${latest.overtime_pay ?? "N/A"}\n` +
        `- Holiday Pay: ₱${latest.holiday_pay ?? "N/A"}\n` +
        `- Gross Pay: ₱${latest.gross_pay ?? "N/A"}\n` +
        `- SSS Contribution: ₱${latest.sss_contribution ?? "N/A"}\n` +
        `- PhilHealth Contribution: ₱${latest.philhealth_contribution ?? "N/A"}\n` +
        `- Pag-IBIG Contribution: ₱${latest.pagibig_contribution ?? "N/A"}\n` +
        `- Tax (BIR): ₱${latest.tax ?? "N/A"}\n` +
        `- Total Deductions: ₱${latest.total_deduction ?? "N/A"}\n` +
        `- Net Pay: ₱${latest.net_pay ?? "N/A"}`
      );

      if (payslips.length > 1) {
        const history = payslips
          .map(p =>
            `  • ${p.cutoff_date_start} to ${p.cutoff_date_end}: ` +
            `Gross ₱${p.gross_pay}, Net ₱${p.net_pay}`
          )
          .join("\n");
        contextParts.push(`RECENT PAYROLL HISTORY:\n${history}`);
      }
    }

  } catch (err) {
    // If the DB fetch fails then AI still answers without context 
    console.error("Unexpected error in fetchEmployeeContext:", err);
  }

  if (contextParts.length === 0) {
    console.warn("No DB context found for employeeId:", employeeId);
    return "";
  }

  return (
    "\n\n--- EMPLOYEE DATA FROM DATABASE ---\n" +
    contextParts.join("\n\n") +
    "\n--- END OF DATA ---"
  );
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY secret not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const {
      employeeMessage,
      conversationHistory = [],
      employeeId,
    } = await req.json();

    console.log("Request received — employeeId:", employeeId, "message:", employeeMessage);

    if (!employeeMessage || typeof employeeMessage !== "string") {
      return new Response(
        JSON.stringify({ error: "employeeMessage is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // This pulls real data from DB before calling OpenAI
    const dbContext = employeeId
      ? await fetchEmployeeContext(Number(employeeId))
      : "";

    const systemPrompt =
      "You are an HR support assistant helping admin staff respond to employee " +
      "inquiries about payroll, benefits, schedules, and HR policies.\n\n" +
      "Your suggestions should be warm, professional, and concise.\n\n" +
      "IMPORTANT RULES:\n" +
      "- If employee data is provided below, use it to give specific and accurate answers.\n" +
      "- Currency is Philippine Peso (₱). Format amounts clearly.\n" +
      "- If a field shows N/A, tell the admin to confirm that detail with HR records.\n" +
      "- Never invent numbers, dates, or amounts not present in the provided data.\n" +
      "- Reply with ONLY the message the admin should send — no preamble, no labels." +
      dbContext;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10),
      {
        role: "user",
        content:
          `The employee just sent this message:\n\n"${employeeMessage}"\n\n` +
          `Draft a helpful reply the HR admin can send back.`,
      },
    ];

    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        max_completion_tokens: 2048,
        messages,
      }),
    });

    if (!openaiResponse.ok) {
      const errorBody = await openaiResponse.text();
      console.error("OpenAI API error:", openaiResponse.status, errorBody);
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${openaiResponse.status} ${errorBody}` }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await openaiResponse.json();
    console.log("OpenAI raw response:", JSON.stringify(data));

    const suggestion =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      data?.output?.[0]?.content?.[0]?.text ||
      "";

    if (!suggestion) {
      console.error("Could not extract suggestion. Full response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({
          error: "Empty response from AI — check Edge Function logs",
          debug: data,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ suggestion: suggestion.trim() }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});