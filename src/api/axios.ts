import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api',
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

export async function getMaterials() {
  const res = await api.get('/materials')
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
