"use client"

import { HeroSliderPerfect } from "@/components/store/hero-slider"
import { BrandMarquee } from "@/components/store/brand-marquee"
import {
  DepartmentsGrid,
  FeaturedProducts,
  TrustSection,
  TestimonialsSection,
  NewsletterSection,
} from "@/components/store/home-sections"
import { StoreNavbar } from "@/components/store/store-navbar"
import { Footer } from "@/components/store/footer"

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <StoreNavbar />
      <main className="flex-1">
        <HeroSliderPerfect />
        <BrandMarquee />
        <DepartmentsGrid />
        <FeaturedProducts />
        <TrustSection />
        <TestimonialsSection />
        <NewsletterSection />
      </main>
      <Footer />
    </div>
  )
}
