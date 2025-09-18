import axios from 'axios'

export const api = axios.create({
  // Default to Vite proxy so a single origin works locally and via tunnels
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  if (typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

export async function ping() {
  const res = await api.get('/health')
  return res.data
}

export async function uploadMaterialFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post('/materials/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data as { url: string; fileName: string; size: number; mimeType: string }
}

export async function createMaterial(data: {
  title: string
  subject: string
  grade: string
  type: string
  description?: string
  link?: string
  file?: File | null
  files?: File[] | null
}, onProgress?: (percent: number) => void) {
  const form = new FormData()
  form.append('title', data.title)
  form.append('subject', data.subject)
  form.append('grade', data.grade)
  form.append('type', data.type)
  if (data.description) form.append('description', data.description)
  if (data.link) form.append('link', data.link)
  if (data.files && data.files.length) {
    for (const f of data.files) form.append('file', f, f.name)
  } else if (data.file) {
    form.append('file', data.file, data.file.name)
  }
  const res = await api.post('/materials', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (!onProgress) return
      const total = evt.total || (evt as any).event?.total
      if (!total) return
      const percent = Math.round((evt.loaded / total) * 100)
      onProgress(percent)
    },
  })
  return res.data as { material: any }
}

export type MaterialsQuery = Partial<{
  q: string
  subject: string
  grade: string
  type: string
  sort: 'new' | 'popular' | 'relevance'
  limit: number
  offset: number
  favorite: 0 | 1
}>

export async function getMaterials(params?: MaterialsQuery) {
  const res = await api.get('/materials', { params })
  return res.data as { materials: any[] }
}

export async function getMyMaterials() {
  const res = await api.get('/materials/mine')
  return res.data as { materials: any[] }
}

export async function deleteMaterial(id: number | string) {
  const res = await api.delete(`/materials/${id}`)
  return res.data as { ok: boolean }
}

export async function editMaterial(id: number | string, data: Partial<{ title: string; subject: string; grade: string; type: string; description: string | null; link: string | null }>) {
  const res = await api.put(`/materials/${id}`, data)
  return res.data as { material: any }
}

export async function uploadExtraFiles(id: number | string, files: File[], onProgress?: (percent: number) => void) {
  const form = new FormData()
  for (const f of files) form.append('files', f, f.name)
  const res = await api.post(`/materials/${id}/files`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (!onProgress) return
      const total = evt.total || (evt as any).event?.total
      if (!total) return
      const percent = Math.round((evt.loaded / total) * 100)
      onProgress(percent)
    },
  })
  return res.data as { files: any[] }
}

export async function replaceMaterialFile(
  id: number | string,
  data: { title: string; subject: string; grade: string; type: string; description?: string | null; link?: string | null; file: File },
  onProgress?: (percent: number) => void
) {
  const form = new FormData()
  form.append('title', data.title)
  form.append('subject', data.subject)
  form.append('grade', data.grade)
  form.append('type', data.type)
  if (data.description) form.append('description', data.description)
  if (data.link) form.append('link', data.link)
  form.append('file', data.file, data.file.name)
  const res = await api.put(`/materials/${id}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (!onProgress) return
      const total = evt.total || (evt as any).event?.total
      if (!total) return
      const percent = Math.round((evt.loaded / total) * 100)
      onProgress(percent)
    },
  })
  return res.data as { material: any }
}

export async function getMaterialFiles(id: number | string) {
  const res = await api.get(`/materials/${id}/files`)
  return res.data as { files: any[] }
}

export async function deleteAttachment(id: number | string) {
  const res = await api.delete(`/files/${id}`)
  return res.data as { ok: boolean }
}

export async function makeAttachmentMain(materialId: number | string, fileId: number | string) {
  const res = await api.post(`/materials/${materialId}/files/${fileId}/make-main`)
  return res.data as { material: any; files: any[] }
}

export async function uploadMainFiles(id: number | string, files: File[], onProgress?: (percent: number) => void) {
  const form = new FormData()
  for (const f of files) form.append('files', f, f.name)
  const res = await api.post(`/materials/${id}/mains`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (!onProgress) return
      const total = evt.total || (evt as any).event?.total
      if (!total) return
      const percent = Math.round((evt.loaded / total) * 100)
      onProgress(percent)
    },
  })
  return res.data as { files: any[] }
}

export async function markAttachmentAsMain(fileId: number | string) {
  const res = await api.post(`/files/${fileId}/mark-main`)
  return res.data as { ok: boolean; files: any[] }
}

export async function getInformNews() {
  const res = await api.get('/news/inform')
  return res.data as { items: Array<{ title: string; url: string; image?: string | null; summary?: string | null; publishedAt?: string | null }>; cached?: boolean }
}

export async function deleteMainFile(materialId: number | string) {
  const res = await api.delete(`/materials/${materialId}/main`)
  return res.data as { ok: boolean; material: any; files: any[] }
}

// Favorites (server-side)
export async function addFavorite(materialId: number | string) {
  const res = await api.post(`/materials/${materialId}/favorite`)
  return res.data as { ok: boolean }
}

export async function removeFavorite(materialId: number | string) {
  const res = await api.delete(`/materials/${materialId}/favorite`)
  return res.data as { ok: boolean }
}

export async function getFavoriteMaterials() {
  const res = await api.get('/materials/favorites')
  return res.data as { materials: any[] }
}

// Optional counters
export async function incrementView(materialId: number | string) {
  const res = await api.post(`/materials/${materialId}/view`)
  return res.data as { ok: boolean }
}

// Forum
export type ForumThread = { id: number; user_id: number; author_name: string; title: string; posts_count: number; last_post_at?: string; created_at: string; likes_count?: number; my_like?: boolean }
export type ForumPost = { id: number; thread_id: number; user_id: number; author_name: string; content: string; created_at: string; files: Array<{ id: number; file_url: string; file_name: string; size?: number; mime_type?: string }>; reactions: { likes: number; dislikes: number; emojis: Record<string, number>; my: Array<{ type: 'like' | 'dislike' | 'emoji'; emoji: string | null }> } }

export async function listForumThreads(params?: { q?: string; limit?: number; offset?: number; sort?: 'new' | 'top' | 'active' }) {
  const res = await api.get('/forum/threads', { params })
  return res.data as { threads: ForumThread[] }
}

export async function createForumThreadApi(title: string) {
  const res = await api.post('/forum/threads', { title })
  return res.data as { thread: ForumThread }
}

export async function getForumThreadApi(id: number | string) {
  const res = await api.get(`/forum/threads/${id}`)
  return res.data as { thread: ForumThread; posts: ForumPost[] }
}

export async function addForumPostApi(id: number | string, data: { content: string; files?: File[] }, onProgress?: (percent: number) => void) {
  const form = new FormData()
  form.append('content', data.content || '')
  for (const f of data.files || []) form.append('files', f, f.name)
  const res = await api.post(`/forum/threads/${id}/posts`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (!onProgress) return
      const total = evt.total || (evt as any).event?.total
      if (!total) return
      const percent = Math.round((evt.loaded / total) * 100)
      onProgress(percent)
    },
  })
  return res.data as { postId: number }
}

export async function reactToPost(postId: number | string, payload: { type: 'like' | 'dislike' | 'emoji'; emoji?: string }) {
  const res = await api.post(`/forum/posts/${postId}/react`, payload)
  return res.data as { reactions: { likes: number; dislikes: number; emojis: Record<string, number>; my: Array<{ type: 'like' | 'dislike' | 'emoji'; emoji: string | null }> } }
}

export async function toggleThreadLike(threadId: number | string) {
  const res = await api.post(`/forum/threads/${threadId}/like`)
  return res.data as { likes_count: number; my_like: boolean }
}
