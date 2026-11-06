import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { LandingPage } from '../pages/public/LandingPage'
import { HallDetailsPage } from '../pages/public/HallDetailsPage'
import { AuthPage } from '../pages/auth/AuthPage'

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/get-started" element={<AuthPage mode="signup" />} />
        <Route path="/halls/:id" element={<HallDetailsPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  )
}
