import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChevronDown, Eye, EyeOff, LogIn, User } from 'lucide-react';
import phoneMockup from '../assets/phone_mockup.png';

export default function Login() {
  const [role, setRole] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Role credentials map for quick evaluation
  const roleDefaults = {
    inspector: { username: 'inspector', password: 'inspector123' },
    supervisor: { username: 'supervisor', password: 'supervisor123' },
    manager: { username: 'manager', password: 'manager123' },
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

    // Fallback if user hasn't selected a role or username
    const finalUsername = username.trim() || 'inspector';
    const finalPassword = password.trim() || 'inspector123';

    setLoading(true);
    try {
      await login(finalUsername, finalPassword);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#dfdeda] flex items-center justify-center p-4 sm:p-8 lg:p-12 relative overflow-hidden font-sans antialiased selection:bg-[#fe4805] selection:text-white">

      {/* Soft Blurred Glow Ambient Background */}
      <div className="absolute -top-36 left-1/3 w-[600px] h-[450px] bg-[#9e7663]/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-36 right-1/4 w-[500px] h-[400px] bg-[#8a726a]/25 rounded-full blur-[110px] pointer-events-none" />

      {/* Main Split-Screen Container */}
      <div className="w-full max-w-[1040px] bg-[#28211f] rounded-[36px] sm:rounded-[44px] shadow-2xl shadow-black/35 overflow-hidden flex flex-col lg:flex-row relative z-10 border border-neutral-400/20">

        {/* ======================================================== */}
        {/* LEFT PANEL (Brand Side - Dark Charcoal/Espresso)        */}
        {/* ======================================================== */}
        <div className="w-full lg:w-[48%] bg-[#28211f] p-8 sm:p-10 lg:p-12 flex flex-col justify-between relative overflow-hidden min-h-[460px] lg:min-h-[640px]">

          {/* Subtle Concentric Wireframe Circles Background */}
          <div className="absolute top-[28%] left-[25%] -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full border border-white/[0.04] pointer-events-none" />
          <div className="absolute top-[28%] left-[25%] -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full border border-white/[0.03] pointer-events-none" />

          {/* Top Subtle Text */}
          <div className="relative z-10">
            <p className="text-[11px] sm:text-xs text-neutral-400/90 font-normal tracking-tight">
              Global payments made simple â€“ online payment solutions for you.
            </p>
          </div>

          {/* Main Huge Bold Title */}
          <div className="my-auto py-8 relative z-10">
            <h2 className="text-4xl sm:text-5xl lg:text-[54px] font-bold text-white tracking-tight leading-[1.06]">
              Traceon -<br />
              Streamlined<br />
              Workflow
            </h2>
          </div>

          {/* Bottom Visual: Hand Holding Smartphone with Analytics */}
          <div className="absolute bottom-0 left-0 z-0 pointer-events-none select-none">
            <img
              src={phoneMockup}
              alt="Traceon Mobile Workflow"
              className="w-[280px] sm:w-[320px] lg:w-[350px] object-contain drop-shadow-2xl"
            />
          </div>

          {/* Bottom Right Accessibility Icon (From Reference) */}
          <div className="relative z-10 flex justify-end">
            <div className="w-6 h-6 rounded-full border border-[#fe4805]/80 text-[#fe4805] flex items-center justify-center text-[10px] cursor-pointer hover:bg-[#fe4805]/10 transition">
              <span className="font-bold">â“˜</span>
            </div>
          </div>

        </div>

        {/* ======================================================== */}
        {/* RIGHT PANEL (Form Side - Pure White with Rounded Left)    */}
        {/* ======================================================== */}
        <div className="w-full lg:w-[52%] bg-white rounded-t-[36px] lg:rounded-t-none lg:rounded-l-[44px] p-8 sm:p-10 lg:p-14 flex flex-col justify-between min-h-[560px] lg:min-h-[640px]">

          {/* Top Row: Brand Logo + Sign Up Link */}
          <div className="flex items-center justify-between">
            {/* Circular Spectrum Logo + "Traceon" Name */}
            <div className="flex items-center space-x-2.5">
              <div className="relative w-6 h-6 flex items-center justify-center flex-shrink-0">
                <div className="w-6 h-6 rounded-full p-[2.5px] bg-gradient-to-tr from-[#fe4805] via-[#ff9800] via-[#4caf50] via-[#2196f3] to-[#e91e63] shadow-sm flex items-center justify-center">
                  <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                    <span className="text-[10px] font-black text-[#fe4805] leading-none -mt-0.5">T</span>
                  </div>
                </div>
              </div>
              <span className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                Traceon
              </span>
            </div>

            {/* Top Right "Sign Up" Link */}
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-neutral-700 hover:text-neutral-900 cursor-pointer transition">
              <User className="w-4 h-4 text-neutral-600" />
              <span>Sign Up</span>
            </div>
          </div>

          {/* Main Form Section */}
          <div className="my-auto py-6 sm:py-8 max-w-[380px] w-full mx-auto">

            <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight mb-8 text-left">
              Sign In
            </h1>

            {error && (
              <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5 text-left">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Input 1: Username */}
              <div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full px-5 py-3.5 rounded-full border border-neutral-300 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-500 transition shadow-sm bg-white"
                />
              </div>

              {/* Input 2: Role Selector Dropdown */}
              <div className="relative">
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full px-5 py-3.5 pr-10 rounded-full border border-neutral-300 text-sm text-neutral-700 bg-white focus:outline-none focus:border-neutral-500 transition shadow-sm appearance-none cursor-pointer"
                >
                  <option value="" disabled hidden>
                    Select Role (Inspector, Supervisor, Manager)
                  </option>
                  <option value="inspector">Inspector (Rajesh Sharma) </option>
                  <option value="supervisor">Supervisor (Priya) </option>
                  <option value="manager">Manager (Amit) </option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-5 text-neutral-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>

              {/* Input 3: Password with Eye Toggle */}
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-5 py-3.5 pr-12 rounded-full border border-neutral-300 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-500 transition shadow-sm bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-neutral-600 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Forgot password link */}
              <div className="pt-0.5 text-left">
                <a
                  href="#forgot"
                  onClick={(e) => { e.preventDefault(); alert('Demo environment: Use default accounts (inspector, supervisor, manager).'); }}
                  className="text-xs font-semibold text-[#fe4805] hover:text-[#d83c02] transition inline-block"
                >
                  Forgot password?
                </a>
              </div>

              {/* Primary Action Button (Gradient Orange to Coral) */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(90deg, #fe4805 0%, #fe3a6b 100%)',
                  }}
                  className="w-full py-3.5 px-6 rounded-full text-white font-medium text-sm sm:text-base shadow-md shadow-orange-500/25 hover:opacity-95 transition-all active:scale-[0.99] flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                  {!loading && <LogIn className="w-4 h-4 ml-0.5" />}
                </button>
              </div>

            </form>
          </div>

          {/* Bottom Footer Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 border-t border-neutral-100 text-[11px] text-neutral-400 font-normal">
            <div>
              Â© 2005-2026 Traceon Inc.
            </div>
            <div className="flex items-center space-x-4 text-neutral-500">
              <span className="hover:text-neutral-800 cursor-pointer transition">Contact Us</span>
              <span className="flex items-center space-x-0.5 hover:text-neutral-800 cursor-pointer transition">
                <span>English</span>
                <ChevronDown className="w-3 h-3" />
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
