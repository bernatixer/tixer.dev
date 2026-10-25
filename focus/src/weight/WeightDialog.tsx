import { useLayoutEffect, useRef, type ReactNode } from 'react'

export function WeightDialog({ title, closeLabel, dirty = false, busy = false, onClose, children }: {
  title: string; closeLabel: string; dirty?: boolean; busy?: boolean; onClose: () => void; children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const element = dialog.current!
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element.showModal()
    return () => { element.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  const leave = () => {
    if (!busy && (!dirty || window.confirm('Discard your unfinished changes?'))) onClose()
  }
  return <dialog ref={dialog} className="finance-drawer weight-day" aria-labelledby="weight-dialog-title" onCancel={event => { event.preventDefault(); leave() }}>
    <div className="finance-drawer__heading"><h2 id="weight-dialog-title">{title}</h2><button type="button" aria-label={closeLabel} disabled={busy} onClick={leave}>×</button></div>
    {children}
  </dialog>
}
