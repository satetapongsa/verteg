import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Coins, LogOut, Settings, Wallet, User, BarChart2, Shield } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-card border-b border-darkGray px-6 py-4 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2 text-xl font-bold tracking-wider text-accentBlue">
          <Coins className="h-8 w-8 animate-pulse text-accentBlue" />
          <span className="text-white">VERTEX</span>
          <span className="text-accentBlue font-light text-sm">PRO</span>
        </Link>

        {/* Navigation Tabs */}
        {user && (
          <div className="hidden md:flex space-x-1 font-medium text-sm">
            <Link
              to="/dashboard"
              className={`px-4 py-2 rounded-lg transition-colors ${
                isActive('/dashboard') ? 'bg-darkGray text-white' : 'text-textMuted hover:text-white'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/trading"
              className={`px-4 py-2 rounded-lg transition-colors ${
                isActive('/trading') ? 'bg-darkGray text-white' : 'text-textMuted hover:text-white'
              }`}
            >
              Trade
            </Link>
            <Link
              to="/wallet"
              className={`px-4 py-2 rounded-lg transition-colors ${
                isActive('/wallet') ? 'bg-darkGray text-white' : 'text-textMuted hover:text-white'
              }`}
            >
              Wallet
            </Link>
            <Link
              to="/portfolio"
              className={`px-4 py-2 rounded-lg transition-colors ${
                isActive('/portfolio') ? 'bg-darkGray text-white' : 'text-textMuted hover:text-white'
              }`}
            >
              Portfolio
            </Link>
            {user.role === 'ADMIN' && (
              <Link
                to="/admin"
                className={`px-4 py-2 rounded-lg text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 ${
                  isActive('/admin') ? 'bg-red-950/30 text-white' : ''
                }`}
              >
                <Shield className="h-4 w-4" /> Admin Panel
              </Link>
            )}
          </div>
        )}

        {/* User Actions */}
        <div className="flex items-center space-x-4">
          {user ? (
            <div className="flex items-center space-x-3">
              <Link
                to="/settings"
                className="p-2 hover:bg-darkGray rounded-full text-textMuted hover:text-white transition-colors"
                title="Security Settings"
              >
                <Settings className="h-5 w-5" />
              </Link>
              <div className="flex items-center space-x-2 bg-darkGray py-1.5 px-3 rounded-lg border border-gray-700">
                <User className="h-4 w-4 text-accentBlue" />
                <span className="text-sm font-medium hidden sm:inline">{user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1.5 px-3 py-2 text-sm bg-red-950/20 hover:bg-red-900/40 border border-red-900/60 text-red-400 rounded-lg transition-all"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-medium text-textMuted hover:text-white transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 text-sm font-medium bg-accentBlue hover:bg-blue-700 text-white rounded-lg shadow-lg shadow-blue-500/20 transition-all"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
