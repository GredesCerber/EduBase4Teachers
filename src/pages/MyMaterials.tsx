import { useEffect, useMemo, useState } from 'react'
import AccountNav from '@/components/AccountNav'
import Section from '@/components/Section'
import { createMaterial, getMyMaterials as apiGetMyMaterials, deleteMaterial as apiDeleteMaterial, editMaterial, uploadExtraFiles, getMaterialFiles, deleteAttachment, uploadMainFiles, markAttachmentAsMain, deleteMainFile } from '@/api/axios'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { MaterialType, UserMaterial } from '@/types/material'
import { SUBJECTS_KZ as SUBJECTS, GRADES_KZ as GRADES } from '@/constants/subjects'
import FileInput from '@/components/FileInput'
import { MATERIAL_TYPES_KZ } from '@/constants/materialTypes'

type FormState = {
  title: string
  subject: string
  grade: string
  type: MaterialType | ''
  link: string
  description: string
  file?: File | null
  files?: File[]
  extraFiles?: File[]
}

const TYPES: MaterialType[] = MATERIAL_TYPES_KZ

export default function MyMaterials() {
  const [form, setForm] = useState<FormState>({ title: '', subject: '', grade: '', type: '', link: '', description: '', file: null, files: [], extraFiles: [] })
  const [items, setItems] = useState<UserMaterial[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UserMaterial | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'new' | 'old' | 'title'>('new')
  const [fileKey, setFileKey] = useState(0)
  const [extraKey, setExtraKey] = useState(0)

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const res = await apiGetMyMaterials()
        if (!ignore) {
          const list = res.materials.map((m: any) => ({
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
        }
      } catch (e) {
        console.error(e)
      }
    })()
    return () => {
      ignore = true
    }
  }, [])

  const canSubmit = useMemo(() => {
    const hasAnyMain = (form.files && form.files.length) || form.file
    return Boolean(form.title && form.subject && form.grade && form.type && hasAnyMain)
  }, [form])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let arr = q
      ? items.filter((m) =>
          m.title.toLowerCase().includes(q) ||
          (m.description || '').toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q)
        )
      : items
    if (sort === 'title') arr = arr.slice().sort((a, b) => a.title.localeCompare(b.title, 'ru'))
    else if (sort === 'old') arr = arr.slice().sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
    else arr = arr.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return arr
  }, [items, search, sort])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setUploading(true)
    try {
      // Send only the first main file with create; then upload the rest as mains
      const mainFiles = (form.files && form.files.length) ? form.files : (form.file ? [form.file] : [])
      const [firstMain, ...restMains] = mainFiles
      const resp = await createMaterial({
        title: form.title.trim(),
        subject: form.subject,
        grade: form.grade,
        type: form.type as MaterialType,
        description: form.description.trim() || undefined,
        link: form.link.trim() || undefined,
        file: firstMain || null,
      }, (p) => setUploadPct(p))
      const m = resp.material
      if (restMains && restMains.length) {
        setUploadPct(0)
        await uploadMainFiles(m.id, restMains, (p) => setUploadPct(p))
      }
      // Upload extra files if selected
      if (form.extraFiles && form.extraFiles.length) {
        setUploadPct(0)
        await uploadExtraFiles(m.id, form.extraFiles, (p) => setUploadPct(p))
      }
      // Fetch canonical attachments list from server
  const filesRes = await getMaterialFiles(m.id)
      const item: UserMaterial = {
        id: String(m.id),
        title: m.title,
        subject: m.subject,
        grade: m.grade,
        type: m.type as MaterialType,
        authorName: m.author_name,
        authorId: m.author_id,
        description: m.description ?? null,
        link: m.link || undefined,
        fileUrl: m.file_url || undefined,
        fileName: m.file_name || undefined,
        size: m.size || undefined,
        mimeType: m.mime_type || undefined,
        createdAt: m.created_at,
  attachments: filesRes.files || [],
      }
      setItems((prev) => [item, ...prev])
  setForm({ title: '', subject: '', grade: '', type: '', link: '', description: '', file: null, files: [], extraFiles: [] })
      // reset file pickers visual state
      setFileKey((k) => k + 1)
      setExtraKey((k) => k + 1)
      setUploadPct(null)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ошибка загрузки файла')
    } finally {
      setUploading(false)
    }
  }

  const requestDelete = (id: string) => {
    setDeletingId(id)
    setConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingId) return
    try {
      setDeleting(true)
      await apiDeleteMaterial(deletingId)
      setItems((prev) => prev.filter((x) => x.id !== deletingId))
      setConfirmOpen(false)
      setDeletingId(null)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Ошибка при удалении')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">Личный кабинет</h1>
      <AccountNav />

      <Section title="Добавить материал" description="Заполните обязательные поля: Название, Предмет, Класс и Тип.">
        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Основная информация</h3>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <label className="block">
                <span className="block text-sm font-medium mb-1">Название</span>
                <input className="border rounded-md p-2 w-full" value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1">Предмет</span>
                <select className="border rounded-md p-2 w-full" value={form.subject} onChange={(e) => setForm((s) => ({ ...s, subject: e.target.value }))}>
                  <option value="">Выберите предмет</option>
                  {SUBJECTS.map((s) => (<option key={s}>{s}</option>))}
                </select>
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1">Класс</span>
                <select className="border rounded-md p-2 w-full" value={form.grade} onChange={(e) => setForm((s) => ({ ...s, grade: e.target.value }))}>
                  <option value="">Выберите класс</option>
                  {GRADES.map((g) => (<option key={g}>{g}</option>))}
                </select>
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1">Тип</span>
                <select className="border rounded-md p-2 w-full" value={form.type} onChange={(e) => setForm((s) => ({ ...s, type: e.target.value as MaterialType }))}>
                  <option value="">Выберите тип</option>
                  {TYPES.map((t) => (<option key={t}>{t}</option>))}
                </select>
              </label>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Описание и ссылка</h3>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="block text-sm font-medium mb-1">Описание (опционально)</span>
                <textarea className="border rounded-md p-2 w-full min-h-[80px]" placeholder="Кратко опишите материал" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1">Ссылка (опционально)</span>
                <input className="border rounded-md p-2 w-full" placeholder="https://..." value={form.link} onChange={(e) => setForm((s) => ({ ...s, link: e.target.value }))} />
              </label>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Файлы</h3>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <FileInput
                label="Основной файл (минимум 1)"
                accept=".doc,.docx,.ppt,.pptx,.pdf,.jpg,.jpeg,.png"
                multiple
                onSelect={(files) => setForm((s) => ({ ...s, files: files || [], file: (files && files[0]) || null }))}
                hint="Можно выбрать несколько: первый станет основным, остальные — доп."
                key={fileKey}
              />
              <FileInput label="Дополнительные файлы (опционально)" accept=".doc,.docx,.ppt,.pptx,.pdf,.jpg,.jpeg,.png" multiple onSelect={(files) => setForm((s) => ({ ...s, extraFiles: files || [] }))} hint="Можно выбрать несколько файлов" key={extraKey} />
            </div>
            {/* Previews with ability to remove before submit */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium">Выбранные основные:</div>
                {form.files && form.files.length ? (
                  <ul className="list-disc ml-5 space-y-1">
                    {form.files.map((f, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="break-all">{f.name}</span>
                        <button type="button" className="text-red-600 hover:underline" onClick={() => {
                          setForm((s) => {
                            const arr = Array.from(s.files || [])
                            arr.splice(idx, 1)
                            return { ...s, files: arr, file: arr[0] || null }
                          })
                        }}>убрать</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-slate-600">Не выбрано</div>
                )}
              </div>
              <div>
                <div className="font-medium">Выбранные дополнительные:</div>
                {form.extraFiles && form.extraFiles.length ? (
                  <ul className="list-disc ml-5 space-y-1">
                    {form.extraFiles.map((f, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="break-all">{f.name}</span>
                        <button type="button" className="text-red-600 hover:underline" onClick={() => {
                          setForm((s) => {
                            const arr = Array.from(s.extraFiles || [])
                            arr.splice(idx, 1)
                            return { ...s, extraFiles: arr }
                          })
                        }}>убрать</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-slate-600">Не выбрано</div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button disabled={!canSubmit || uploading} className={`btn ${!canSubmit || uploading ? 'bg-slate-300' : 'btn-primary'}`}>
              {uploading ? 'Загрузка...' : 'Сохранить'}
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
            {uploadPct !== null && (
              <div className="flex-1 h-2 bg-slate-200 rounded overflow-hidden max-w-[240px]">
                <div className="h-full bg-primary-500 transition-[width] duration-200" style={{ width: `${uploadPct}%` }} />
              </div>
            )}
          </div>
        </form>
      </Section>

      <Section title="Мои материалы" headerRight={
        <div className="flex items-end gap-2">
          <label className="block">
            <span className="block text-xs text-slate-600">Поиск</span>
            <input className="border rounded-md p-1.5" placeholder="Название/описание/предмет" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label className="block">
            <span className="block text-xs text-slate-600">Сортировка</span>
            <select className="border rounded-md p-1.5" value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="new">Сначала новые</option>
              <option value="old">Сначала старые</option>
              <option value="title">По названию A→Я</option>
            </select>
          </label>
        </div>
      }>
        <ul className="divide-y">
          {filtered.map((m) => (
            <li key={m.id} className="p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium truncate" title={m.title}>{m.title}</div>
                <div className="text-sm text-slate-600">
                  {m.subject} · {m.grade} класс · {m.type}
                </div>
                {m.description && (
                  <div className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{m.description}</div>
                )}
                {m.link && (
                  <a href={m.link} target="_blank" rel="noreferrer" className="text-sm underline">
                    Открыть ссылку
                  </a>
                )}
                {(m.fileUrl || (m.attachments || []).some((f: any) => f.is_main === 1)) && (
                  <div className="text-sm mt-1 space-y-1">
                    <div className="font-medium">Основные файлы:</div>
                    <ul className="list-disc ml-5 space-y-1">
                      {m.fileUrl && (
                        <li>
                          <a href={`http://localhost:4000/api/materials/${m.id}/download`} className="underline">{m.fileName || 'скачать'}</a>
                          {m.size ? <span className="text-slate-500"> ({Math.round(m.size / 1024)} КБ)</span> : null}
                        </li>
                      )}
                      {(m.attachments || []).filter((f: any) => f.is_main === 1).map((f: any) => (
                        <li key={f.id}>
                          <a href={`http://localhost:4000/api/files/${f.id}/download`} className="underline break-all">{f.file_name}</a>
                          {f.size ? <span className="text-slate-500"> ({Math.round((f.size || 0) / 1024)} КБ)</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {Array.isArray(m.attachments) && m.attachments.filter((f: any) => f.is_main !== 1).length > 0 && (
                  <div className="text-sm mt-2 space-y-1">
                    <div className="font-medium">Дополнительные файлы:</div>
                    <ul className="list-disc ml-5 space-y-1">
                      {m.attachments.filter((f: any) => f.is_main !== 1).map((f) => (
                        <li key={f.id} className="flex items-center gap-2">
                          <a href={`http://localhost:4000/api/files/${f.id}/download`} className="underline break-all">{f.file_name}</a>
                          {f.size ? <span className="text-slate-500"> ({Math.round((f.size || 0) / 1024)} КБ)</span> : null}
                          <button
                            type="button"
                            className="text-red-600 hover:underline ml-2"
                            title="Удалить файл"
                            onClick={async () => {
                              try {
                                if (!confirm('Удалить файл?')) return
                                await deleteAttachment(f.id)
                                setItems((prev) => prev.map((x) => x.id === m.id ? { ...x, attachments: (x.attachments || []).filter((af) => af.id !== f.id) } : x))
                              } catch (e) {
                                console.error(e)
                              }
                            }}
                          >Удалить</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Удалено: добавление файлов в списке. Добавление доступно только в режиме редактирования. */}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <button className="text-blue-600 hover:underline" onClick={() => { setEditTarget(m); setEditOpen(true) }}>
                  Редактировать
                </button>
                <button className="text-red-600 hover:underline" onClick={() => requestDelete(m.id)}>
                  Удалить
                </button>
              </div>
            </li>
          ))}
          {items.length === 0 && <li className="p-4 text-slate-500">Пока нет добавленных материалов</li>}
        </ul>
      </Section>

      <ConfirmDialog
        open={confirmOpen}
        title="Удалить материал"
        description="Вы уверены? Материал будет полностью удалён. Это действие нельзя отменить."
        confirmText="Удалить"
        cancelText="Отмена"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (deleting) return
          setConfirmOpen(false)
          setDeletingId(null)
        }}
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

// Убраны встроенные инлайн-редакторы, используется модальное окно редактирования

function EditMaterialDialog({ material, onClose, onSaved }: { material: UserMaterial; onClose: () => void; onSaved: (m: UserMaterial) => void }) {
  const [title, setTitle] = useState(material.title)
  const [subject, setSubject] = useState(material.subject)
  const [grade, setGrade] = useState(material.grade)
  const [typeV, setTypeV] = useState<MaterialType>(material.type)
  const [link, setLink] = useState(material.link || '')
  const [description, setDescription] = useState(material.description || '')
  // Allow selecting multiple new "main" files: first becomes main, others as attachments
  const [newMainFiles, setNewMainFiles] = useState<File[] | null>(null)
  const [extraFiles, setExtraFiles] = useState<File[] | null>(null)
  const [attachments, setAttachments] = useState<any[]>(Array.isArray(material.attachments) ? material.attachments : [])
  const [mainName, setMainName] = useState<string | undefined>(material.fileName)
  const [mainMeta, setMainMeta] = useState<{ fileUrl?: string; size?: number; mimeType?: string }>({ fileUrl: material.fileUrl, size: material.size, mimeType: material.mimeType })
  const [editUploadPct, setEditUploadPct] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const canSave = title && subject && grade && typeV

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    try {
      setSaving(true)
      // Update fields (JSON)
      await editMaterial(material.id, { title, subject, grade, type: typeV, description, link })
      // Add additional MAIN files without replacing existing one
      if (newMainFiles && newMainFiles.length) {
        setEditUploadPct(0)
        await uploadMainFiles(material.id, Array.from(newMainFiles), (p) => setEditUploadPct(p))
      }
      // Upload extra files if any
      if (extraFiles && extraFiles.length) {
        setEditUploadPct(0)
        await uploadExtraFiles(material.id, Array.from(extraFiles), (p) => setEditUploadPct(p))
      }
      // Refresh minimal local snapshot + fetch updated attachments list
      const filesRes = await getMaterialFiles(material.id)
      onSaved({
        ...material,
        title,
        subject,
        grade,
        type: typeV,
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
                  {TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
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
                      <a href={`http://localhost:4000/api/files/${f.id}/download`} className="underline break-all">{f.file_name}</a>
                      <button type="button" className="text-red-600 hover:underline" onClick={async () => {
                        try {
                          await deleteAttachment(f.id)
                          setAttachments((prev) => prev.filter((x: any) => x.id !== f.id))
                        } catch (e) { console.error(e) }
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
                        <a href={`http://localhost:4000/api/files/${f.id}/download`} className="underline break-all">{f.file_name}</a>
                        <button type="button" className="text-blue-600 hover:underline" onClick={async () => {
                          try {
                            const res = await markAttachmentAsMain(f.id)
                            setAttachments(res.files || [])
                          } catch (e) { console.error(e) }
                        }}>Отметить как основной</button>
                        <button type="button" className="text-red-600 hover:underline" onClick={async () => {
                          try {
                            if (!confirm('Удалить файл?')) return
                            await deleteAttachment(f.id)
                            setAttachments((prev) => prev.filter((x: any) => x.id !== f.id))
                          } catch (e) { console.error(e) }
                        }}>Удалить</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-slate-600">Дополнительных файлов нет</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FileInput
                label="Добавить основные файлы"
                accept=".doc,.docx,.ppt,.pptx,.pdf,.jpg,.jpeg,.png"
                multiple
                onSelect={(files) => setNewMainFiles(files || null)}
                hint="Выберите один или несколько файлов — все будут отмечены как основные"
              />
              <FileInput
                label="Добавить дополнительные файлы"
                accept=".doc,.docx,.ppt,.pptx,.pdf,.jpg,.jpeg,.png"
                multiple
                onSelect={(files) => setExtraFiles(files || null)}
                hint="Можно выбрать несколько файлов"
              />
            </div>
          </div>
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
