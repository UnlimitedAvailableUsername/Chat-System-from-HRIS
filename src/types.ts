export interface User {
  user_id: number
  name: string
  email: string
  role: 'admin' | 'employee'
}

export interface Message {
  message_id: number
  employee_id: number
  message: string
  sender_type: 'employee' | 'admin' | 'system'
  admin_user_id: number | null
  is_read: boolean
  created_at: string
}
