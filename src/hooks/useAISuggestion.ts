import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type AuditAction = 'accepted' | 'edited' | 'rejected'

interface Message {
  sender_type: 'employee' | 'admin' | 'system'
  message: string
}

interface UseAISuggestionOptions {
  employeeId: number
  adminUserId?: number
}

interface AISuggestionState {
  suggestion: string | null
  isLoading: boolean
  error: string | null
  auditId: number | null
  promptSent: string | null
}

export function useAISuggestion({ employeeId, adminUserId }: UseAISuggestionOptions) {
  // This keeps track of the AI suggestion response and the audit record state.
  const [state, setState] = useState<AISuggestionState>({
    suggestion: null,
    isLoading: false,
    error: null,
    auditId: null,
    promptSent: null,
  })

  // This fetches an AI-generated suggestion based on the latest employee message.
  const fetchSuggestion = useCallback(
    async (messages: Message[]) => {
      const lastEmployeeMsg = [...messages]
        .reverse()
        .find((m) => m.sender_type === 'employee')

      if (!lastEmployeeMsg) return

      const employeeMessage = lastEmployeeMsg.message

      // This builds a short, non-system conversation history for the AI service.
      const conversationHistory = messages
        .filter((m) => m.sender_type !== 'system')
        .slice(-12)
        .map((m) => ({
          role: m.sender_type === 'employee' ? 'user' : 'assistant',
          content: m.message,
        }))

      // This shows loading and clear the previous AI suggestion state.
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        suggestion: null,
        auditId: null,
        promptSent: employeeMessage,
      }))

      try {
        // This calls the Supabase Edge Function to get the AI suggestion.
        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          'ai-suggest',
          {
            body: {
              employeeMessage,
              conversationHistory,
              employeeId,
            },
          }
        )

        if (fnError) throw new Error(fnError.message)

        // This shows any error the Edge Function returned in the body
        if (fnData?.error) throw new Error(fnData.error)

        if (!fnData?.suggestion) throw new Error('Empty response from AI')

        const suggestion: string = fnData.suggestion

        // This persist the AI response in the audit table for review and tracking.
        const { data: auditRow, error: auditError } = await supabase
          .from('xin_ai_audit')
          .insert({
            employee_id: employeeId,
            admin_user_id: adminUserId ?? null,
            prompt_sent: employeeMessage,
            ai_response: suggestion,
            admin_action: null,
            final_message: null,
          })
          .select('audit_id')
          .single()

        if (auditError) {
          console.error('Failed to write AI audit row:', auditError)
        }

        setState({
          suggestion,
          isLoading: false,
          error: null,
          auditId: auditRow?.audit_id ?? null,
          promptSent: employeeMessage,
        })
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err.message ?? 'Failed to get AI suggestion',
        }))
      }
    },
    [employeeId, adminUserId]
  )

  // This updates the audit record when the admin accepts, edits, or rejects the AI suggestion.
  const recordOutcome = useCallback(
    async (action: AuditAction, finalMessage: string | null) => {
      if (!state.auditId) return

      const { error } = await supabase
        .from('xin_ai_audit')
        .update({
          admin_action: action,
          final_message: finalMessage,
          acted_at: new Date().toISOString(),
        })
        .eq('audit_id', state.auditId)

      if (error) {
        console.error('Failed to update AI audit outcome:', error)
      }

      setState({
        suggestion: null,
        isLoading: false,
        error: null,
        auditId: null,
        promptSent: null,
      })
    },
    [state.auditId]
  )

  const clearSuggestion = useCallback(() => {
    // This removes the current AI suggestion from state without changing the audit record.
    setState({
      suggestion: null,
      isLoading: false,
      error: null,
      auditId: null,
      promptSent: null,
    })
  }, [])

  return {
    suggestion: state.suggestion,
    isLoading: state.isLoading,
    error: state.error,
    fetchSuggestion,
    recordOutcome,
    clearSuggestion,
  }
}