export function startInactivityLock(lock: () => void, timeoutMs: number) {
  const controller = new AbortController()
  let deadline = performance.now() + timeoutMs
  let wallDeadline = Date.now() + timeoutMs
  let timer = setTimeout(expire, timeoutMs)

  function stop() {
    clearTimeout(timer)
    controller.abort()
  }
  function expire() {
    if (controller.signal.aborted) return
    stop()
    lock()
  }
  function expired() {
    if (controller.signal.aborted) return true
    // boffin: the wall deadline also catches sleep when a browser pauses its monotonic clock.
    if (performance.now() < deadline && Date.now() < wallDeadline) return false
    expire()
    return true
  }
  function activity() {
    if (expired() || document.hidden) return
    deadline = performance.now() + timeoutMs
    wallDeadline = Date.now() + timeoutMs
    clearTimeout(timer)
    timer = setTimeout(expire, timeoutMs)
  }

  const { signal } = controller
  window.addEventListener('pointerdown', activity, { signal, capture: true })
  window.addEventListener('keydown', activity, { signal, capture: true })
  window.addEventListener('focus', expired, { signal })
  document.addEventListener('visibilitychange', expired, { signal })
  return stop
}
