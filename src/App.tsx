import { Routes, Route } from 'react-router'
import Room from './pages/Room'
import Atelier from './pages/Atelier'
import { PortfolioTour } from './PortfolioTour'
import { isEnglish } from './data/language'
import { portfolioDemo } from './data/portfolioDemo'
import './AppShell.css'

export default function App() {
  return (
    <>
        <Routes>
          <Route path="/" element={<Room />} />
          <Route path="/atelier" element={<Atelier />} />
        </Routes>
    {portfolioDemo && isEnglish && <PortfolioTour />}
    </>
  )
}
