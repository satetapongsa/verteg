import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, setSelectedPair } from '../store';
import { Wallet, Settings, LayoutDashboard, LogOut, TrendingUp, ShieldAlert } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const selectedPair = useSelector((state: RootState) => state.ui.selectedPair);

  const handlePairChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(setSelectedPair(e.target.value));
  };

  return (
    <nav className="bg-[#111827] border-b border-gray-800 px-6 py-4 flex items-center justify-between text-gray-100">
      <div className="flex items-center space-x-8">
        <Link to="/" className="flex items-center space-x-2">
          <TrendingUp className="text-[#2563EB] w-8 h-8" />
          <span className="text-xl font-bold tracking-wider text-white">Verteg</span>
        </Link>

        {user && (
          <div className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <Link to="/dashboard" className="hover:text-[#2563EB] flex items-center space-x-1">
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
            <Link to="/trade" className="hover:text-[#2563EB] flex items-center space-x-1">
              <TrendingUp className="w-4 h-4" />
              <span>Trade</span>
            </Link>
            <Link to="/wallet" className="hover:text-[#2563EB] flex items-center space-x-1">
              <Wallet className="w-4 h-4" />
              <span>Wallet</span>
            </Link>
            <Link to="/portfolio" className="hover:text-[#2563EB]">Portfolio</Link>
            <Link to="/settings" className="hover:text-[#2563EB] flex items-center space-x-1">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </Link>
            {user.role === 'ADMIN' && (
              <Link to="/admin" className="text-[#EF4444] hover:text-red-400 flex items-center space-x-1">
                <ShieldAlert className="w-4 h-4" />
                <span>Admin Panel</span>
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4">
        {/* Pair selector shown globally if logged in */}
        {user && (
          <select 
            value={selectedPair} 
            onChange={handlePairChange}
            className="bg-[#1F2937] border border-gray-700 rounded px-2 py-1 text-sm font-semibold text-white focus:outline-none focus:border-[#2563EB]"
          >
            <option value="BTC_USDT">BTC/USDT</option>
            <option value="ETH_USDT">ETH/USDT</option>
            <option value="BNB_USDT">BNB/USDT</option>
            <option value="SOL_USDT">SOL/USDT</option>
            <option value="XRP_USDT">XRP/USDT</option>
          </select>
        )}

        {user ? (
          <div className="flex items-center space-x-4">
            <span className="text-xs text-gray-400 hidden sm:inline">{user.email}</span>
            <button 
              onClick={() => { logout(); navigate('/'); }}
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded text-sm font-medium flex items-center space-x-1"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        ) : (
          <div className="space-x-2">
            <Link to="/login" className="text-sm font-semibold px-4 py-2 hover:text-[#2563EB]">Login</Link>
            <Link to="/register" className="bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded transition-all">Sign Up</Link>
          </div>
        )}
      </div>
    </nav>
  );
};
