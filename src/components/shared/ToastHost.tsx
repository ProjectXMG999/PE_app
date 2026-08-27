import { useCallback, useEffect, useState } from 'react'
import { Toast, ToastData } from './Toast'
import { setToastListener } from '../../services/toast'

/** Mounted once in App so milestone notices work on any screen. */
export function ToastHost() {
  const [toast, setToast] = useState<ToastData | null>(null)

  useEffect(() => {
    setToastListener(setToast)
    return () => setToastListener(null)
  }, [])

  const dismiss = useCallback(() => setToast(null), [])

  return <Toast toast={toast} onDismiss={dismiss} />
}
