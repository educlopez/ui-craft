import './styles.css'
import Hero from './components/Hero'
import Features from './components/Features'
import Pricing from './components/Pricing'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="app">
      <Hero />
      <Features />
      <Pricing />
      <Footer />
    </div>
  )
}
