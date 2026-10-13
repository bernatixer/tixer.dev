// boffin: finance always opens a fresh document before board analytics can load.
if (/^\/(?:finance|money)(?:\/|\.|$)/i.test(window.location.pathname)) {
  // An older PWA may serve index.html for this URL; retire it before navigation.
  void (navigator.serviceWorker?.getRegistrations() ?? Promise.resolve([])).then(async registrations => {
    await Promise.all(registrations.map(registration => registration.unregister()))
    window.location.replace('/finance.html')
  })
} else {
  void import('./board')
}
