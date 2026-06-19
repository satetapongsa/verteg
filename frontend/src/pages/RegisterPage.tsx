import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    if (password.length < 8) {
      return setError('Password must be at least 8 characters');
    }

    setLoading(true);

    try {
      await register(email, password);
      // Success, route to login page
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#0A0E17] min-h-[85vh] flex items-center justify-center px-4">
      <div className="bg-[#111827] border border-gray-800 p-8 rounded-lg max-w-md w-full shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <UserPlus className="text-[#22C55E] w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-white">Create Verteg Account</h2>
          <p className="text-sm text-gray-400">Generate secure multi-network keys on submission</p>
        </div>

        {error && (
          <div className="bg-[#EF4444]/10 border border-[#EF4444] text-[#EF4444] px-4 py-3 rounded text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@email.com"
                className="w-full bg-[#1F2937] border border-gray-700 rounded pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full bg-[#1F2937] border border-gray-700 rounded pl-10 pr-10 py-2.5 text-white text-sm focus:outline-none focus:border-[#2563EB]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-300 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full bg-[#1F2937] border border-gray-700 rounded pl-10 pr-10 py-2.5 text-white text-sm focus:outline-none focus:border-[#2563EB]"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-300 focus:outline-none"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#22C55E] hover:bg-green-700 text-white font-semibold py-2.5 rounded text-sm transition-all flex items-center justify-center"
          >
            {loading ? 'Generating digital keychains...' : 'Register Secure Account'}
          </button>
        </form>

        <div className="text-center text-xs text-gray-400">
          Already registered? <Link to="/login" className="text-[#2563EB] hover:underline font-semibold">Log in</Link>
        </div>
      </div>
    </div>
  );
};
