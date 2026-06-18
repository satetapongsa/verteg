import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Mail, Lock, KeyRound, AlertTriangle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [is2faRequired, setIs2faRequired] = useState(false);

  // Google authentication states
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const { login, loginWithGoogle } = useAuth();

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

  const handleGoogleLogin = async (gmail: string) => {
    if (!gmail.includes('@')) {
      setGoogleError('Please enter a valid email address');
      return;
    }
    setGoogleError(null);
    setGoogleLoading(true);

    try {
      // Simulate Google OAuth handshake delay
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await loginWithGoogle(gmail);
      setShowGoogleModal(false);
      navigate('/dashboard');
    } catch (err: any) {
      setGoogleError(err.message || 'Google authentication failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-6 py-12 selection:bg-blue-600/30 selection:text-white">
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
          <>
            <div className="flex items-center my-6">
              <div className="flex-grow border-t border-darkGray"></div>
              <span className="mx-4 text-xs font-bold text-textMuted uppercase tracking-wider">or</span>
              <div className="flex-grow border-t border-darkGray"></div>
            </div>

            <button
              type="button"
              onClick={() => setShowGoogleModal(true)}
              className="w-full bg-[#111622] hover:bg-[#1C2436] text-white border border-darkGray hover:border-textMuted font-bold py-3 rounded-lg flex items-center justify-center space-x-3 transition-all transform hover:-translate-y-0.5 shadow-md"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" width="100%" height="100%">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-.1.14-.14 3.08l2.92 2.26c1.7-1.57 2.27-3.9 2.27-7.19z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96L1.29 17.3c2.06 4.09 6.25 6.7 10.71 6.7z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.29 6.7C.47 8.35 0 10.12 0 12s.47 3.65 1.29 5.3l3.98-3.01z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.54 0 3.35 2.61 1.29 6.7l3.98 3.01c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </>
        )}

        {!is2faRequired && (
          <div className="mt-8 text-center text-sm text-textMuted">
            <span>Don't have an account? </span>
            <Link to="/register" className="text-accentBlue hover:underline">
              Create an account
            </Link>
          </div>
        )}
      </div>

      {/* Simulated Google Accounts Selector Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm bg-[#111622] border border-[#1F293D] rounded-2xl p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex flex-col items-center text-center space-y-2">
              <svg className="h-9 w-9" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-.1.14-.14 3.08l2.92 2.26c1.7-1.57 2.27-3.9 2.27-7.19z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96L1.29 17.3c2.06 4.09 6.25 6.7 10.71 6.7z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.29 6.7C.47 8.35 0 10.12 0 12s.47 3.65 1.29 5.3l3.98-3.01z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.54 0 3.35 2.61 1.29 6.7l3.98 3.01c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              <h3 className="text-lg font-bold text-white mt-1">Sign in with Google</h3>
              <p className="text-textMuted text-xs">Choose an account to continue to Vertex Pro</p>
            </div>

            {/* Google Accounts List */}
            <div className="space-y-2">
              {[
                { email: 'admin@gmail.com', name: 'Admin Account', avatar: 'AD' },
                { email: 'user@exchange.com', name: 'Default User', avatar: 'US' },
              ].map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleGoogleLogin(acc.email)}
                  disabled={googleLoading}
                  className="w-full bg-[#171E2E] hover:bg-[#2563EB]/15 border border-[#1F293D] hover:border-accentBlue p-3 rounded-xl flex items-center space-x-3 text-left transition-all group disabled:opacity-50"
                >
                  <div className="w-8 h-8 bg-blue-950/60 rounded-full border border-blue-900/40 text-[10px] font-black text-accentBlue flex items-center justify-center shrink-0">
                    {acc.avatar}
                  </div>
                  <div className="flex-grow min-w-0">
                    <span className="text-white text-xs font-bold block group-hover:text-accentBlue transition-colors leading-none truncate">{acc.name}</span>
                    <span className="text-textMuted text-[10px] mt-0.5 block truncate">{acc.email}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="flex items-center">
              <div className="flex-grow border-t border-[#1F293D]"></div>
              <span className="mx-3 text-[10px] font-bold text-textMuted uppercase tracking-wider shrink-0">or use custom email</span>
              <div className="flex-grow border-t border-[#1F293D]"></div>
            </div>

            {/* Custom Google Email Form */}
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Enter any gmail address..."
                value={customGoogleEmail}
                onChange={(e) => setCustomGoogleEmail(e.target.value)}
                disabled={googleLoading}
                className="w-full bg-background border border-[#1F293D] focus:border-accentBlue p-3 rounded-lg text-xs outline-none text-white font-semibold"
              />
              <button
                type="button"
                onClick={() => handleGoogleLogin(customGoogleEmail)}
                disabled={googleLoading || !customGoogleEmail.includes('@')}
                className="w-full bg-accentBlue hover:bg-blue-700 disabled:bg-blue-800 text-white font-bold py-2.5 rounded-lg text-xs transition-all shadow"
              >
                {googleLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                ) : (
                  <span>Sign in with Google API</span>
                )}
              </button>
            </div>

            {googleError && (
              <div className="text-[10px] font-bold text-errorRed text-center">{googleError}</div>
            )}

            {/* Modal Footer */}
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setShowGoogleModal(false);
                  setGoogleError(null);
                }}
                disabled={googleLoading}
                className="text-textMuted hover:text-white text-xs font-bold uppercase transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
