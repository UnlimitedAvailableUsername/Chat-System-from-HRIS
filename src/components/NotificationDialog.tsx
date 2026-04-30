import { useEffect } from 'react'
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

interface NotificationDialogProps {
  isOpen: boolean
  onClose: () => void
  type: NotificationType
  title: string
  message: string
  autoClose?: boolean
  autoCloseDelay?: number
}

export function NotificationDialog({
  isOpen,
  onClose,
  type,
  title,
  message,
  autoClose,
  autoCloseDelay = 3000
}: NotificationDialogProps) {
  const shouldAutoClose = autoClose ?? (type === 'success' || type === 'info')

  useEffect(() => {
    if (isOpen && shouldAutoClose) {
      const timer = setTimeout(() => {
        onClose()
      }, autoCloseDelay)
      return () => clearTimeout(timer)
    }
  }, [isOpen, shouldAutoClose, autoCloseDelay, onClose])

  if (!isOpen) return null

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle className="w-6 h-6 text-green-600" />
      case 'error':   return <XCircle className="w-6 h-6 text-red-600" />
      case 'warning': return <AlertCircle className="w-6 h-6 text-yellow-600" />
      case 'info':    return <Info className="w-6 h-6 text-blue-600" />
    }
  }
  const getBorderColor = () => {
    switch (type) {
      case 'success': return 'border-green-500'
      case 'error':   return 'border-red-500'
      case 'warning': return 'border-yellow-500'
      case 'info':    return 'border-blue-500'
    }
  }
  const getBgColor = () => {
    switch (type) {
      case 'success': return 'bg-green-50'
      case 'error':   return 'bg-red-50'
      case 'warning': return 'bg-yellow-50'
      case 'info':    return 'bg-blue-50'
    }
  }
  const getTextColor = () => {
    switch (type) {
      case 'success': return 'text-green-900'
      case 'error':   return 'text-red-900'
      case 'warning': return 'text-yellow-900'
      case 'info':    return 'text-blue-900'
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[9998] animate-fadeIn"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div
          className={`bg-white rounded-lg shadow-2xl max-w-md w-full border-l-4 ${getBorderColor()} animate-slideDown`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`flex items-start justify-between p-4 ${getBgColor()} rounded-t-lg`}>
            <div className="flex items-center gap-3">
              {getIcon()}
              <h3 className={`text-lg font-semibold ${getTextColor()}`}>
                {title}
              </h3>
            </div>
            <button
              onClick={onClose}
              className={`p-1 rounded-full hover:bg-white hover:bg-opacity-50 transition-colors ${getTextColor()}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4">
            <p className="text-gray-700 text-sm whitespace-pre-wrap">{message}</p>
          </div>
          <div className="flex justify-end gap-2 p-4 bg-gray-50 rounded-b-lg">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn   { animation: fadeIn 0.2s ease-out; }
        .animate-slideDown{ animation: slideDown 0.3s ease-out; }
      `}</style>
    </>
  )
}
