import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Mail, Lock } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password, show2FA ? twoFactorCode : undefined);
      if (result.twoFactorRequired) {
        setShow2FA(true);
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to authenticate user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#0A0E17] min-h-[85vh] flex items-center justify-center px-4">
      <div className="bg-[#111827] border border-gray-800 p-8 rounded-lg max-w-md w-full shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <ShieldCheck className="text-[#2563EB] w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-white">Login to Verteg</h2>
          <p className="text-sm text-gray-400">Enter credentials to access secure terminal</p>
        </div>

        {error && (
          <div className="bg-[#EF4444]/10 border border-[#EF4444] text-[#EF4444] px-4 py-3 rounded text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!show2FA ? (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
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
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#1F2937] border border-gray-700 rounded pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Google 2FA Code</label>
              <input
                type="text"
                required
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder="6-Digit Verification Code"
                maxLength={6}
                className="w-full bg-[#1F2937] border border-gray-700 rounded px-4 py-2.5 text-white text-sm font-mono tracking-widest text-center focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2563EB] hover:bg-blue-700 text-white font-semibold py-2.5 rounded text-sm transition-all flex items-center justify-center"
          >
            {loading ? 'Processing authentication...' : show2FA ? 'Verify 2FA' : 'Authorize Security Session'}
          </button>
        </form>

        <div className="text-center text-xs text-gray-400">
          New user? <Link to="/register" className="text-[#2563EB] hover:underline font-semibold">Create account</Link>
        </div>
      </div>
    </div>
  );
};
