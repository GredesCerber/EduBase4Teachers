import { Route, Routes, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import Home from './pages/Home'
import Materials from './pages/Materials'
import Notes from './pages/Notes'
import Presentations from './pages/Presentations'
import Programs from './pages/Programs'
import Forum from './pages/Forum'
import BestPractices from './pages/BestPractices'
import MyMaterials from './pages/MyMaterials'
import SavedMaterials from './pages/SavedMaterials'
import Settings from './pages/Settings'
import News from './pages/News'
import About from './pages/About'
import ProtectedRoute from '@/auth/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="materials" element={<Materials />} />
        <Route path="materials/notes" element={<Notes />} />
        <Route path="materials/presentations" element={<Presentations />} />
        <Route path="materials/programs" element={<Programs />} />

        <Route path="experience/forum" element={<Forum />} />
        <Route path="experience/best-practices" element={<BestPractices />} />
        <Route element={<ProtectedRoute />}>
          <Route path="account/my" element={<MyMaterials />} />
          <Route path="account/saved" element={<SavedMaterials />} />
          <Route path="account/settings" element={<Settings />} />
        </Route>

        <Route path="news" element={<News />} />
  <Route path="about" element={<About />} />
  <Route path="contacts" element={<Navigate to="/about" replace />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
