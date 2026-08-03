import Nav from "./components/Nav.jsx";
import Hero from "./components/Hero.jsx";
import LogoStrip from "./components/LogoStrip.jsx";
import Features from "./components/Features.jsx";
import Metrics from "./components/Metrics.jsx";
import CallToAction from "./components/CallToAction.jsx";
import Footer from "./components/Footer.jsx";

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Nav />
      <main>
        <Hero />
        <LogoStrip />
        <Features />
        <Metrics />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}
