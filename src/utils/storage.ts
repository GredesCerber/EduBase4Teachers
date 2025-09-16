import type { SavedMaterial, UserMaterial } from '@/types/material'

const KEY_MY = 'my-materials'
const KEY_SAVED = 'saved-materials'

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function getMyMaterials(): UserMaterial[] {
  if (typeof localStorage === 'undefined') return []
  return safeParse<UserMaterial[]>(localStorage.getItem(KEY_MY), [])
}

export function setMyMaterials(list: UserMaterial[]) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(KEY_MY, JSON.stringify(list))
}

export function getSavedMaterials(): SavedMaterial[] {
  if (typeof localStorage === 'undefined') return []
  return safeParse<SavedMaterial[]>(localStorage.getItem(KEY_SAVED), [])
}

export function setSavedMaterials(list: SavedMaterial[]) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(KEY_SAVED, JSON.stringify(list))
}
