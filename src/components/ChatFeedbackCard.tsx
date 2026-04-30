import { useState } from 'react'
import { Star, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface ChatFeedbackCardProps {
  chatType: 'employee' | 'applicant'
  employeeId?: number
  applicationId?: number
  adminUserId: number
  onSubmitted: () => void
  onSkip: () => void
}

const CLOSING_KEYWORDS = [
  'thank you', 'thanks', 'salamat', 'maraming salamat',
  'okay na', 'ok na', 'sige', 'sige po',
  'noted', 'noted po', 'copy', 'copy po',
  'thank you po', 'thanks po',
  'got it', 'gets na', 'okay po',
  'forward na lang', 'send na lang'
]

export function shouldShowFeedbackCard(
  messages: Array<{ sender_type: string; message: string; message_id: number }>,
  userSenderType: 'employee' | 'applicant',
  feedbackSubmittedSinceResolve: boolean,
  dismissedTimestamp: number | null
): boolean {
  if (messages.length === 0) return false
  if (feedbackSubmittedSinceResolve) return false

  if (dismissedTimestamp) {
    const hoursSinceDismiss = (Date.now() - dismissedTimestamp) / (1000 * 60 * 60)
    if (hoursSinceDismiss < 24) return false
  }

  const lastMessage = messages[messages.length - 1]
  if (lastMessage.sender_type === 'system') return true
  if (messages.length < 3) return false
  const hasAdminReply = messages.some(m => m.sender_type === 'admin')
  if (!hasAdminReply) return false
  if (lastMessage.sender_type !== userSenderType) return false

  const msgLower = lastMessage.message.toLowerCase()
  const hasClosingKeyword = CLOSING_KEYWORDS.some(keyword => msgLower.includes(keyword))
  if (hasClosingKeyword) return true

  const lastAdminIdx = messages.findLastIndex(m => m.sender_type === 'admin')
  const hasResolvedAfterAdmin = messages.slice(lastAdminIdx + 1).some(m => m.sender_type === 'system')
  if (hasResolvedAfterAdmin) return true

  return false
}

export function getLastRespondingAdmin(
  messages: Array<{ sender_type: string; admin_user_id?: number }>
): number | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender_type === 'admin' && messages[i].admin_user_id) {
      return messages[i].admin_user_id!
    }
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender_type === 'system' && messages[i].admin_user_id) {
      return messages[i].admin_user_id!
    }
  }
  return null
}

export async function hasFeedbackSinceLastResolve(
  chatType: 'employee' | 'applicant',
  referenceId: number,
  messages: Array<{ sender_type: string; created_at: string }>
): Promise<boolean> {
  const lastResolved = [...messages].reverse().find(m => m.sender_type === 'system')
  const sinceDate = lastResolved?.created_at || '1970-01-01'

  const query = supabase
    .from('xin_chat_feedback')
    .select('feedback_id')
    .eq('chat_type', chatType)
    .gte('created_at', sinceDate)
    .limit(1)

  if (chatType === 'employee') {
    query.eq('employee_id', referenceId)
  } else {
    query.eq('application_id', referenceId)
  }

  const { data } = await query
  return (data && data.length > 0) || false
}

export function ChatFeedbackCard({
  chatType,
  employeeId,
  applicationId,
  adminUserId,
  onSubmitted,
  onSkip
}: ChatFeedbackCardProps) {
  const [rating, setRating] = useState(0)
  const [hoveredStar, setHoveredStar] = useState(0)
  const [comment, setComment] = useState('')
  const [resolved, setResolved] = useState<'n/a' | 'yes' | 'no'>('n/a')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (rating === 0 || submitting) return

    try {
      setSubmitting(true)

      const feedbackData: any = {
        chat_type: chatType,
        admin_user_id: adminUserId,
        rating,
        comment: comment.trim() || null,
        resolved
      }

      if (chatType === 'employee') {
        feedbackData.employee_id = employeeId
      } else {
        feedbackData.application_id = applicationId
      }

      const { error } = await supabase
        .from('xin_chat_feedback')
        .insert(feedbackData)

      if (error) throw error

      setSubmitted(true)
      onSubmitted()
    } catch (error) {
      console.error('Error submitting feedback:', error)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-3 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm text-green-700 font-medium">Thank you for your feedback!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center my-4">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 w-full max-w-sm">
        <h3 className="text-sm font-semibold text-gray-800 text-center mb-3">
          How was your experience?
        </h3>

        <div className="flex justify-center gap-1 mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`w-8 h-8 ${
                  star <= (hoveredStar || rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-gray-200 text-gray-200'
                } transition-colors`}
              />
            </button>
          ))}
        </div>

        {rating > 0 && rating <= 3 && (
          <div className="mb-3">
            <label className="block text-xs text-gray-600 mb-1">
              What could we improve? <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us more..."
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />
          </div>
        )}

        <div className="mb-4">
          <p className="text-xs text-gray-600 mb-2 text-center">Was your concern resolved?</p>
          <div className="flex justify-center gap-2">
            {(['n/a', 'yes', 'no'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setResolved(option)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  resolved === option
                    ? option === 'yes'
                      ? 'bg-green-600 text-white shadow-sm scale-105'
                      : option === 'no'
                      ? 'bg-red-500 text-white shadow-sm scale-105'
                      : 'bg-gray-600 text-white shadow-sm scale-105'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                {option === 'n/a' ? 'N/A' : option === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="px-6 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
