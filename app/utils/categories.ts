import {
  ArrowDownToLine,
  ArrowLeftRight,
  CircleHelp,
  Heart,
  House,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  TrainFront,
  Utensils,
} from 'lucide-vue-next'
import type { Component } from 'vue'

export interface Category {
  label: string
  icon: Component
  classes: string
}

const CATEGORIES: Record<string, Category> = {
  groceries: { label: 'Courses', icon: ShoppingCart, classes: 'bg-orange-100 text-orange-700' },
  restaurants: { label: 'Restaurants', icon: Utensils, classes: 'bg-amber-100 text-amber-700' },
  transport: { label: 'Transport', icon: TrainFront, classes: 'bg-sky-100 text-sky-700' },
  income: { label: 'Revenus', icon: ArrowDownToLine, classes: 'bg-emerald-100 text-emerald-700' },
  housing: { label: 'Logement', icon: House, classes: 'bg-violet-100 text-violet-700' },
  subscriptions: { label: 'Abonnements', icon: Repeat, classes: 'bg-pink-100 text-pink-700' },
  health: { label: 'Santé', icon: Heart, classes: 'bg-rose-100 text-rose-700' },
  shopping: { label: 'Shopping', icon: ShoppingBag, classes: 'bg-fuchsia-100 text-fuchsia-700' },
  transfer: { label: 'Virement', icon: ArrowLeftRight, classes: 'bg-slate-100 text-slate-600' },
  other: { label: 'Autre', icon: CircleHelp, classes: 'bg-slate-100 text-slate-600' },
}

export function category(key: string | null | undefined): Category {
  return CATEGORIES[key ?? 'other'] ?? CATEGORIES.other!
}
