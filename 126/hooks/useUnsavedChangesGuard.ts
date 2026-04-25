import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

interface UnsavedChangesGuardOptions {
  hasUnsavedChanges: boolean
  message?: string
}

const DEFAULT_MESSAGE = 'You have unsaved changes. Are you sure you want to leave this page?'

export function useUnsavedChangesGuard({ hasUnsavedChanges, message = DEFAULT_MESSAGE }: UnsavedChangesGuardOptions) {
  const blocker = useBlocker(hasUnsavedChanges)

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = message
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges, message])

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      return
    }

    const shouldLeave = window.confirm(message)
    if (shouldLeave) {
      blocker.proceed()
      return
    }

    blocker.reset()
  }, [blocker, message])
}
