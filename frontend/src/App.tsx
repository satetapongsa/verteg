import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from './store';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { Navbar } from './components/Navbar';

// Page imports
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { TradingPage } from './pages/TradingPage';
import { WalletPage } from './pages/WalletPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

const queryClient = new QueryClient();

// Route Protection HOC
const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ children, adminOnly }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Restoring platform session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <AuthProvider>
          <WebSocketProvider>
            <Router>
              <div className="bg-[#0A0E17] min-h-screen text-gray-100 flex flex-col">
                <Navbar />
                <main className="flex-1">
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />

                    {/* Private Routes */}
                    <Route path="/dashboard" element={
                      <ProtectedRoute>
                        <DashboardPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/trade" element={
                      <ProtectedRoute>
                        <TradingPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/wallet" element={
                      <ProtectedRoute>
                        <WalletPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/portfolio" element={
                      <ProtectedRoute>
                        <PortfolioPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/settings" element={
                      <ProtectedRoute>
                        <SettingsPage />
                      </ProtectedRoute>
                    } />

                    {/* Admin Routes */}
                    <Route path="/admin" element={
                      <ProtectedRoute adminOnly>
                        <AdminDashboardPage />
                      </ProtectedRoute>
                    } />

                    {/* Catch all redirect */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </div>
            </Router>
          </WebSocketProvider>
        </AuthProvider>
      </Provider>
    </QueryClientProvider>
  );
};
export default App;
