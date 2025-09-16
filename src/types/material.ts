export type MaterialType =
  | 'Конспект'
  | 'Презентация'
  | 'Рабочая программа'
  | 'СОР'
  | 'СОЧ'
  | 'Формативное оценивание'
  | 'КСП'
  | 'КТП'
  | 'Контрольный срез'
  | 'Методические рекомендации'
  | 'Планы уроков'
  | 'Тесты'
  | 'Раздаточные материалы'

export interface UserMaterial {
  id: string
  title: string
  subject: string
  grade: string
  type: MaterialType
  authorName?: string
  authorId?: number
  description?: string | null
  link?: string
  // Uploaded file metadata (optional)
  fileUrl?: string
  fileName?: string
  size?: number
  mimeType?: string
  createdAt: string
  // Additional attached files
  attachments?: Array<{
    id: number
    material_id: number
    file_url: string
    file_name: string
    is_main?: number
    size?: number
    mime_type?: string
    created_at: string
  }>
}

export interface SavedMaterial {
  id: number
  title: string
  subject: string
  grade: string
  type: MaterialType
}
