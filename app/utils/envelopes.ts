// Saving envelopes: icon suggested from the name (before the user picks one, French or English
// keywords), color fixed by the category IRI (stable whatever the sort order).

const SUGGESTIONS: [RegExp, string][] = [
  [/assurance|mutuelle|insurance/, 'shield'],
  [/voiture|auto|moto|vélo|velo|car\b|bike/, 'car'],
  [/vacance|voyage|séjour|sejour|philippines|vol\b|holiday|vacation|trip|travel|flight/, 'plane'],
  [/urgence|précaution|precaution|imprévu|imprevu|emergency|rainy/, 'life-buoy'],
  [/cadeau|noël|noel|anniversaire|gift|christmas|birthday/, 'gift'],
  [/maison|appart|logement|travaux|apport|house|home|flat|deposit/, 'house'],
  [/meuble|déco|deco|canapé|canape|furniture|sofa/, 'sofa'],
  [/santé|sante|médical|medical|dentiste|health|dentist/, 'heart-pulse'],
  [/étude|etude|école|ecole|formation|study|school|college|education/, 'graduation-cap'],
  [/mariage|bague|wedding|ring\b/, 'gem'],
  [/bébé|bebe|enfant|baby|child|kid/, 'baby'],
]

/** Lucide icon name suggested by an envelope name; piggy-bank by default. */
export function suggestEnvelopeIcon(name: string): string {
  const n = name.toLowerCase()
  return SUGGESTIONS.find(([re]) => re.test(n))?.[1] ?? 'piggy-bank'
}

export interface EnvelopeColor {
  tile: string
  bar: string
  /** Icon alone, without its tile. */
  icon: string
}

const COLORS: EnvelopeColor[] = [
  { tile: 'bg-sky-100 text-sky-700', bar: 'bg-sky-500', icon: 'text-sky-700' },
  { tile: 'bg-teal-100 text-teal-700', bar: 'bg-teal-500', icon: 'text-teal-700' },
  { tile: 'bg-indigo-100 text-indigo-700', bar: 'bg-indigo-500', icon: 'text-indigo-700' },
  { tile: 'bg-rose-100 text-rose-700', bar: 'bg-rose-500', icon: 'text-rose-700' },
  { tile: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', icon: 'text-amber-700' },
  { tile: 'bg-violet-100 text-violet-700', bar: 'bg-violet-500', icon: 'text-violet-700' },
]

export function envelopeColor(iri: string): EnvelopeColor {
  let hash = 0
  for (const c of iri) hash = (hash * 31 + c.charCodeAt(0)) | 0
  return COLORS[Math.abs(hash) % COLORS.length]!
}
