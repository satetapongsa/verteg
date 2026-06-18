import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Mail, Lock, AlertTriangle } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { registerUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!agreeTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy');
      return;
    }

    setLoading(true);
    try {
      await registerUser(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md bg-card border border-darkGray p-8 rounded-xl shadow-2xl relative">
        <div className="flex flex-col items-center space-y-2 mb-8">
          <div className="bg-blue-950/40 p-3 rounded-full border border-blue-900/40 text-accentBlue mb-2">
            <ShieldCheck className="h-6 w-6 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Create Account</h2>
          <p className="text-textMuted text-sm text-center">Get started on the Vertex trading platform today.</p>
        </div>

        {error && (
          <div className="mb-6 flex items-center space-x-2 bg-red-950/30 border border-red-900/60 text-red-400 p-3.5 rounded-lg text-sm">
            <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="text-xs font-semibold text-textMuted uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-4.5 w-4.5 text-textMuted" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border border-darkGray focus:border-accentBlue py-3 pl-10 pr-4 rounded-lg text-sm outline-none transition-colors"
                placeholder="Min. 8 characters"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-textMuted uppercase tracking-wider">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-4.5 w-4.5 text-textMuted" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-background border border-darkGray focus:border-accentBlue py-3 pl-10 pr-4 rounded-lg text-sm outline-none transition-colors"
                placeholder="Confirm password"
              />
            </div>
          </div>

          <div className="flex items-start space-x-2 pt-2 pb-1">
            <input
              type="checkbox"
              id="terms"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-1 h-4 w-4 bg-background border border-darkGray rounded accent-accentBlue outline-none cursor-pointer"
            />
            <label htmlFor="terms" className="text-xs text-textMuted leading-tight cursor-pointer">
              I agree to the <a href="#" className="text-accentBlue hover:underline">Terms of Service</a> and{' '}
              <a href="#" className="text-accentBlue hover:underline">Privacy Policy</a>.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accentBlue hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-3 rounded-lg shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center justify-center space-x-2 transition-all"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span>Create Account</span>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-textMuted">
          <span>Already have an account? </span>
          <Link to="/login" className="text-accentBlue hover:underline">
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
};
