type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null

export function initInstallService(
  onPromptAvailable: (e: BeforeInstallPromptEvent) => void,
  onInstalled: () => void
) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    onPromptAvailable(deferredPrompt)
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    onInstalled()
  })
}

export async function triggerInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  await deferredPrompt.prompt()
  const choice = await deferredPrompt.userChoice
  deferredPrompt = null
  return choice.outcome
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isInStandaloneMode(): boolean {
  return ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches
}

export function isMacSafari(): boolean {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent) &&
    !isIOS() &&
    navigator.platform.startsWith('Mac')
}
