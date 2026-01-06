// ============================================
// APP ROUTER
// ============================================

import { FC } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { HomePage } from '@/components/home'
import { TodoApp } from '@/components/todo'

export const AppRouter: FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/todo" element={<TodoApp />} />
        {/* Clerk SSO callback - redirect to todo after auth */}
        <Route path="/sso-callback" element={<Navigate to="/todo" replace />} />
        <Route path="/todo/sso-callback" element={<Navigate to="/todo" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

