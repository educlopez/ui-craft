import Nav from './components/Nav.jsx'
import Hero from './components/Hero.jsx'
import Work from './components/Work.jsx'
import About from './components/About.jsx'
import Footer from './components/Footer.jsx'

export default function App() {
  return (
    <div className="mx-auto max-w-[1160px] px-6 md:px-10">
      <Nav />
      <main id="main">
        <Hero />
        <Work />
        <About />
      </main>
      <Footer />
    </div>
  )
}
