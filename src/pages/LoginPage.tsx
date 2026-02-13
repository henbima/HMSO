import { useState } from 'react';
import { Activity, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const { signIn, unauthorized } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error);
    }
    // Don't navigate — AuthContext handles redirect via session state

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-600 rounded-xl mb-4">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">HollyMart WA Intel</h1>
          <p className="text-sm text-gray-500 mt-1">WhatsApp Intelligence Dashboard</p>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6">
          {unauthorized && (
            <div className="flex items-start gap-2.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-5">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Access denied. This app is restricted to authorized users only.</span>
            </div>
          )}

          <h2 className="text-base font-medium text-gray-900 mb-5">Sign in</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                placeholder="you@hokkymart.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  className="w-full px-3 py-2 border rounded-lg text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign In
            </button>
          </form>

          <p className="mt-5 text-xs text-gray-400 text-center">
            Private app — authorized access only
          </p>
        </div>
      </div>
    </div>
  );
}
