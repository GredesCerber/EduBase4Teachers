import { useEffect, useState } from 'react'
import Section from '@/components/Section'
import { getInformNews } from '@/api/axios'

type NewsItem = { title: string; url: string; image?: string | null; summary?: string | null; publishedAt?: string | null }

export default function News() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await getInformNews()
        const filtered = (res.items || []).filter((it) => {
          const t = (it.title || '').toLowerCase()
          const u = (it.url || '').toLowerCase()
          const im = (it.image || '').toLowerCase()
          const adWords = ['реклама', 'на правах рекламы', 'promo', 'промо', 'sponsor', 'sponsored', 'adv', 'banner', 'adfox']
          return !adWords.some((w) => t.includes(w) || u.includes(w) || im.includes(w))
        })
        if (!ignore) setItems(filtered)
  } catch {
        if (!ignore) setError('Не удалось загрузить новости')
      } finally {
        if (!ignore) setLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [])

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">Новости</h1>
      <Section title="Образование — Inform.kz" description="Лента новостей раздела 'Образование' с inform.kz">
        {loading && <div className="text-slate-600">Загрузка…</div>}
        {error && <div className="text-red-600">{error}</div>}
        {!loading && !error && (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((n, i) => (
              <li key={i} className="border rounded-md overflow-hidden bg-white">
                <a href={n.url} target="_blank" rel="noreferrer" className="block w-full h-40 bg-slate-100">
                  {n.image ? (
                    <img
                      src={n.image}
                      alt=""
                      className="w-full h-40 object-cover"
                      onError={(e) => {
                        // Hide broken image; keep placeholder background
                        (e.currentTarget as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : null}
                </a>
                <div className="p-3 space-y-2">
                  <a href={n.url} target="_blank" rel="noreferrer" className="font-medium hover:underline line-clamp-3 block">
                    {n.title}
                  </a>
                  {n.publishedAt && <div className="text-xs text-slate-500">{n.publishedAt}</div>}
                  {n.summary && <div className="text-sm text-slate-700 line-clamp-3">{n.summary}</div>}
                  <div className="pt-1">
                    <a href={n.url} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">Открыть на inform.kz →</a>
                  </div>
                </div>
              </li>
            ))}
            {items.length === 0 && <li className="text-slate-600">Пока нет новостей</li>}
          </ul>
        )}
      </Section>
    </div>
  )
}
