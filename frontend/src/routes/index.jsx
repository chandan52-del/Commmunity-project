import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { LandingPage } from '../pages/public/LandingPage'
import { HallDetailsPage } from '../pages/public/HallDetailsPage'
import { AuthPage } from '../pages/auth/AuthPage'
import { RequireAuth } from '../components/RequireAuth'
import { MyBookingsPage } from '../pages/customer/MyBookingsPage'
import { BookingDetailsPage } from '../pages/customer/BookingDetailsPage'

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/get-started" element={<AuthPage mode="signup" />} />
        <Route path="/halls/:id" element={<HallDetailsPage />} />
        <Route path="/bookings" element={<RequireAuth><MyBookingsPage /></RequireAuth>} />
        <Route path="/bookings/:id" element={<RequireAuth><BookingDetailsPage /></RequireAuth>} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  )
}
