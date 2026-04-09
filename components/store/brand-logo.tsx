"use client"

import { useEffect, useMemo, useState } from "react"

type Props = {
  src?: string | null
  alt: string
  wrapperClassName?: string
  imgClassName?: string
  width?: number
  height?: number
  fallbackSrc?: string
  unoptimized?: boolean
}

type BackgroundProps = {
  src?: string | null
  className?: string
  width?: number
  height?: number
}

export function BrandLogo({
  src,
  alt,
  wrapperClassName,
  imgClassName,
  width = 240,
  height = 80,
  fallbackSrc = "/brand/placeholder.svg",
}: Props) {
  const placeholderSvg = useMemo(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="#f1f1f1"/>
  <rect x="8" y="8" width="${Math.max(0, width - 16)}" height="${Math.max(0, height - 16)}" rx="10" fill="#ffffff" opacity="0.55"/>
  <path d="M${Math.round(width * 0.25)} ${Math.round(height * 0.7)}c0-${Math.round(height * 0.2)} ${Math.round(width * 0.15)}-${Math.round(height * 0.35)} ${Math.round(width * 0.35)}-${Math.round(height * 0.35)}h${Math.round(width * 0.3)}c${Math.round(width * 0.2)} 0 ${Math.round(width * 0.35)} ${Math.round(height * 0.15)} ${Math.round(width * 0.35)} ${Math.round(height * 0.35)}" fill="none" stroke="#c7c7c7" stroke-width="${Math.max(2, Math.round(height * 0.06))}" stroke-linecap="round"/>
  <text x="${Math.round(width / 2)}" y="${Math.round(height * 0.88)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.max(10, Math.round(height * 0.18))}" fill="#8a8a8a">BRAND</text>
</svg>`
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }, [width, height])

  function normalizeSrc(value: string) {
    const trimmed = String(value || "").trim()
    if (!trimmed) return ""
    if (trimmed.startsWith("//")) return `https:${trimmed}`
    if (trimmed.startsWith("http://")) return `https://${trimmed.slice("http://".length)}`
    return trimmed
  }

  const initialSrc = useMemo(() => {
    const candidate = normalizeSrc(String(src || ""))
    if (candidate) return candidate
    // Keep supporting existing fallback file if caller passes it explicitly.
    return fallbackSrc ? normalizeSrc(String(fallbackSrc)) : ""
  }, [src, fallbackSrc])

  const [currentSrc, setCurrentSrc] = useState(initialSrc)

  useEffect(() => {
    setCurrentSrc(initialSrc)
  }, [initialSrc])

  useEffect(() => {
    void src
  }, [src])

  return (
    <span
      className={`relative inline-block overflow-hidden ${wrapperClassName || ""}`}
      style={{
        width,
        height,
        backgroundImage: `url("${placeholderSvg}")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "contain",
      }}
    >
      {currentSrc ? (
        <img
          src={currentSrc}
          alt={alt}
          width={width}
          height={height}
          className={`absolute inset-0 h-full w-full object-contain ${imgClassName || ""}`}
          loading="lazy"
          decoding="async"
          onError={() => {
            // Hide the broken image and leave the placeholder background.
            setCurrentSrc("")
          }}
        />
      ) : null}
    </span>
  )
}

export function BrandLogoBackground({
  src,
  className,
  width = 240,
  height = 80,
}: BackgroundProps) {
  const placeholderSvg = useMemo(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" rx="16" fill="#f1f1f1"/>
  <rect x="10" y="10" width="${Math.max(0, width - 20)}" height="${Math.max(0, height - 20)}" rx="14" fill="#ffffff" opacity="0.55"/>
  <path d="M${Math.round(width * 0.22)} ${Math.round(height * 0.68)}c0-${Math.round(height * 0.22)} ${Math.round(width * 0.15)}-${Math.round(height * 0.36)} ${Math.round(width * 0.36)}-${Math.round(height * 0.36)}h${Math.round(width * 0.32)}c${Math.round(width * 0.22)} 0 ${Math.round(width * 0.36)} ${Math.round(height * 0.14)} ${Math.round(width * 0.36)} ${Math.round(height * 0.36)}" fill="none" stroke="#c7c7c7" stroke-width="${Math.max(2, Math.round(height * 0.06))}" stroke-linecap="round"/>
</svg>`
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }, [width, height])

  function normalizeSrc(value: string) {
    const trimmed = String(value || "").trim()
    if (!trimmed) return ""
    if (trimmed.startsWith("//")) return `https:${trimmed}`
    if (trimmed.startsWith("http://")) return `https://${trimmed.slice("http://".length)}`
    return trimmed
  }

  const normalized = useMemo(() => normalizeSrc(String(src || "")), [src])
  const [bgSrc, setBgSrc] = useState<string>(placeholderSvg)

  useEffect(() => {
    void src
  }, [src])

  useEffect(() => {
    setBgSrc(placeholderSvg)
  }, [placeholderSvg])

  return (
    <span
      className={`relative ${className || ""}`}
      style={{
        width,
        height,
        backgroundImage: `url("${bgSrc}")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "contain",
      }}
      aria-hidden="true"
    >
      {normalized ? (
        <img
          src={normalized}
          alt=""
          width={1}
          height={1}
          className="absolute h-px w-px opacity-0 pointer-events-none"
          onLoad={() => setBgSrc(normalized)}
          onError={() => setBgSrc(placeholderSvg)}
        />
      ) : null}
    </span>
  )
}
