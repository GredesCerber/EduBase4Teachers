import { useEffect, useState } from 'react'
import Section from '@/components/Section'
import FileInput from '@/components/FileInput'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addForumPostApi, createForumThreadApi, getForumThreadApi, listForumThreads, reactToPost, toggleThreadLike, type ForumPost, type ForumThread } from '@/api/axios'
import { useAuth } from '@/auth/AuthContext'

export default function Forum() {
  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">Форум</h1>
      <ForumList />
    </div>
  )
}

function ForumList() {
  const [threads, setThreads] = useState<ForumThread[]>([])
  const [q, setQ] = useState('')
  const [title, setTitle] = useState('')
  const [sort, setSort] = useState<'new' | 'top' | 'active'>('new')
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    try {
  const res = await listForumThreads({ q: q.trim(), limit: 50, offset: 0, sort })
      setThreads(res.threads || [])
    } finally {
      setLoading(false)
    }
  }

  // Initial load (avoid referencing local function in deps to satisfy exhaustive-deps)
  useEffect(() => {
    let ignore = false
    ;(async () => {
      setLoading(true)
      try {
  const res = await listForumThreads({ q: '', limit: 50, offset: 0, sort: 'new' })
        if (!ignore) setThreads(res.threads || [])
      } finally {
        if (!ignore) setLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [])

  async function createThread(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const res = await createForumThreadApi(title.trim())
    setTitle('')
    navigate(`/experience/forum/${res.thread.id}`)
  }

  useEffect(() => {
    // auto reload when sort changes
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort])

  return (
    <>
      <Section title="Обсуждения" description="Создавайте ветки и делитесь опытом">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <label className="block w-full md:max-w-xs">
            <span className="block text-sm font-medium mb-1">Поиск</span>
            <input className="border rounded-md p-2 w-full" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Сортировка</span>
            <select className="border rounded-md p-2" value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="new">Новые</option>
              <option value="active">Активные</option>
              <option value="top">Лучшие</option>
            </select>
          </label>
          <button className="btn btn-outline" onClick={load} disabled={loading}>Искать</button>
        </div>
      </Section>
      <Section>
        <div className="flex flex-col gap-2">
          {threads.map((t) => (
            <div key={t.id} className="border rounded-md p-3 hover:bg-slate-50 flex items-start justify-between gap-3">
              <Link className="flex-1" to={`/experience/forum/${t.id}`}>
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-slate-600">Автор: {t.author_name} · Сообщений: {t.posts_count} · Обновлено: {t.last_post_at || t.created_at}</div>
              </Link>
              <button onClick={async (e) => {
                e.preventDefault()
                e.stopPropagation()
                try {
                  const res = await toggleThreadLike(t.id)
                  setThreads(prev => prev.map(it => it.id === t.id ? { ...it, likes_count: res.likes_count, my_like: res.my_like } : it))
                } catch (err) {
                  console.error('Failed to toggle like', err)
                }
              }} className={`px-2 py-1 rounded text-sm ${t.my_like ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>👍 {t.likes_count ?? 0}</button>
            </div>
          ))}
          {threads.length === 0 && <div className="text-slate-600">Пока нет веток</div>}
        </div>
      </Section>
      {user && (
        <Section title="Новая ветка">
          <form onSubmit={createThread} className="space-y-3">
            <input className="border rounded-md p-2 w-full" placeholder="Заголовок" value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="flex justify-end">
              <button className="btn btn-primary" disabled={!title.trim()}>Создать</button>
            </div>
          </form>
        </Section>
      )}
    </>
  )
}

export function ForumThreadPage() {
  const { id } = useParams()
  const [thread, setThread] = useState<ForumThread | null>(null)
  const [posts, setPosts] = useState<ForumPost[]>([])
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const [liking, setLiking] = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    try {
      const res = await getForumThreadApi(id)
      setThread(res.thread)
      setPosts(res.posts || [])
    } finally {
      setLoading(false)
    }
  }
  // Reload when id changes (inline fetch to avoid local fn dep)
  useEffect(() => {
    if (!id) return
    let ignore = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await getForumThreadApi(id)
        if (!ignore) {
          setThread(res.thread)
          setPosts(res.posts || [])
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [id])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    if (!content.trim() && files.length === 0) return
    setError(null)
    try {
      await addForumPostApi(id, { content: content.trim(), files })
      setContent('')
      setFiles([])
      await load()
      // Scroll to bottom in a simple way
      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50)
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Не удалось отправить сообщение'
      setError(String(msg))
    }
  }

  async function react(postId: number, type: 'like' | 'dislike' | 'emoji', emoji?: string) {
    const res = await reactToPost(postId, { type, emoji })
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, reactions: res.reactions } : p))
  }

  const canPost = !!user

  return (
    <div className="space-y-4 max-w-4xl">
      {!thread && loading && <div className="text-slate-600">Загрузка…</div>}
      {thread && (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{thread.title}</h1>
            <div className="flex items-center gap-2 text-sm">
              <button disabled={liking || !user} onClick={async () => {
                if (!id || !user) return
                try {
                  setLiking(true)
                  const res = await toggleThreadLike(id)
                  setThread(t => t ? { ...t, likes_count: res.likes_count, my_like: res.my_like } : t)
                } finally {
                  setLiking(false)
                }
              }} className={`px-2 py-1 rounded ${thread.my_like ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>👍 {thread.likes_count ?? 0}</button>
            </div>
          </div>
          <Section>
            <ul className="space-y-4">
              {posts.map((p) => (
                <li key={p.id} className="border rounded-md p-3 bg-white">
                  <div className="text-sm text-slate-600 mb-2">{p.author_name} · {p.created_at}</div>
                  {p.content && <div className="whitespace-pre-wrap text-slate-800">{p.content}</div>}
                  {Array.isArray(p.files) && p.files.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm">
                      {p.files.map((f) => (
                        <li key={f.id}>
                          <a href={f.file_url} className="text-primary-600 hover:underline break-all" target="_blank" rel="noreferrer">{f.file_name}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <button className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200" onClick={() => react(p.id, 'like')}>👍 {p.reactions.likes}</button>
                    <button className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200" onClick={() => react(p.id, 'dislike')}>👎 {p.reactions.dislikes}</button>
                    {/* A few quick emoji reactions */}
                    {['❤️','👏','🔥','🤝','🎉'].map((e) => (
                      <button key={e} className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200" onClick={() => react(p.id, 'emoji', e)}>{e} {(p.reactions.emojis[e] || 0)}</button>
                    ))}
                  </div>
                </li>
              ))}
              {posts.length === 0 && <li className="text-slate-600">Пока нет сообщений</li>}
            </ul>
          </Section>
          {canPost ? (
            <Section title="Новое сообщение">
              <form className="space-y-3" onSubmit={send}>
                {error && <div className="text-sm text-red-600">{error}</div>}
                <textarea className="border rounded-md p-2 w-full min-h-[100px]" placeholder="Текст сообщения" value={content} onChange={(e) => setContent(e.target.value)} />
                <FileInput buttonText="Прикрепить файлы" multiple accept="*/*" onSelect={(fs) => setFiles(fs || [])} hint="До 10 файлов" />
                <div className="flex justify-end">
                  <button className="btn btn-primary" disabled={!content.trim() && files.length === 0}>Отправить</button>
                </div>
              </form>
            </Section>
          ) : (
            <Section>
              <div className="text-slate-600">Чтобы отправлять сообщения, войдите в аккаунт.</div>
            </Section>
          )}
        </>
      )}
    </div>
  )
}
