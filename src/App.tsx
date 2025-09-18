import { Route, Routes, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import ProtectedRoute from '@/auth/ProtectedRoute'
import AdminRoute from '@/auth/AdminRoute'

const MainLayout = lazy(() => import('./layouts/MainLayout'))
const Home = lazy(() => import('./pages/Home'))
const Materials = lazy(() => import('./pages/Materials'))
const Notes = lazy(() => import('./pages/Notes'))
const Presentations = lazy(() => import('./pages/Presentations'))
const Programs = lazy(() => import('./pages/Programs'))
// Split forum list and thread into separate chunks to improve cold-start
const Forum = lazy(() => import('./pages/Forum'))
const ForumThreadPage = lazy(() => import('./pages/Forum').then((m) => ({ default: m.ForumThreadPage })))
const BestPractices = lazy(() => import('./pages/BestPractices'))
const MyMaterials = lazy(() => import('./pages/MyMaterials'))
const SavedMaterials = lazy(() => import('./pages/SavedMaterials'))
const Settings = lazy(() => import('./pages/Settings'))
const News = lazy(() => import('./pages/News'))
const About = lazy(() => import('./pages/About'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const NotFound = lazy(() => import('./pages/NotFound'))
const AdminMaterials = lazy(() => import('./pages/admin/AdminMaterials'))

export default function App() {
  return (
    <Suspense fallback={<div className="p-4 text-slate-600">Загрузка…</div>}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="materials" element={<Materials />} />
          <Route path="materials/notes" element={<Notes />} />
          <Route path="materials/presentations" element={<Presentations />} />
          <Route path="materials/programs" element={<Programs />} />

          <Route path="experience/forum" element={<Forum />} />
          <Route path="experience/forum/:id" element={<ForumThreadPage />} />
          <Route path="experience/best-practices" element={<BestPractices />} />
          <Route element={<ProtectedRoute />}>
            <Route path="account/my" element={<MyMaterials />} />
            <Route path="account/saved" element={<SavedMaterials />} />
            <Route path="account/settings" element={<Settings />} />
          </Route>

          <Route element={<AdminRoute />}>
            <Route path="admin/materials" element={<AdminMaterials />} />
          </Route>

          <Route path="news" element={<News />} />
          <Route path="about" element={<About />} />
          <Route path="contacts" element={<Navigate to="/about" replace />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
