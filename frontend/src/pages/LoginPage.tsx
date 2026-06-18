import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Mail, Lock, KeyRound, AlertTriangle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [is2faRequired, setIs2faRequired] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login(email, password, is2faRequired ? code : undefined);
      if (result.twoFactorRequired) {
        setIs2faRequired(true);
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md bg-card border border-darkGray p-8 rounded-xl shadow-2xl relative">
        <div className="flex flex-col items-center space-y-2 mb-8">
          <div className="bg-blue-950/40 p-3 rounded-full border border-blue-900/40 text-accentBlue mb-2">
            {is2faRequired ? <KeyRound className="h-6 w-6" /> : <Shield className="h-6 w-6 animate-pulse" />}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {is2faRequired ? 'Security Verification' : 'Welcome Back'}
          </h2>
          <p className="text-textMuted text-sm text-center">
            {is2faRequired 
              ? 'Enter the 6-digit code from your authenticator app.' 
              : 'Log in to access your Vertex trading account.'
            }
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center space-x-2 bg-red-950/30 border border-red-900/60 text-red-400 p-3.5 rounded-lg text-sm">
            <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!is2faRequired ? (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-textMuted uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 h-4.5 w-4.5 text-textMuted" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background border border-darkGray focus:border-accentBlue py-3 pl-10 pr-4 rounded-lg text-sm outline-none transition-colors"
                    placeholder="name@email.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-textMuted uppercase tracking-wider">Password</label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 h-4.5 w-4.5 text-textMuted" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-background border border-darkGray focus:border-accentBlue py-3 pl-10 pr-4 rounded-lg text-sm outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-textMuted uppercase tracking-wider">2FA Token Code</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3.5 h-4.5 w-4.5 text-textMuted" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-background border border-darkGray focus:border-accentBlue py-3 pl-10 pr-4 rounded-lg text-sm outline-none tracking-widest text-center font-bold text-lg transition-colors"
                  placeholder="000000"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accentBlue hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-3 rounded-lg shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center justify-center space-x-2 transition-all"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span>{is2faRequired ? 'Verify & Login' : 'Login'}</span>
            )}
          </button>
        </form>

        {!is2faRequired && (
          <div className="mt-8 text-center text-sm text-textMuted">
            <span>Don't have an account? </span>
            <Link to="/register" className="text-accentBlue hover:underline">
              Create an account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
