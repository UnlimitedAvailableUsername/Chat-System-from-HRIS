// Stripped-down stub of the production permissions module.
// The real app has 100+ permission helpers; the demo build has only chat,
// so every helper just returns true. ROLE_IDS is kept because EmployeeLayout
// references it.

export const ROLE_IDS = {
  SUPER_ADMIN: 1,
  EMPLOYEE: 2,
  RECRUITMENT_OFFICER: 6
} as const

const yes = () => true

export const canAccessChatInquiries = yes
export const canReplyAllChats = yes
export const canAccessChatFeedback = yes
export const canAccessCallLogs = yes
