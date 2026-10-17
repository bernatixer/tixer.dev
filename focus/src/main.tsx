// boffin: finance and weight always open a fresh document before board analytics can load.
const privatePage = /^\/(?:(finance|money)|weight)(?:\/|\.|$)/i.exec(window.location.pathname)
if (privatePage) {
  // An older PWA may serve index.html for this URL; retire it before navigation.
  void (navigator.serviceWorker?.getRegistrations() ?? Promise.resolve([])).then(async registrations => {
    await Promise.all(registrations.map(registration => registration.unregister()))
    window.location.replace(privatePage[1] ? '/finance.html' : '/weight.html')
  })
} else {
  void import('./board')
}
