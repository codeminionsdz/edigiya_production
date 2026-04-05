"use client"

import { HeroSliderPro } from "@/components/store/hero-slider"
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
      <HeroSliderPro />
      <BrandMarquee />
      <DepartmentsGrid />
      <FeaturedProducts />
      <TrustSection />
      <TestimonialsSection />
      <NewsletterSection />
    </>
  )
}
