import { Message } from '../types';
import { supabase } from './supabase';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export interface AISuggestion {
  text: string;
  confidence: number;
  citations: string[];
  provider: string;
  model?: string;
}

function buildPrompt(messages: Message[], employeeName: string, employeeContext: string, adminName: string, systemPromptStr: string): string {
  const history = messages
    .slice(-10)
    .map(m => `${m.sender_type === 'admin' ? adminName : employeeName}: ${m.message}`)
    .join('\n');

  return `${systemPromptStr}

EMPLOYEE CONTEXT:
${employeeContext}

CONVERSATION HISTORY:
${history}

RULES:
1. Provide a "text" field for the draft reply.
2. Provide a "confidence" field (0-100) representing how sure you are about this answer.
3. Provide a "citations" list explaining what information you used (e.g., "Based on employee email", "Following up on payroll question").
4. Keep the tone professional but friendly.
5. If signing off the message, strictly use the admin's name (${adminName}). Do NOT use placeholders like [Your name].

Return ONLY a JSON object:
{
  "text": "The draft message here",
  "confidence": 85,
  "citations": ["Citation 1", "Citation 2"]
}`;
}

async function tryOpenAI(prompt: string, model: string): Promise<Omit<AISuggestion, 'provider'> | null> {
  if (!OPENAI_API_KEY) throw new Error("OpenAI API Key is missing");

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Generate a draft reply for the latest message. Return ONLY valid JSON, no markdown.' }
      ]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI error: ${response.status} — ${errorBody}`);
  }

  const data = await response.json();
  let text = data.choices[0].message.content;
  text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(text);
}

export async function generateAISuggestion(
  messages: Message[],
  employeeName: string,
  employeeContext: string,
  adminName: string
): Promise<AISuggestion | null> {
  let provider = 'openai';
  let model = 'gpt-5-mini';
  let systemPromptStr = 'You are an HR support assistant.\nHelp the admin draft a helpful, professional, and concise reply to the employee.';

  try {
    const { data } = await supabase.from('xin_ai_settings').select('*').eq('id', 1).single();
    if (data) {
      provider = data.provider;
      model = data.model;
      systemPromptStr = data.system_prompt;
    }
  } catch (err) {
    console.error('Failed to load AI settings from DB', err);
  }

  const prompt = buildPrompt(messages, employeeName, employeeContext, adminName, systemPromptStr);

  try {
    const result = await tryOpenAI(prompt, model);
    if (result) return { ...result, provider: 'openai', model };
  } catch (err) {
    console.error('OpenAI failed:', err);
  }

  return null;
}
