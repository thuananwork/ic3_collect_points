import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Icon được đóng gói sẵn để chạy được khi phòng máy không có internet
import '@fortawesome/fontawesome-free/css/all.min.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
