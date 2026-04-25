type ServiceWorkerRegistrationOptions = {
  hasServiceWorkerSupport: boolean
  webdriver?: boolean
}

export function shouldRegisterServiceWorker({
  hasServiceWorkerSupport,
  webdriver = false,
}: ServiceWorkerRegistrationOptions) {
  return hasServiceWorkerSupport && !webdriver
}
