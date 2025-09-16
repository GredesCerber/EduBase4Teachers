import { useEffect, useMemo, useState } from 'react'
import { getSavedMaterials, setSavedMaterials } from '@/utils/storage'
import type { SavedMaterial } from '@/types/material'
import { useAuth } from '@/auth/AuthContext'
import { SUBJECTS_KZ as SUBJECTS, GRADES_KZ as GRADES } from '@/constants/subjects'
import { getMaterials } from '@/api/axios'
import Section from '@/components/Section'
import type { UserMaterial, MaterialType } from '@/types/material'
import { MATERIAL_TYPES_KZ } from '@/constants/materialTypes'
import StarButton from '@/components/StarButton'
import ConfirmDialog from '@/components/ConfirmDialog'

// Use centralized MaterialType

export default function Materials() {
  const { user } = useAuth()
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [type, setType] = useState('')
  const [items, setItems] = useState<UserMaterial[]>([])
  const [q, setQ] = useState('')
  const [saved, setSaved] = useState<SavedMaterial[]>(() => getSavedMaterials())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingUnsaveId, setPendingUnsaveId] = useState<number | null>(null)

  useEffect(() => {
    (async () => {
      const res = await getMaterials()
      const list: UserMaterial[] = res.materials.map((m: any) => ({
        id: String(m.id),
        title: m.title,
        subject: m.subject,
        grade: m.grade,
        type: m.type,
        authorName: m.author_name,
        authorId: m.author_id,
        description: m.description ?? null,
        link: m.link || undefined,
        fileUrl: m.file_url || undefined,
        fileName: m.file_name || undefined,
        size: m.size || undefined,
        mimeType: m.mime_type || undefined,
        createdAt: m.created_at,
        attachments: m.attachments || [],
      }))
      setItems(list)
    })()
  }, [])

  useEffect(() => {
    setSavedMaterials(saved)
  }, [saved])

  const isSaved = (id: number | string) => saved.some((s) => s.id === Number(id))
  const toggleSaved = (m: UserMaterial) => {
    const idNum = Number(m.id)
    const mine = user && m.authorId === user.id
    if (mine) return // do not allow saving own materials
    if (isSaved(idNum)) {
      setPendingUnsaveId(idNum)
      setConfirmOpen(true)
    } else {
      const entry: SavedMaterial = {
        id: idNum,
        title: m.title,
        subject: m.subject,
        grade: m.grade,
        type: m.type,
      }
      setSaved((prev) => [entry, ...prev])
    }
  }

  const confirmUnsave = () => {
    if (pendingUnsaveId == null) return
    setSaved((prev) => prev.filter((x) => x.id !== pendingUnsaveId))
    setPendingUnsaveId(null)
    setConfirmOpen(false)
  }

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return items.filter((m) =>
      (subject ? m.subject === subject : true) &&
      (grade ? m.grade === grade : true) &&
      (type ? m.type === (type as MaterialType) : true) &&
      (qq ? m.title.toLowerCase().includes(qq) : true)
    )
  }, [items, subject, grade, type, q])

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">Материалы</h1>

      <Section>
        <div className="grid gap-4">
          <label className="block">
            <span className="block text-sm font-medium mb-1">Поиск по названию</span>
            <input
              className="border rounded-md p-2 w-full"
              placeholder="Начните вводить название материала"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-4 items-end">
            <label className="block">
              <span className="block text-sm font-medium mb-1">Предмет</span>
              <select className="border rounded-md p-2 w-full" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">Все предметы</option>
                {SUBJECTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1">Тип</span>
              <select className="border rounded-md p-2 w-full" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Все типы</option>
                {MATERIAL_TYPES_KZ.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1">Класс</span>
              <select className="border rounded-md p-2 w-full" value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">Все классы</option>
                {GRADES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <div className="flex md:justify-end">
              <button
                type="button"
                className="px-4 py-2 rounded-md border hover:bg-slate-50 bg-white"
                onClick={() => { setQ(''); setSubject(''); setType(''); setGrade('') }}
              >
                Сбросить фильтры
              </button>
            </div>
          </div>
          {(q || subject || type || grade) && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-slate-600 mr-1">Активные фильтры:</span>
              {q && <span className="px-2 py-1 rounded-full text-xs bg-sky-100 text-sky-800">Поиск: “{q}”</span>}
              {subject && <span className="px-2 py-1 rounded-full text-xs bg-sky-100 text-sky-800">{subject}</span>}
              {type && <span className="px-2 py-1 rounded-full text-xs bg-sky-100 text-sky-800">{type}</span>}
              {grade && <span className="px-2 py-1 rounded-full text-xs bg-sky-100 text-sky-800">{grade}</span>}
            </div>
          )}
        </div>
      </Section>

      <Section title="Список материалов">
        <ul className="divide-y">
          {list.map((m) => (
            <li key={m.id} className="p-4 hover:bg-sky-50 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate" title={m.title}>{m.title}</div>
                <div className="text-sm text-slate-600">{m.subject} · {m.grade} класс · {m.type}</div>
                {m.authorName && (
                  <div className="text-sm text-slate-700">Автор: {m.authorName}</div>
                )}
                {m.link && (
                  <div className="text-sm mt-1">
                    Ссылка: <a href={m.link} target="_blank" rel="noreferrer" className="underline">открыть</a>
                  </div>
                )}
                {/* Основные и дополнительные файлы */}
                {(() => {
                  const attachments = Array.isArray(m.attachments) ? m.attachments : []
                  const mainFiles = attachments.filter((f: any) => f?.is_main === 1)
                  const extraFiles = attachments.filter((f: any) => f?.is_main !== 1)
                  const hasLegacyMain = Boolean(m.fileUrl)
                  return (
                    <>
                      {(hasLegacyMain || mainFiles.length > 0) && (
                        <div className="text-sm mt-2 space-y-1">
                          <div className="font-medium">Основные файлы:</div>
                          <ul className="list-disc ml-5">
                            {hasLegacyMain && (
                              <li>
                                <a href={`http://localhost:4000/api/materials/${m.id}/download`} className="underline">
                                  {m.fileName || 'скачать основной файл'}
                                </a>
                              </li>
                            )}
                            {mainFiles.map((f: any) => (
                              <li key={f.id}>
                                <a href={`http://localhost:4000/api/files/${f.id}/download`} className="underline">{f.file_name}</a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {extraFiles.length > 0 && (
                        <div className="text-sm mt-2 space-y-1">
                          <div className="font-medium">Дополнительные файлы:</div>
                          <ul className="list-disc ml-5">
                            {extraFiles.map((f: any) => (
                              <li key={f.id}>
                                <a href={`http://localhost:4000/api/files/${f.id}/download`} className="underline">{f.file_name}</a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )
                })()}
                {m.description && (
                  <div className="text-sm mt-2 whitespace-pre-wrap">{m.description}</div>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-xs text-slate-500 whitespace-nowrap self-start">
                  {new Date(m.createdAt).toLocaleDateString()}
                </div>
                <StarButton
                  title={isSaved(m.id) ? 'Убрать из сохранённых' : 'Сохранить'}
                  active={isSaved(m.id)}
                  onClick={() => toggleSaved(m)}
                  disabled={user ? m.authorId === user.id : false}
                  className={isSaved(m.id) ? 'text-yellow-500' : 'text-slate-400 hover:text-yellow-500'}
                />
              </div>
            </li>
          ))}
          {list.length === 0 && <li className="p-4 text-slate-500">Пока нет загруженных материалов</li>}
        </ul>
      </Section>
      <ConfirmDialog
        open={confirmOpen}
        title="Убрать из сохранённых?"
        description="Материал будет удалён из списка сохранённых."
        confirmText="Убрать"
        cancelText="Отмена"
        onConfirm={confirmUnsave}
        onCancel={() => { setConfirmOpen(false); setPendingUnsaveId(null) }}
      />
    </div>
  )
}
