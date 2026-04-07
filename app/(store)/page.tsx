"use client"

import { VisitorTracker } from "@/components/store/visitor-tracker"
import { HomeHeroText } from "@/components/store/home-hero-text"
import { BrandMarquee } from "@/components/store/brand-marquee"
import {
  DepartmentsGrid,
  FeaturedProducts,
  TrustSection,
  TestimonialsSection,
  NewsletterSection,
} from "@/components/store/home-sections"

export default function HomePage() {
  return (
    <>
      <VisitorTracker />
      <HomeHeroText />
      <BrandMarquee />
      <DepartmentsGrid />
      <FeaturedProducts />
      <TrustSection />
      <TestimonialsSection />
      <NewsletterSection />
    </>
  )
}
