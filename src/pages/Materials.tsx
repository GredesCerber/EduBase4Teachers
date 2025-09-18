import { useEffect, useMemo, useState } from 'react'
import type { SavedMaterial } from '@/types/material'
import { useAuth } from '@/auth/AuthContext'
import { SUBJECTS_KZ as SUBJECTS, GRADES_KZ as GRADES } from '@/constants/subjects'
import { addFavorite as apiAddFavorite, removeFavorite as apiRemoveFavorite, getMaterials, getFavoriteMaterials } from '@/api/axios'
import Section from '@/components/Section'
import type { UserMaterial } from '@/types/material'
import { MATERIAL_TYPES_KZ } from '@/constants/materialTypes'
import StarButton from '@/components/StarButton'
import ConfirmDialog from '@/components/ConfirmDialog'
import Modal from '../components/Modal'
import { useI18n } from '@/i18n/I18nContext'

// Use centralized MaterialType

export default function Materials() {
  const { user } = useAuth()
  const { t } = useI18n()
  const userId = user?.id
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [type, setType] = useState('')
  const [items, setItems] = useState<UserMaterial[]>([])
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'new' | 'popular' | 'relevance'>('new')
  const [saved, setSaved] = useState<SavedMaterial[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingUnsaveId, setPendingUnsaveId] = useState<number | null>(null)
  const [preview, setPreview] = useState<{ url: string; type: string; name?: string } | null>(null)
  const [page, setPage] = useState(1)
  const limit = 20
  const [hasMore, setHasMore] = useState(false)
  const [debouncedQ, setDebouncedQ] = useState('')

  // Debounce text search to reduce server load
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {
    (async () => {
      const hasQuery = Boolean(debouncedQ)
      const effectiveSort = hasQuery ? (sort === 'popular' ? 'popular' : 'relevance') : sort
      const res = await getMaterials({ q: debouncedQ, subject, grade, type, limit, offset: (page - 1) * limit, sort: effectiveSort })
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
        views: m.views || 0,
        downloads: m.downloads || 0,
        attachments: m.attachments || [],
      }))
      setItems(list)
      setHasMore(list.length === limit)
    })()
  }, [debouncedQ, subject, grade, type, sort, page])

  // Reset page when filters change (except sort change to relevance default handled above)
  useEffect(() => { setPage(1) }, [q, subject, grade, type])

  // no-op: saved state is purely server-synced for authorized users

  // When user logs in, sync server favorites into local saved
  useEffect(() => {
    (async () => {
      if (!userId) return
      try {
        const res = await getFavoriteMaterials()
        const list: SavedMaterial[] = (res.materials || []).map((m: any) => ({ id: Number(m.id), title: m.title, subject: m.subject, grade: m.grade, type: m.type }))
        setSaved(list)
      } catch {
        // ignore
      }
    })()
  }, [userId])

  const isSaved = (id: number | string) => saved.some((s) => s.id === Number(id))
  // toggleSaved handled inline in StarButton onClick with server sync

  const confirmUnsave = () => {
    if (pendingUnsaveId == null) return
    setSaved((prev) => prev.filter((x) => x.id !== pendingUnsaveId))
    setPendingUnsaveId(null)
    setConfirmOpen(false)
  }

  const list = useMemo(() => items, [items])

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">Материалы</h1>

      <Section>
        <div className="grid gap-4">
          <label className="block">
            <span className="block text-sm font-medium mb-1">{t('searchByTitle')}</span>
            <input
              className="border rounded-md p-2 w-full"
              placeholder={t('searchPlaceholder')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-5 items-end">
            <label className="block">
              <span className="block text-sm font-medium mb-1">{t('subject')}</span>
              <select className="border rounded-md p-2 w-full" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">{t('allSubjects')}</option>
                {SUBJECTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1">{t('type')}</span>
              <select className="border rounded-md p-2 w-full" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">{t('allTypes')}</option>
                {MATERIAL_TYPES_KZ.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1">{t('sort')}</span>
              <select className="border rounded-md p-2 w-full" value={sort} onChange={(e) => setSort(e.target.value as any)}>
                <option value="new">{t('sort_new')}</option>
                <option value="popular">{t('sort_popular')}</option>
                <option value="relevance">{t('sort_relevance')}</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1">{t('grade')}</span>
              <select className="border rounded-md p-2 w-full" value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">{t('allGrades')}</option>
                {GRADES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <div className="flex self-end md:justify-end md:justify-self-end">
              <button
                type="button"
                className="px-4 py-2 rounded-md border hover:bg-slate-50 bg-white"
                onClick={() => { setQ(''); setSubject(''); setType(''); setGrade(''); setSort('new') }}
              >
                {t('resetFilters')}
              </button>
            </div>
          </div>
          {(q || subject || type || grade) && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-slate-600 mr-1">{t('activeFilters')}</span>
              {q && <span className="px-2 py-1 rounded-full text-xs bg-sky-100 text-sky-800">{t('search')}: “{q}”</span>}
              {subject && <span className="px-2 py-1 rounded-full text-xs bg-sky-100 text-sky-800">{subject}</span>}
              {type && <span className="px-2 py-1 rounded-full text-xs bg-sky-100 text-sky-800">{type}</span>}
              {grade && <span className="px-2 py-1 rounded-full text-xs bg-sky-100 text-sky-800">{grade}</span>}
            </div>
          )}
        </div>
      </Section>

      <Section title={t('materialsList')}>
        <ul className="divide-y">
          {list.map((m) => (
            <li key={m.id} className="p-4 hover:bg-sky-50 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate" title={m.title}>{m.title}</div>
                <div className="text-sm text-slate-600">{m.subject} · {m.grade} {t('gradeLabel')} · {m.type}</div>
                {m.authorName && (
                  <div className="text-sm text-slate-700">{t('author')}: {m.authorName}</div>
                )}
                <div className="text-xs text-slate-500 mt-1">{t('views')}: {m.views ?? 0} · {t('downloads')}: {m.downloads ?? 0}</div>
                {m.link && (
                  <div className="text-sm mt-1">
                    {t('link')}: <a href={m.link} target="_blank" rel="noreferrer" className="underline">{t('open')}</a>
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
                          <div className="font-medium">{t('mainFiles')}:</div>
                          <ul className="list-disc ml-5">
                            {hasLegacyMain && (
                              <li>
                                <div className="flex items-center gap-3">
                                  <a href={`/api/materials/${m.id}/download`} className="underline">
                                    {m.fileName || t('downloadMain')}
                                  </a>
                                  {m.mimeType?.startsWith('image/') && m.fileUrl && (
                                    <button className="text-primary-700 underline" onClick={() => setPreview({ url: m.fileUrl!, type: m.mimeType!, name: m.fileName })}>{t('preview')}</button>
                                  )}
                                  {m.mimeType === 'application/pdf' && m.fileUrl && (
                                    <button className="text-primary-700 underline" onClick={() => setPreview({ url: m.fileUrl!, type: m.mimeType!, name: m.fileName })}>{t('viewInBrowser')}</button>
                                  )}
                                </div>
                              </li>
                            )}
                            {mainFiles.map((f: any) => (
                              <li key={f.id}>
                                <div className="flex items-center gap-3">
                                  <a href={`/api/files/${f.id}/download`} className="underline">{f.file_name}</a>
                                  {String(f.mime_type || '').startsWith('image/') && f.file_url && (
                                    <button className="text-primary-700 underline" onClick={() => setPreview({ url: f.file_url, type: f.mime_type, name: f.file_name })}>{t('preview')}</button>
                                  )}
                                  {f.mime_type === 'application/pdf' && f.file_url && (
                                    <button className="text-primary-700 underline" onClick={() => setPreview({ url: f.file_url, type: f.mime_type, name: f.file_name })}>{t('viewInBrowser')}</button>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {extraFiles.length > 0 && (
                        <div className="text-sm mt-2 space-y-1">
                          <div className="font-medium">{t('extraFiles')}:</div>
                          <ul className="list-disc ml-5">
                            {extraFiles.map((f: any) => (
                              <li key={f.id}>
                                <div className="flex items-center gap-3">
                                  <a href={`/api/files/${f.id}/download`} className="underline">{f.file_name}</a>
                                  {String(f.mime_type || '').startsWith('image/') && f.file_url && (
                                    <button className="text-primary-700 underline" onClick={() => setPreview({ url: f.file_url, type: f.mime_type, name: f.file_name })}>{t('preview')}</button>
                                  )}
                                  {f.mime_type === 'application/pdf' && f.file_url && (
                                    <button className="text-primary-700 underline" onClick={() => setPreview({ url: f.file_url, type: f.mime_type, name: f.file_name })}>{t('viewInBrowser')}</button>
                                  )}
                                </div>
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
                  title={!user ? t('loginToSave') : isSaved(m.id) ? t('removeFromFavorites') : t('addToFavorites')}
                  active={isSaved(m.id)}
                  onClick={async () => {
                    const idNum = Number(m.id)
                    const mine = user && m.authorId === user.id
                    if (mine) return
                    if (!user) return
                    try {
                      if (isSaved(idNum)) {
                        await apiRemoveFavorite(idNum)
                        setSaved((prev) => prev.filter((x) => x.id !== idNum))
                      } else {
                        await apiAddFavorite(idNum)
                        const entry: SavedMaterial = { id: idNum, title: m.title, subject: m.subject, grade: m.grade, type: m.type }
                        setSaved((prev) => [entry, ...prev])
                      }
                    } catch {
                      // ignore
                    }
                  }}
                  disabled={!user || (user ? m.authorId === user.id : false)}
                  className={isSaved(m.id) ? 'text-yellow-500' : 'text-slate-400 hover:text-yellow-500'}
                />
              </div>
            </li>
          ))}
          {list.length === 0 && <li className="p-4 text-slate-500">{t('noMaterials')}</li>}
        </ul>
      </Section>
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="px-3 py-2 rounded-md border bg-white disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          {t('prev')}
        </button>
        <div className="text-sm text-slate-600">{page}</div>
        <button
          type="button"
          className="px-3 py-2 rounded-md border bg-white disabled:opacity-50"
          onClick={() => setPage((p) => (hasMore ? p + 1 : p))}
          disabled={!hasMore}
        >
          {t('next')}
        </button>
      </div>
      <Modal open={!!preview} title={preview?.name || t('filePreview')} onClose={() => setPreview(null)}>
        {preview && (
          <div className="w-full h-[70vh]">
            {preview.type.startsWith('image/') ? (
              <img src={preview.url} alt={preview.name || ''} className="max-h-full max-w-full object-contain mx-auto" />
            ) : preview.type === 'application/pdf' ? (
              <iframe src={preview.url} title={preview.name || 'PDF'} className="w-full h-full border" />
            ) : (
              <div className="text-sm text-slate-600">{t('previewNotAvailable')}</div>
            )}
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={confirmOpen}
        title={t('removeSavedTitle')}
        description={t('removeSavedDesc')}
        confirmText={t('remove')}
        cancelText={t('cancel')}
        onConfirm={confirmUnsave}
        onCancel={() => { setConfirmOpen(false); setPendingUnsaveId(null) }}
      />
    </div>
  )
}
