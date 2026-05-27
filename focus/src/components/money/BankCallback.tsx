// ============================================
// /bank/callback — finalize Enable Banking OAuth
// ============================================
//
// The bank redirects the user back here with `state` and `code` in the
// query string. We call /api/bank/auth/finalize, which talks to Enable
// Banking's POST /sessions and persists the resulting session + accounts.
// On success we route back to /money. On error we show the error and
// offer to retry.

import { FC, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { useAuthSync, useFinalizeBankAuth } from '@/hooks'
import { SignInPage } from '../todo/SignInPage'
import '@/styles/todo.css'
import '@/styles/money.css'

const CallbackInner: FC = () => {
  const { isReady } = useAuthSync()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { mutate: finalize } = useFinalizeBankAuth()
  const ran = useRef(false)
  const [state, setState] = useState<'pending' | 'success' | 'error'>('pending')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const ebError = params.get('error')
  const ebErrorDesc = params.get('error_description')
  const code = params.get('code')
  const oauthState = params.get('state')

  useEffect(() => {
    if (!isReady || ran.current) return

    if (ebError) {
      ran.current = true
      setState('error')
      setErrorMsg(ebErrorDesc ?? ebError)
      return
    }
    if (!code || !oauthState) {
      ran.current = true
      setState('error')
      setErrorMsg('Missing `code` or `state` in callback URL.')
      return
    }

    ran.current = true
    finalize(
      { state: oauthState, code },
      {
        onSuccess: () => {
          setState('success')
          // Short pause so the user sees the success state, then navigate
          setTimeout(() => navigate('/money', { replace: true }), 700)
        },
        onError: (err) => {
          setState('error')
          setErrorMsg((err as Error).message)
        },
      },
    )
  }, [isReady, ebError, ebErrorDesc, code, oauthState, finalize, navigate])

  return (
    <div className="bank-callback">
      <div className="bank-callback__card">
        <span className="bank-callback__label">BANK CONNECTION</span>
        {state === 'pending' && <p className="bank-callback__msg">Finalizing authorization…</p>}
        {state === 'success' && <p className="bank-callback__msg bank-callback__msg--ok">Connected. Taking you back…</p>}
        {state === 'error' && (
          <>
            <p className="bank-callback__msg bank-callback__msg--err">Connection failed</p>
            {errorMsg && <pre className="bank-callback__detail">{errorMsg}</pre>}
            <button
              type="button"
              className="bank-sync__btn bank-sync__btn--primary"
              onClick={() => navigate('/money', { replace: true })}
            >
              Back to Money
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export const BankCallback: FC = () => (
  <>
    <SignedOut>
      <SignInPage />
    </SignedOut>
    <SignedIn>
      <CallbackInner />
    </SignedIn>
  </>
)
