"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type { Product } from "./data"

interface CartItem {
  product: Product
  quantity: number
  variantId?: string
  unitPrice?: number
}

interface CartContextType {
  items: CartItem[]
  addItem: (product: Product, quantity?: number, variantId?: string, unitPrice?: number) => void
  removeItem: (productId: string, variantId?: string) => void
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void
  clearCart: () => void
  totalItems: number
  totalPrice: number
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  const addItem = useCallback((product: Product, quantity = 1, variantId?: string, unitPrice?: number) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id && item.variantId === variantId)
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id && item.variantId === variantId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      }
      return [...prev, { product, quantity, variantId, unitPrice }]
    })
  }, [])

  const removeItem = useCallback((productId: string, variantId?: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId || item.variantId !== variantId))
  }, [])

  const updateQuantity = useCallback((productId: string, quantity: number, variantId?: string) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((item) => item.product.id !== productId || item.variantId !== variantId))
      return
    }
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId && item.variantId === variantId ? { ...item, quantity } : item
      )
    )
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0)
  const totalPrice = items.reduce(
    (acc, item) => acc + (item.unitPrice ?? item.product.price) * item.quantity,
    0
  )

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error("useCart must be used within CartProvider")
  return context
}
