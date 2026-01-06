// ============================================
// SIGN IN PAGE
// ============================================

import { FC } from 'react'
import { SignIn } from '@clerk/clerk-react'

export const SignInPage: FC = () => {
  return (
    <div className="signin-container">
      <div className="signin-background" />
      
      <div className="signin-content">
        <div className="signin-header">
          <div className="signin-logo">
            <span className="logo-square" />
            <span className="logo-text">Tixer</span>
          </div>
          <p className="signin-tagline">Focus on what matters</p>
        </div>

        <div className="signin-card">
          <SignIn 
            fallbackRedirectUrl="/todo"
            signUpFallbackRedirectUrl="/todo"
            appearance={{
              elements: {
                rootBox: 'clerk-root',
                card: 'clerk-card',
                headerTitle: 'clerk-title',
                headerSubtitle: 'clerk-subtitle',
                formButtonPrimary: 'clerk-button',
                formFieldInput: 'clerk-input',
                footerActionLink: 'clerk-link',
                dividerLine: 'clerk-divider',
                dividerText: 'clerk-divider-text',
                socialButtonsBlockButton: 'clerk-social-button',
                formFieldLabel: 'clerk-label',
                identityPreviewEditButton: 'clerk-edit-button',
              },
              variables: {
                colorPrimary: '#bfff00',
                colorBackground: '#0a0a0a',
                colorText: '#f5f5f0',
                colorTextSecondary: 'rgba(245, 245, 240, 0.6)',
                colorInputBackground: 'rgba(255, 255, 255, 0.05)',
                colorInputText: '#f5f5f0',
                colorNeutral: '#f5f5f0',
                borderRadius: '2px',
                fontFamily: '"JetBrains Mono", monospace',
              },
            }}
          />
        </div>

        <div className="signin-decoration">
          <div className="decoration-line" />
          <div className="decoration-dots">
            {[...Array(5)].map((_, i) => (
              <span key={`dot-${i}`} className="decoration-dot" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

