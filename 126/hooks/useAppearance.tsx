import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type AppearanceTheme =
  | 'classic'
  | 'rose'
  | 'midnight'
  | 'sweet-blue'
  | 'scruffy-blue'
  | 'steel-noir'
  | 'blue-steel'
export type AppearanceUi = 'classic' | 'compact' | 'focus' | 'comfort'
export type AppearanceColorScheme = 'light' | 'dark'
export type AppearanceThemeColor = `#${string}`

type AppearanceContextValue = {
  selectedTheme: AppearanceTheme
  selectedUi: AppearanceUi
  setSelectedTheme: (theme: AppearanceTheme) => void
  setSelectedUi: (ui: AppearanceUi) => void
}

const AppearanceContext = createContext<AppearanceContextValue | undefined>(undefined)

export const appearanceThemes: AppearanceTheme[] = [
  'classic',
  'rose',
  'midnight',
  'sweet-blue',
  'scruffy-blue',
  'steel-noir',
  'blue-steel'
]
export const appearanceUis: AppearanceUi[] = ['classic', 'compact', 'focus', 'comfort']
export const appearanceThemeDefinitions: Record<
  AppearanceTheme,
  { colorScheme: AppearanceColorScheme; themeColor: AppearanceThemeColor }
> = {
  classic: { colorScheme: 'light', themeColor: '#00193e' },
  rose: { colorScheme: 'light', themeColor: '#e93d82' },
  midnight: { colorScheme: 'dark', themeColor: '#3e63dd' },
  'sweet-blue': { colorScheme: 'light', themeColor: '#7ce2fe' },
  'scruffy-blue': { colorScheme: 'dark', themeColor: '#fd24cd' },
  'steel-noir': { colorScheme: 'dark', themeColor: '#515862' },
  'blue-steel': { colorScheme: 'dark', themeColor: '#3f6fca' }
}

const THEME_STORAGE_KEY = 'spark.appearance.theme'
const UI_STORAGE_KEY = 'spark.appearance.ui'

/** Builds the non-default theme/UI class names that should be applied to the app shell. */
export const getAppearanceClassNames = (theme: AppearanceTheme, ui: AppearanceUi) =>
  [
    theme !== 'classic' ? `theme-${theme}` : null,
    ui !== 'classic' ? `ui-${ui}` : null
  ].filter((value): value is string => Boolean(value))

/** Returns the light/dark color scheme associated with the selected appearance theme. */
export const getAppearanceColorScheme = (theme: AppearanceTheme): AppearanceColorScheme =>
  appearanceThemeDefinitions[theme].colorScheme

/** Returns the browser/status-bar color associated with the selected appearance theme. */
export const getAppearanceThemeColor = (theme: AppearanceTheme): AppearanceThemeColor =>
  appearanceThemeDefinitions[theme].themeColor

/** Keeps all appearance targets in sync so portalled UI inherits the active theme and UI mode. */
export const syncAppearanceTargets = (
  targets: Iterable<HTMLElement>,
  theme: AppearanceTheme,
  ui: AppearanceUi
) => {
  const appearanceClasses = getAppearanceClassNames(theme, ui)
  const colorScheme = getAppearanceColorScheme(theme)

  for (const target of targets) {
    const classesToRemove = Array.from(target.classList).filter(
      (className) => className.startsWith('theme-') || className.startsWith('ui-')
    )

    classesToRemove.forEach((className) => target.classList.remove(className))
    appearanceClasses.forEach((className) => target.classList.add(className))
    target.classList.toggle('dark', colorScheme === 'dark')
    target.classList.toggle('dark-theme', colorScheme === 'dark')
    target.dataset.appearance = colorScheme
    target.style.colorScheme = colorScheme
  }
}

/** Keeps the browser theme-color meta tag aligned with the active appearance theme. */
export const syncAppearanceThemeColorMeta = (
  theme: AppearanceTheme,
  doc?: Document
) => {
  if (typeof document === 'undefined' && !doc) {
    return
  }

  const targetDocument = doc ?? document
  const targetHead = targetDocument.head

  if (!targetHead) {
    return
  }

  let themeColorMeta = targetDocument.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

  if (!themeColorMeta) {
    themeColorMeta = targetDocument.createElement('meta')
    themeColorMeta.setAttribute('name', 'theme-color')
    targetHead.appendChild(themeColorMeta)
  }

  themeColorMeta.setAttribute('content', getAppearanceThemeColor(theme))
}

const readStoredValue = <T extends string>(key: string, allowedValues: T[], fallback: T): T => {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const storedValue = window.localStorage.getItem(key) as T | null
    if (storedValue && allowedValues.includes(storedValue)) {
      return storedValue
    }
  } catch {
    return fallback
  }

  return fallback
}

const persistStoredValue = (key: string, value: string) => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (value === 'classic') {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, value)
    }
  } catch {
    return
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [selectedTheme, setSelectedThemeState] = useState<AppearanceTheme>(() =>
    readStoredValue(THEME_STORAGE_KEY, appearanceThemes, 'classic')
  )
  const [selectedUi, setSelectedUiState] = useState<AppearanceUi>(() =>
    readStoredValue(UI_STORAGE_KEY, appearanceUis, 'classic')
  )

  const setSelectedTheme = useCallback((theme: AppearanceTheme) => {
    setSelectedThemeState(theme)
    persistStoredValue(THEME_STORAGE_KEY, theme)
  }, [])

  const setSelectedUi = useCallback((ui: AppearanceUi) => {
    setSelectedUiState(ui)
    persistStoredValue(UI_STORAGE_KEY, ui)
  }, [])

  const value = useMemo(
    () => ({
      selectedTheme,
      selectedUi,
      setSelectedTheme,
      setSelectedUi
    }),
    [selectedTheme, selectedUi, setSelectedTheme, setSelectedUi]
  )

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance() {
  const context = useContext(AppearanceContext)

  if (!context) {
    throw new Error('useAppearance must be used within an AppearanceProvider')
  }

  return context
}
