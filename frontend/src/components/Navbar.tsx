import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, setSelectedPair } from '../store';
import { Wallet, Settings, LayoutDashboard, LogOut, TrendingUp, ShieldAlert, User } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const selectedPair = useSelector((state: RootState) => state.ui.selectedPair);

  const handlePairChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(setSelectedPair(e.target.value));
  };

  return (
    <nav className="bg-[#0A0E17] border-b border-gray-900 px-8 py-4 flex items-center justify-between text-gray-300">
      <div className="flex items-center space-x-12">
        <Link to="/" className="flex items-center space-x-2.5">
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="12" r="6" stroke="#2563EB" />
            <circle cx="15" cy="12" r="4" stroke="#38BDF8" strokeWidth="2" />
          </svg>
          <span className="text-lg font-black tracking-wider text-white">VERTEX <span className="text-[#38BDF8] font-bold text-[11px] tracking-normal ml-0.5">PRO</span></span>
        </Link>

        {user && (
          <div className="hidden md:flex items-center space-x-8 text-sm font-semibold text-gray-400">
            <Link to="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link to="/trade" className="hover:text-white transition-colors">
              Trade
            </Link>
            <Link to="/wallet" className="hover:text-white transition-colors">
              Wallet
            </Link>
            <Link to="/portfolio" className="hover:text-white transition-colors">
              Portfolio
            </Link>
            {user.role === 'ADMIN' && (
              <Link to="/admin" className="text-[#EF4444] hover:text-red-400 font-bold transition-colors">
                Admin Panel
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
            className="bg-[#111827] border border-gray-800 rounded px-2.5 py-1 text-xs font-semibold text-white focus:outline-none focus:border-[#2563EB]"
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
            <button 
              onClick={() => navigate('/settings')} 
              className="text-gray-400 hover:text-white transition-colors p-1"
            >
              <Settings className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2 bg-[#111827] border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 font-mono">
              <User className="w-3.5 h-3.5 text-gray-500" />
              <span>{user.email}</span>
            </div>
            <button 
              onClick={() => { logout(); navigate('/'); }}
              className="border border-red-950 bg-red-950/20 text-red-400 hover:bg-red-900/30 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <div className="space-x-3">
            <Link to="/login" className="text-sm font-semibold px-3 py-2 hover:text-[#2563EB] transition-colors">Login</Link>
            <Link to="/register" className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-md">Sign Up</Link>
          </div>
        )}
      </div>
    </nav>
  );
};
