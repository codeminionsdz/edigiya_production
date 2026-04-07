"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, CheckCircle, Truck, Banknote } from "lucide-react"
import { useLocale } from "@/lib/locale-context"

type SlideData = {
  id: number
  titleFr: string
  titleAr: string
  subtitleFr: string
  subtitleAr: string
  badgeFr: string
  badgeAr: string
  imageSrc: string
  primaryCtaFr: string
  primaryCtaAr: string
  secondaryCtaFr: string
  secondaryCtaAr: string
}

const slides: SlideData[] = [
  {
    id: 1,
    titleFr: "Build Muscle. Recover Faster.",
    titleAr: "ابن العضلات. واستعد قوتك بسرعة.",
    subtitleFr: "Premium supplements for strength, recovery, and elite daily performance.",
    subtitleAr: "مكملات بريميوم للقوة، الاستشفاء، وتحسين الأداء اليومي.",
    badgeFr: "Trusted by athletes across Algeria",
    badgeAr: "موثوق من الرياضيين عبر الجزائر",
    imageSrc: "https://images.pexels.com/photos/2261485/pexels-photo-2261485.jpeg?auto=compress&cs=tinysrgb&w=1920",
    primaryCtaFr: "Start Your Transformation",
    primaryCtaAr: "ابدأ تحولك الآن",
    secondaryCtaFr: "View Best Sellers",
    secondaryCtaAr: "شاهد الأفضل مبيعًا",
  },
  {
    id: 2,
    titleFr: "Fuel Your Performance",
    titleAr: "غذّ أداءك الرياضي",
    subtitleFr: "Whey, creatine, and pre-workout stacks built for serious results.",
    subtitleAr: "واي، كرياتين، وبري ووركاوت بنتائج حقيقية للمتدربين الجادين.",
    badgeFr: "100% original products",
    badgeAr: "منتجات أصلية 100%",
    imageSrc: "https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg?auto=compress&cs=tinysrgb&w=1920",
    primaryCtaFr: "Shop Protein",
    primaryCtaAr: "تسوّق البروتين",
    secondaryCtaFr: "Explore Products",
    secondaryCtaAr: "استكشف المنتجات",
  },
  {
    id: 3,
    titleFr: "Transform Your Body Starting Today",
    titleAr: "ابدأ تحول جسمك من اليوم",
    subtitleFr: "High-performance nutrition with fast delivery to all 58 wilayas.",
    subtitleAr: "تغذية رياضية عالية الأداء مع توصيل سريع إلى 58 ولاية.",
    badgeFr: "Fast delivery nationwide",
    badgeAr: "توصيل سريع عبر كل الولايات",
    imageSrc: "https://images.pexels.com/photos/4397840/pexels-photo-4397840.jpeg?auto=compress&cs=tinysrgb&w=1920",
    primaryCtaFr: "Start Your Transformation",
    primaryCtaAr: "ابدأ تحولك الآن",
    secondaryCtaFr: "View Best Sellers",
    secondaryCtaAr: "شاهد الأفضل مبيعًا",
  },
]

export function HeroSliderPro() {
  const { locale } = useLocale()
  const [current, setCurrent] = useState(0)

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length)
  }, [])

  useEffect(() => {
    const timer = setInterval(next, 6000)
    return () => clearInterval(timer)
  }, [next])

  const slide = slides[current]
  const isArabic = locale === "ar"

  return (
    <section className="relative h-screen w-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          <div className="absolute inset-0">
            <motion.img
              src={slide.imageSrc}
              alt=""
              className="h-full w-full object-cover"
              initial={{ scale: 1.07 }}
              animate={{ scale: 1 }}
              transition={{ duration: 6, ease: "easeOut" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/76 via-black/64 to-black/82" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.06),rgba(0,0,0,0.45)_60%,rgba(0,0,0,0.72))]" />
          </div>

          <div className="relative mx-auto flex h-full w-full max-w-7xl items-center px-6 md:px-10">
            <div className="w-full max-w-4xl text-center lg:max-w-3xl lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-4 py-2 text-xs font-semibold text-white/95 md:text-sm"
              >
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>{isArabic ? slide.badgeAr : slide.badgeFr}</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38 }}
                className="mb-4 text-5xl font-bold leading-[0.95] tracking-tight text-white md:text-7xl xl:text-8xl"
              >
                {isArabic ? slide.titleAr : slide.titleFr}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.48 }}
                className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-white/92 md:text-2xl lg:mx-0"
              >
                {isArabic ? slide.subtitleAr : slide.subtitleFr}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.58 }}
                className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center lg:justify-start"
              >
                <Link href="/shop" className="w-full sm:w-auto">
                  <motion.button
                    className="flex w-full items-center justify-center gap-3 rounded-full bg-primary px-10 py-4 text-base font-semibold text-primary-foreground shadow-xl shadow-black/25 sm:w-auto md:px-12 md:py-5 md:text-lg"
                    whileHover={{ scale: 1.02, backgroundColor: "#E5C100" }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span>{isArabic ? slide.primaryCtaAr : slide.primaryCtaFr}</span>
                    <ArrowRight className={`h-5 w-5 ${isArabic ? "rotate-180" : ""}`} />
                  </motion.button>
                </Link>

                <Link href="/shop?sort=best-sellers" className="w-full sm:w-auto">
                  <motion.button
                    className="w-full rounded-full border border-white/65 bg-transparent px-10 py-4 text-base font-semibold text-white backdrop-blur-sm sm:w-auto md:px-12 md:py-5 md:text-lg"
                    whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.08)" }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isArabic ? slide.secondaryCtaAr : slide.secondaryCtaFr}
                  </motion.button>
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.68 }}
                className="mt-5 flex flex-wrap items-center justify-center gap-2.5 lg:justify-start"
              >
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/22 bg-black/35 px-3 py-1.5 text-xs font-medium text-white/95">
                  <CheckCircle className="h-3.5 w-3.5 text-primary" />
                  {isArabic ? "أصلي 100%" : "100% Original"}
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/22 bg-black/35 px-3 py-1.5 text-xs font-medium text-white/95">
                  <Truck className="h-3.5 w-3.5 text-primary" />
                  {isArabic ? "توصيل 58 ولاية" : "Delivery 58 Wilayas"}
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/22 bg-black/35 px-3 py-1.5 text-xs font-medium text-white/95">
                  <Banknote className="h-3.5 w-3.5 text-primary" />
                  {isArabic ? "الدفع عند الاستلام" : "Cash on Delivery"}
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-8 left-1/2 z-30 flex -translate-x-1/2 justify-center gap-3 md:bottom-10">
        {slides.map((s, i) => (
          <button key={s.id} onClick={() => setCurrent(i)} className="relative group" aria-label={`Slide ${i + 1}`}>
            <motion.div
              className="h-1.5 rounded-full transition-all duration-500 md:h-2"
              style={{
                width: i === current ? "46px" : "12px",
                backgroundColor: i === current ? "hsl(var(--primary))" : "rgba(255,255,255,0.42)",
              }}
              whileHover={{ width: "46px", backgroundColor: "hsl(var(--primary))" }}
            />
          </button>
        ))}
      </div>
    </section>
  )
}

export const HeroSliderPerfect = HeroSliderPro
