import { useState } from 'react'
import { Navbar } from '../../components/layout/Navbar'
import { Footer } from '../../components/layout/Footer'
import { Hero } from '../../components/landing/Hero'
import { HallSearch } from '../../components/landing/HallSearch'
import { FeaturedHalls } from '../../components/landing/FeaturedHalls'
import { HowItWorks } from '../../components/landing/HowItWorks'
import { WhyChooseUs } from '../../components/landing/WhyChooseUs'
import { FinalCTA } from '../../components/landing/FinalCTA'
import { useReveal } from '../../hooks/useReveal'

const EMPTY_FILTERS = { location: '', date: '', guests: '' }

export function LandingPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const revealRef = useReveal()

  return (
    <>
      <Navbar />
      <main ref={revealRef}>
        <Hero />
        <HallSearch onSearch={setFilters} />
        <FeaturedHalls filters={filters} />
        <HowItWorks />
        <WhyChooseUs />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
