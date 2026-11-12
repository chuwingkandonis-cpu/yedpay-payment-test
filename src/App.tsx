import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import TravelPage from './pages/TravelPage'
import { CredsProvider } from './lib/creds'
import { PaymentSettingsProvider } from './lib/paymentSettings'

export default function App() {
  return (
    <CredsProvider>
      <PaymentSettingsProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/travel" element={<TravelPage />} />
        </Routes>
      </PaymentSettingsProvider>
    </CredsProvider>
  )
}
