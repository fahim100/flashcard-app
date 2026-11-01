import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { Loading } from './components/ui'
import { AuthProvider, useAuth } from './lib/auth'
import Cards from './pages/Cards'
import Decks from './pages/Decks'
import Login from './pages/Login'
import Quiz from './pages/Quiz'
import ResetPassword from './pages/ResetPassword'
import Study from './pages/Study'

function AppRoutes() {
  const { session, loading, recovering } = useAuth()

  if (loading) return <Loading />
  if (recovering) return <ResetPassword />
  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Decks />} />
        <Route path="cards" element={<Cards />} />
        <Route path="study" element={<Study />} />
        <Route path="quiz" element={<Quiz />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
