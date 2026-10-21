
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ChevronDown,
  Eye,
  EyeOff,
  LogIn,
  User,
  ScanSearch,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export default function Login() {
  const [role, setRole] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Demo credentials for quick evaluation
  const roleDefaults = {
    inspector: {
      username: 'inspector',
      password: 'inspector123',
    },
    supervisor: {
      username: 'supervisor',
      password: 'supervisor123',
    },
    manager: {
      username: 'manager',
      password: 'manager123',
    },
  };

  const handleRoleChange = (selectedRole) => {
    setRole(selectedRole);

    if (roleDefaults[selectedRole]) {
      setUsername(roleDefaults[selectedRole].username);
      setPassword(roleDefaults[selectedRole].password);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const finalUsername = username.trim() || 'inspector';
    const finalPassword = password.trim() || 'inspector123';

    setLoading(true);

    try {
      await login(finalUsername, finalPassword);
      navigate('/');
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Invalid username or password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#e5e3df] flex items-center justify-center p-4 sm:p-8 lg:p-12 relative overflow-hidden font-sans antialiased selection:bg-[#fe4805] selection:text-white">

      {/* Ambient background */}
      <div className="absolute -top-36 left-1/3 w-[600px] h-[450px] bg-[#9e7663]/25 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-36 right-1/4 w-[500px] h-[400px] bg-[#8a726a]/20 rounded-full blur-[110px] pointer-events-none" />

      {/* Main login card */}
      <div className="w-full max-w-[1040px] bg-[#28211f] rounded-[30px] sm:rounded-[42px] shadow-2xl shadow-black/30 overflow-hidden flex flex-col lg:flex-row relative z-10 border border-neutral-400/30">

        {/* LEFT PANEL: Traceon tile inspection branding */}
        <section className="w-full lg:w-[48%] bg-[#28211f] p-7 sm:p-10 lg:p-12 flex flex-col relative overflow-hidden min-h-[620px] lg:min-h-[640px]">

          {/* Decorative background circles */}
          <div className="absolute top-[30%] left-[24%] -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full border border-white/[0.05] pointer-events-none" />
          <div className="absolute top-[30%] left-[24%] -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full border border-white/[0.035] pointer-events-none" />

          {/* Top tagline */}
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <ScanSearch className="w-4 h-4 text-orange-500" />
              <span>AI-powered tile quality inspection</span>
            </div>
          </div>

          {/* Main headline */}
          <div className="relative z-10 mt-14 lg:mt-20">
            <p className="text-xs uppercase tracking-[0.24em] text-orange-400 mb-4">
              Inspect. Detect. Improve.
            </p>

            <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-bold text-white tracking-tight leading-[1.08]">
              Smarter Tile
              <br />
              Inspection.
              <br />
              Better Quality.
            </h1>

            <p className="mt-5 max-w-sm text-sm sm:text-base leading-7 text-neutral-400">
              Detect tile defects, review AI predictions, and
              track corrective actions with traceable quality
              decisions for every production batch.
            </p>
          </div>

          {/* Tile inspection illustration - no external image required */}
          <div className="relative z-10 mt-auto pt-10">

            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                Visual inspection
              </span>

              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Quality workflow
              </span>
            </div>

            {/* Three tile samples */}
            <div className="grid grid-cols-3 gap-3">

              {/* Good tile */}
              <div className="relative aspect-square overflow-hidden rounded-lg border border-white/15 bg-gradient-to-br from-stone-200 via-stone-400 to-stone-500 shadow-lg">
                <div className="absolute inset-2 border border-white/30 rounded-sm" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />

                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1 rounded bg-emerald-950/85 px-1 py-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                  <span className="text-[9px] font-bold tracking-wide text-white">
                    GOOD
                  </span>
                </div>
              </div>

              {/* Cracked tile */}
              <div className="relative aspect-square overflow-hidden rounded-lg border border-red-400/50 bg-gradient-to-br from-stone-300 via-stone-400 to-stone-600 shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />

                <svg
                  viewBox="0 0 100 100"
                  className="absolute inset-0 w-full h-full"
                  aria-hidden="true"
                >
                  <path
                    d="M52 0 L46 17 L57 29 L44 43 L51 56 L37 72 L42 86 L30 100"
                    fill="none"
                    stroke="#47332c"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M46 17 L29 23 M57 29 L72 23 M44 43 L26 48 M51 56 L69 63 M37 72 L20 78"
                    fill="none"
                    stroke="#47332c"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="57"
                    cy="29"
                    r="15"
                    fill="none"
                    stroke="#fb6245"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                </svg>

                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1 rounded bg-red-950/90 px-1 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span className="text-[9px] font-bold tracking-wide text-white">
                    CRACK
                  </span>
                </div>
              </div>

              {/* Tile under review */}
              <div className="relative aspect-square overflow-hidden rounded-lg border border-orange-400/50 bg-gradient-to-br from-stone-300 via-stone-400 to-neutral-600 shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                <div className="absolute inset-3 border border-dashed border-orange-300/90 rounded-sm" />

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 border-orange-400/90 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-orange-400" />
                </div>

                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1 rounded bg-orange-950/90 px-1 py-1.5">
                  <ScanSearch className="w-3 h-3 text-orange-300" />
                  <span className="text-[9px] font-bold tracking-wide text-white">
                    REVIEW
                  </span>
                </div>
              </div>

            </div>

            {/* Inspection workflow strip */}
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-3.5">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-400/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-orange-400" />
              </div>

              <div>
                <p className="text-sm font-semibold text-white">
                  Traceable quality decisions
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  AI assistance with human verification
                </p>
              </div>
            </div>

          </div>

          {/* Bottom branding */}
          <div className="relative z-10 flex justify-between items-center mt-5">
            <span className="text-[10px] tracking-wide text-neutral-500">
              TRACEON · TILE QUALITY SYSTEM
            </span>

            <div className="w-6 h-6 rounded-full border border-orange-500/70 text-orange-400 flex items-center justify-center text-xs font-bold">
              T
            </div>
          </div>
        </section>

        {/* RIGHT PANEL: Sign-in form */}
        <section className="w-full lg:w-[52%] bg-white rounded-t-[30px] lg:rounded-t-none lg:rounded-l-[42px] p-7 sm:p-10 lg:p-14 flex flex-col justify-between min-h-[590px] lg:min-h-[640px]">

          {/* Brand header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full p-[2px] bg-gradient-to-tr from-[#fe4805] via-[#ff9800] to-[#fe3a6b] flex items-center justify-center shrink-0">
                <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                  <span className="text-[11px] font-black text-[#fe4805]">
                    T
                  </span>
                </div>
              </div>

              <span className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                Traceon
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
              <User className="w-4 h-4" />
              <span>Team Access</span>
            </div>
          </div>

          {/* Form */}
          <div className="my-auto py-8 max-w-[380px] w-full mx-auto">

            <p className="text-xs uppercase tracking-[0.2em] text-orange-600 mb-3">
              Secure workspace
            </p>

            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-3">
              Sign In
            </h2>

            <p className="text-sm text-neutral-500 mb-7">
              Access your inspections, batches, and quality reports.
            </p>

            {error && (
              <div
                role="alert"
                className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  className="block text-xs font-medium text-neutral-600 mb-1.5 ml-1"
                >
                  Username
                </label>

                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full px-5 py-3.5 rounded-full border border-neutral-300 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition shadow-sm bg-white"
                />
              </div>

              {/* Role selector */}
              <div>
                <label
                  htmlFor="role"
                  className="block text-xs font-medium text-neutral-600 mb-1.5 ml-1"
                >
                  Select your role
                </label>

                <div className="relative">
                  <select
                    id="role"
                    name="role"
                    required
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full px-5 py-3.5 pr-10 rounded-full border border-neutral-300 text-sm text-neutral-700 bg-white focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition shadow-sm appearance-none cursor-pointer"
                  >
                    <option value="" disabled>
                      Select Inspector, Supervisor, or Manager
                    </option>
                    <option value="inspector">Inspector</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="manager">Manager</option>
                  </select>

                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-5 text-neutral-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-neutral-600 mb-1.5 ml-1"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-5 py-3.5 pr-12 rounded-full border border-neutral-300 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition shadow-sm bg-white"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-neutral-700 transition"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Forgot password information */}
              <div className="text-left pt-0.5">
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      'For this demo, select a role to fill the demo credentials. For production password recovery, configure a secure recovery workflow.'
                    )
                  }
                  className="text-xs font-semibold text-[#fe4805] hover:text-[#d83c02] transition"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background:
                      'linear-gradient(90deg, #fe4805 0%, #fe3a6b 100%)',
                  }}
                  className="w-full py-3.5 px-6 rounded-full text-white font-semibold text-sm sm:text-base shadow-md shadow-orange-500/25 hover:opacity-95 transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{loading ? 'Signing in...' : 'Sign In'}</span>

                  {!loading && <LogIn className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 border-t border-neutral-100 text-[11px] text-neutral-400">
            <span>© 2026 Traceon · Tile Quality Inspection</span>

            <div className="flex items-center gap-2 text-neutral-500">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Quality workflow access</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
