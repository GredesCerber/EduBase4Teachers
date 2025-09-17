import type { UserMaterial } from '@/types/material'

const KEY_MY = 'my-materials'
// 'saved-materials' local cache has been removed; server favorites are the source of truth

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
