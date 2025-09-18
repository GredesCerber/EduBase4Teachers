import { useEffect, useMemo, useState } from 'react'
import Section from '@/components/Section'
import { getMaterials as apiGetMaterials, deleteMaterial as apiDeleteMaterial, editMaterial, getMaterialFiles, deleteAttachment, markAttachmentAsMain, deleteMainFile } from '@/api/axios'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { MaterialType, UserMaterial } from '@/types/material'
import { SUBJECTS_KZ as SUBJECTS, GRADES_KZ as GRADES } from '@/constants/subjects'
import { MATERIAL_TYPES_KZ } from '@/constants/materialTypes'

export default function AdminMaterials() {
  const [items, setItems] = useState<UserMaterial[]>([])
  const [q, setQ] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [type, setType] = useState('')
  const [sort, setSort] = useState<'new' | 'popular' | 'relevance'>('new')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UserMaterial | null>(null)

  useEffect(() => {
    (async () => {
      const res = await apiGetMaterials({ q: q.trim(), subject, grade, type, sort, limit: 50, offset: 0 })
      const list = (res.materials || []).map((m: any) => ({
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
      })) as UserMaterial[]
      setItems(list)
    })()
  }, [q, subject, grade, type, sort])

  const filtered = useMemo(() => items, [items])

  const requestDelete = (id: string) => { setDeletingId(id); setConfirmOpen(true) }
  const handleConfirmDelete = async () => {
    if (!deletingId) return
    try {
      setDeleting(true)
      await apiDeleteMaterial(deletingId)
      setItems((prev) => prev.filter((x) => x.id !== deletingId))
      setConfirmOpen(false)
      setDeletingId(null)
    } catch (e) {
      console.error(e)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold">Админ · Материалы</h1>
      <Section>
        <div className="grid gap-3 grid-cols-1 md:grid-cols-5 items-end">
          <label className="block">
            <span className="block text-sm font-medium mb-1">Поиск</span>
            <input className="border rounded-md p-2 w-full" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Предмет</span>
            <select className="border rounded-md p-2 w-full" value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">Все</option>
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Тип</span>
            <select className="border rounded-md p-2 w-full" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Все</option>
              {MATERIAL_TYPES_KZ.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Класс</span>
            <select className="border rounded-md p-2 w-full" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">Все</option>
              {GRADES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Сортировка</span>
            <select className="border rounded-md p-2 w-full" value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="new">Сначала новые</option>
              <option value="popular">Популярные</option>
              <option value="relevance">По релевантности</option>
            </select>
          </label>
        </div>
      </Section>

      <Section title="Все материалы">
        <ul className="divide-y">
          {filtered.map((m) => (
            <li key={m.id} className="p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium truncate" title={m.title}>{m.title}</div>
                <div className="text-sm text-slate-600">{m.subject} · {m.grade} класс · {m.type}</div>
                <div className="text-xs text-slate-500">Автор: {m.authorName} (id {m.authorId})</div>
                {m.description && <div className="text-sm mt-1 whitespace-pre-wrap">{m.description}</div>}
                {(m.fileUrl || (m.attachments || []).some((f: any) => f.is_main === 1)) && (
                  <div className="text-sm mt-1 space-y-1">
                    <div className="font-medium">Основные файлы:</div>
                    <ul className="list-disc ml-5 space-y-1">
                      {m.fileUrl && (
                        <li><a href={`/api/materials/${m.id}/download`} className="underline">{m.fileName || 'скачать'}</a></li>
                      )}
                      {(m.attachments || []).filter((f: any) => f.is_main === 1).map((f: any) => (
                        <li key={f.id}><a href={`/api/files/${f.id}/download`} className="underline break-all">{f.file_name}</a></li>
                      ))}
                    </ul>
                  </div>
                )}
                {Array.isArray(m.attachments) && m.attachments.filter((f: any) => f.is_main !== 1).length > 0 && (
                  <div className="text-sm mt-2 space-y-1">
                    <div className="font-medium">Дополнительные файлы:</div>
                    <ul className="list-disc ml-5 space-y-1">
                      {m.attachments.filter((f: any) => f.is_main !== 1).map((f) => (
                        <li key={f.id}><a href={`/api/files/${f.id}/download`} className="underline break-all">{f.file_name}</a></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <button className="text-blue-600 hover:underline" onClick={() => { setEditTarget(m); setEditOpen(true) }}>Редактировать</button>
                <button className="text-red-600 hover:underline" onClick={() => requestDelete(m.id)}>Удалить</button>
              </div>
            </li>
          ))}
          {items.length === 0 && <li className="p-4 text-slate-500">Материалы не найдены</li>}
        </ul>
      </Section>

      <ConfirmDialog
        open={confirmOpen}
        title="Удалить материал"
        description="Вы уверены? Материал будет полностью удалён. Это действие нельзя отменить."
        confirmText="Удалить"
        cancelText="Отмена"
        onConfirm={handleConfirmDelete}
        onCancel={() => { if (deleting) return; setConfirmOpen(false); setDeletingId(null) }}
        loading={deleting}
      />

      {editOpen && editTarget && (
        <EditMaterialDialog
          material={editTarget}
          onClose={() => { setEditOpen(false); setEditTarget(null) }}
          onSaved={(updated) => {
            setItems((prev) => prev.map((x) => x.id === updated.id ? { ...x, ...updated } : x))
            setEditOpen(false)
            setEditTarget(null)
          }}
        />
      )}
    </div>
  )
}

function EditMaterialDialog({ material, onClose, onSaved }: { material: UserMaterial; onClose: () => void; onSaved: (m: UserMaterial) => void }) {
  const [title, setTitle] = useState(material.title)
  const [subject, setSubject] = useState(material.subject)
  const [grade, setGrade] = useState(material.grade)
  const [typeV, setTypeV] = useState<MaterialType>(material.type)
  const [link, setLink] = useState(material.link || '')
  const [description, setDescription] = useState(material.description || '')
  // Uploading new files from admin dialog is not included in this release; keep it simple
  const [attachments, setAttachments] = useState<any[]>(Array.isArray(material.attachments) ? material.attachments : [])
  const [mainName, setMainName] = useState<string | undefined>(material.fileName)
  const [mainMeta, setMainMeta] = useState<{ fileUrl?: string; size?: number; mimeType?: string }>({ fileUrl: material.fileUrl, size: material.size, mimeType: material.mimeType })
  const [editUploadPct, _setEditUploadPct] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const canSave = title && subject && grade && typeV

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    try {
      setSaving(true)
      await editMaterial(material.id, { title, subject, grade, type: typeV, description, link })
      // Adding new files can be implemented here if needed (uploadMainFiles / uploadExtraFiles)
      const filesRes = await getMaterialFiles(material.id)
      onSaved({
        ...material,
        title, subject, grade, type: typeV,
        link: link || undefined,
        description: description || null,
        attachments: filesRes.files || [],
        fileName: mainName,
        fileUrl: mainMeta.fileUrl,
        size: mainMeta.size,
        mimeType: mainMeta.mimeType,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 z-0" onClick={onClose} />
      <div className="relative z-10 bg-white w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-md shadow-lg">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="font-semibold">Редактировать материал</h3>
          <button className="text-slate-600 hover:text-slate-900" onClick={onClose}>✕</button>
        </div>
        <form className="p-4 space-y-6" onSubmit={submit}>
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Основная информация</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-sm font-medium mb-1">Название</span>
                <input className="border rounded-md p-2 w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1">Ссылка (опционально)</span>
                <input className="border rounded-md p-2 w-full" value={link} onChange={(e) => setLink(e.target.value)} />
              </label>
              <label className="block md:col-span-2">
                <span className="block text-sm font-medium mb-1">Описание</span>
                <textarea className="border rounded-md p-2 w-full min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1">Предмет</span>
                <select className="border rounded-md p-2 w-full" value={subject} onChange={(e) => setSubject(e.target.value)}>
                  {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium mb-1">Класс</span>
                  <select className="border rounded-md p-2 w-full" value={grade} onChange={(e) => setGrade(e.target.value)}>
                    {GRADES.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-sm font-medium mb-1">Тип</span>
                  <select className="border rounded-md p-2 w-full" value={typeV} onChange={(e) => setTypeV(e.target.value as MaterialType)}>
                    {MATERIAL_TYPES_KZ.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Файлы</h4>
            <div className="rounded-md border p-3 mb-3 bg-slate-50 text-sm space-y-2">
              <div>
                <div className="font-medium">Основные файлы:</div>
                <ul className="list-disc ml-5 space-y-1">
                  {mainName && (
                    <li className="flex items-center gap-2 break-all">
                      <span>{mainName} <span className="text-slate-500">(текущий)</span></span>
                      <button type="button" className="text-red-600 hover:underline" onClick={async () => {
                        try {
                          if (!confirm('Удалить основной файл? Должен остаться хотя бы один файл.')) return
                          const res = await deleteMainFile(material.id)
                          setMainName(undefined)
                          setMainMeta({ fileUrl: undefined, size: undefined, mimeType: undefined })
                          setAttachments(res.files || [])
                        } catch (e: any) {
                          alert(e?.response?.data?.message || 'Не удалось удалить основной файл')
                        }
                      }}>Удалить</button>
                    </li>
                  )}
                  {attachments.filter((f: any) => f.is_main === 1).map((f: any) => (
                    <li key={f.id} className="flex items-center gap-2">
                      <a href={`/api/files/${f.id}/download`} className="underline break-all">{f.file_name}</a>
                      <button type="button" className="text-red-600 hover:underline" onClick={async () => {
                        try { await deleteAttachment(f.id); setAttachments((prev) => prev.filter((x: any) => x.id !== f.id)) } catch (e) { console.error(e) }
                      }}>Удалить</button>
                    </li>
                  ))}
                  {(!mainName && attachments.filter((f: any) => f.is_main === 1).length === 0) && (
                    <li className="text-slate-600 list-none">Основных файлов пока нет</li>
                  )}
                </ul>
              </div>
              <div>
                <div className="font-medium">Дополнительные файлы:</div>
                {Array.isArray(attachments) && attachments.filter((f: any) => f.is_main !== 1).length > 0 ? (
                  <ul className="list-disc ml-5 space-y-1">
                    {attachments.filter((f: any) => f.is_main !== 1).map((f: any) => (
                      <li key={f.id} className="flex items-center gap-2">
                        <a href={`/api/files/${f.id}/download`} className="underline break-all">{f.file_name}</a>
                        <button type="button" className="text-blue-600 hover:underline" onClick={async () => {
                          try { const res = await markAttachmentAsMain(f.id); setAttachments(res.files || []) } catch (e) { console.error(e) }
                        }}>Отметить как основной</button>
                        <button type="button" className="text-red-600 hover:underline" onClick={async () => {
                          try { if (!confirm('Удалить файл?')) return; await deleteAttachment(f.id); setAttachments((prev) => prev.filter((x: any) => x.id !== f.id)) } catch (e) { console.error(e) }
                        }}>Удалить</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-slate-600">Дополнительных файлов нет</div>
                )}
              </div>
            </div>
            <div className="text-sm text-slate-600">Добавление новых файлов доступно через отдельные формы в этом релизе — при необходимости добавим и здесь.</div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" className="btn btn-outline" onClick={onClose}>Отмена</button>
            <button disabled={!canSave || saving} className={`btn ${(!canSave || saving) ? 'bg-slate-300' : 'btn-primary'}`}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
            {editUploadPct !== null && (
              <div className="h-2 bg-slate-200 rounded overflow-hidden w-40">
                <div className="h-full bg-primary-500 transition-[width] duration-200" style={{ width: `${editUploadPct}%` }} />
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
