export const APP_TOP_NAV_HEIGHT_VAR = '--app-top-nav-height'
export const APP_CONTENT_HEIGHT_VAR = '--app-content-height'

export const APP_TOP_NAV_HEIGHT = `var(${APP_TOP_NAV_HEIGHT_VAR}, 0px)`
export const APP_CONTENT_HEIGHT = `var(${APP_CONTENT_HEIGHT_VAR}, 100dvh)`
export const APP_CONTENT_CENTER_TOP = `calc(${APP_TOP_NAV_HEIGHT} + (${APP_CONTENT_HEIGHT} / 2))`
export const APP_CONTENT_MAX_MODAL_HEIGHT = `calc(${APP_CONTENT_HEIGHT} - 2rem)`

export const APP_NAV_Z_INDEX = 1000
export const APP_CONTENT_OVERLAY_Z_INDEX = 900

export function setAppViewportVariables(style: CSSStyleDeclaration, topNavHeight: number) {
  const safeTopNavHeight = `${Math.max(0, Math.ceil(topNavHeight))}px`

  style.setProperty(APP_TOP_NAV_HEIGHT_VAR, safeTopNavHeight)
  style.setProperty(APP_CONTENT_HEIGHT_VAR, `calc(100dvh - ${safeTopNavHeight})`)
}
