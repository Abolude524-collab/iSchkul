import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { PageLoader } from './components/PageLoader';
import { useAuthStore } from './services/store';
import { useServiceWorker, useSyncListener } from './hooks/useOfflineSupport';
import { useTour } from './hooks/useTour';
import { fullSync } from './services/syncManager';
import { openDB } from './services/indexedDB';
import './styles/shepherd-theme.css';

// Lazy load pages for better performance
const LandingPage = React.lazy(() => import('./pages/LandingPage').then(module => ({ default: module.LandingPage })));
const AboutPage = React.lazy(() => import('./pages/AboutPage').then(module => ({ default: module.AboutPage })));
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage').then(module => ({ default: module.PrivacyPage })));
const LoginPage = React.lazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })));
const SignupPage = React.lazy(() => import('./pages/SignupPage').then(module => ({ default: module.SignupPage })));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage').then(module => ({ default: module.ForgotPasswordPage })));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const QuizPage = React.lazy(() => import('./pages/QuizPage').then(module => ({ default: module.QuizPage })));
const PublicQuizPage = React.lazy(() => import('./pages/PublicQuizPage').then(module => ({ default: module.PublicQuizPage })));
const FlashcardPage = React.lazy(() => import('./pages/FlashcardPage').then(module => ({ default: module.FlashcardPage })));
const SharedFlashcardsPage = React.lazy(() => import('./pages/SharedFlashcardsPage').then(module => ({ default: module.SharedFlashcardsPage })));
const ChatPage = React.lazy(() => import('./pages/ChatPage').then(module => ({ default: module.ChatPage })));
const ReaderPage = React.lazy(() => import('./pages/ReaderPage').then(module => ({ default: module.ReaderPage })));
const CoReaderPage = React.lazy(() => import('./pages/CoReaderPage').then(module => ({ default: module.CoReaderPage })));
const CoReaderLibraryPage = React.lazy(() => import('./pages/CoReaderLibraryPage').then(module => ({ default: module.CoReaderLibraryPage })));
const AdminPage = React.lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })));
const LeaderboardPage = React.lazy(() => import('./pages/LeaderboardPage').then(module => ({ default: module.LeaderboardPage })));
const CalculatorPage = React.lazy(() => import('./pages/CalculatorPage').then(module => ({ default: module.CalculatorPage })));
const NotificationPage = React.lazy(() => import('./pages/NotificationPage').then(module => ({ default: module.NotificationPage })));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage').then(module => ({ default: module.ProfilePage })));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })));
const XpHistoryPage = React.lazy(() => import('./pages/XpHistoryPage').then(module => ({ default: module.XpHistoryPage })));

import { AppEntryAward } from './components/AppEntryAward';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  const { user, token } = useAuthStore();
  const { swReady, updateAvailable, updateApp } = useServiceWorker();
  const { startTour } = useTour(); // Initialize tour hook for new users

  // Initialize IndexedDB on app startup
  useEffect(() => {
    const initDB = async () => {
      try {
        await openDB();
        console.log('IndexedDB initialized successfully');
      } catch (error) {
        console.error('Failed to initialize IndexedDB:', error);
      }
    };
    initDB();
  }, []);

  // Auto-sync when online
  useSyncListener(async () => {
    if (token) {
      await fullSync(token);
    }
  });

  // Show update prompt
  useEffect(() => {
    if (updateAvailable) {
      const shouldUpdate = window.confirm(
        'A new version of iSchkul is available. Update now?'
      );
      if (shouldUpdate) {
        updateApp();
      }
    }
  }, [updateAvailable, updateApp]);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="app-container">
        <AppEntryAward />
        <Suspense fallback={<PageLoader />}>
          <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quiz"
            element={
              <ProtectedRoute>
                <QuizPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/flashcards"
            element={
              <ProtectedRoute>
                <FlashcardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <LeaderboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calculator"
            element={
              <ProtectedRoute>
                <CalculatorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notification"
            element={
              <ProtectedRoute>
                <NotificationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reader"
            element={
              <ProtectedRoute>
                <ReaderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/co-reader"
            element={
              <ProtectedRoute>
                <CoReaderLibraryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/co-reader/:id"
            element={
              <ProtectedRoute>
                <CoReaderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/xp-history"
            element={
              <ProtectedRoute>
                <XpHistoryPage />
              </ProtectedRoute>
            }
          />

          {/* Public Routes (no auth required) */}
          <Route path="/shared-flashcards/:shareCode" element={<SharedFlashcardsPage />} />
          <Route path="/quiz/:id" element={<PublicQuizPage />} />

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </div>
    </Router>
  );
}

export default App;
