import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { LandingPage } from '../pages/public/LandingPage'
import { HallDetailsPage } from '../pages/public/HallDetailsPage'
import { AuthPage } from '../pages/auth/AuthPage'
import { RequireAuth } from '../components/RequireAuth'
import { MyBookingsPage } from '../pages/customer/MyBookingsPage'
import { BookingDetailsPage } from '../pages/customer/BookingDetailsPage'
import { RequireAdmin } from '../components/RequireAdmin'
import { AdminLayout } from '../components/AdminLayout'
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage'
import { AdminHallsPage } from '../pages/admin/AdminHallsPage'
import { AdminBookingsPage } from '../pages/admin/AdminBookingsPage'
import { AdminMaintenancePage } from '../pages/admin/AdminMaintenancePage'
import { AdminReportsPage } from '../pages/admin/AdminReportsPage'

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
        <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="halls" element={<AdminHallsPage />} />
          <Route path="bookings" element={<AdminBookingsPage />} />
          <Route path="maintenance" element={<AdminMaintenancePage />} />
          <Route path="reports" element={<AdminReportsPage />} />
        </Route>
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  )
}
