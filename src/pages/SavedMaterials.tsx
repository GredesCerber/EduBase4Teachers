import { useEffect, useMemo, useState } from 'react'
import AccountNav from '@/components/AccountNav'
import type { SavedMaterial, UserMaterial } from '@/types/material'
import { getFavoriteMaterials, removeFavorite as apiRemoveFavorite } from '@/api/axios'
import StarButton from '@/components/StarButton'
import ConfirmDialog from '@/components/ConfirmDialog'

export default function SavedMaterials() {
  const [saved, setSaved] = useState<SavedMaterial[]>([])
  const [all, setAll] = useState<UserMaterial[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingUnsaveId, setPendingUnsaveId] = useState<number | null>(null)

  useEffect(() => {
    (async () => {
      const res = await getFavoriteMaterials()
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
      setAll(list)
    })()
  }, [])

  const enriched = useMemo(() => {
    const map = new Map(all.map((m) => [Number(m.id), m]))
    return saved
      .map((s) => map.get(s.id))
      .filter(Boolean) as UserMaterial[]
  }, [saved, all])

  const isSaved = (id: number | string) => saved.some((s) => s.id === Number(id))
  const requestUnsave = (id: number) => {
    setPendingUnsaveId(id)
    setConfirmOpen(true)
  }
  const confirmUnsave = async () => {
    if (pendingUnsaveId == null) return
    try { await apiRemoveFavorite(pendingUnsaveId) } catch {
      // ignore
    }
    setSaved((prev) => prev.filter((x) => x.id !== pendingUnsaveId))
    setAll((prev) => prev.filter((x) => Number(x.id) !== pendingUnsaveId))
    setPendingUnsaveId(null)
    setConfirmOpen(false)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Личный кабинет</h1>
      <AccountNav />

      <section className="space-y-3">
        <h2 className="font-semibold">Мои сохранённые</h2>
        <ul className="divide-y bg-white border rounded-md">
          {enriched.map((m) => (
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
                                <a href={`/api/materials/${m.id}/download`} className="underline">
                                  {m.fileName || 'скачать основной файл'}
                                </a>
                              </li>
                            )}
                            {mainFiles.map((f: any) => (
                              <li key={f.id}>
                                <a href={`/api/files/${f.id}/download`} className="underline">{f.file_name}</a>
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
                                <a href={`/api/files/${f.id}/download`} className="underline">{f.file_name}</a>
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
                  title={'Убрать из сохранённых'}
                  active={isSaved(m.id)}
                  onClick={() => requestUnsave(Number(m.id))}
                  className={'text-yellow-500'}
                />
              </div>
            </li>
          ))}
          {enriched.length === 0 && (
            <li className="p-4 text-slate-500">Закладок пока нет. Откройте раздел «Материалы» и сохраните понравившиеся.</li>
          )}
        </ul>
      </section>
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
