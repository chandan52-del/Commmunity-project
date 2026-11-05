import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { LandingPage } from '../pages/public/LandingPage'

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  )
}
