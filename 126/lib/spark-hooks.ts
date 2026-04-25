import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react'

/**
 * useKV – in-memory React state hook.
 *
 * After the Supabase migration this hook no longer reads from or writes to
 * localStorage.  It keeps the same [value, setValue] API so existing
 * call-sites continue to compile unchanged while real persistence is
 * handled by the Supabase-backed data hooks in src/hooks/data/.
 */
export const useKV = <T,>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] => {
  const [value, setValueState] = useState<T>(initialValue)
  const initialValueRef = useRef(initialValue)

  useEffect(() => {
    initialValueRef.current = initialValue
  }, [initialValue])

  // Reset to initialValue when the key changes
  useEffect(() => {
    setValueState(initialValueRef.current)
  }, [key])

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (nextValue) => {
      setValueState((previous) => {
        const resolvedValue =
          typeof nextValue === 'function'
            ? (nextValue as (prev: T) => T)(previous)
            : nextValue
        return resolvedValue
      })
    },
    []
  )

  return [value, setValue]
}
