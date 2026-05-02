// Shared types used across pages and utilities

export interface Message {
  message_id: number
  employee_id?: number
  message: string
  sender_type: 'employee' | 'admin' | 'system'
  created_at: string
  is_read: boolean
  attachment_url?: string
  attachment_name?: string
  attachment_type?: string
  admin_user_id?: number
  admin_name?: string
  is_ai_assisted?: boolean
  ai_original_content?: string
}
