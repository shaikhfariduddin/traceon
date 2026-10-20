import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Package,
  Layers,
  Camera,
  History,
  AlertTriangle,
  ListOrdered,
  Sparkles,
  LogOut,
  UserCheck,
  ShieldCheck,
  Wrench,
  Cpu
} from 'lucide-react';

export default function Navbar() {
  const { user, logout, loginAsDemo } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Priority Queue', path: '/priority-queue', icon: ListOrdered, badge: 'Innovation' },
    { label: 'New Inspection', path: '/inspections/new', icon: Camera },
    { label: 'Inspections', path: '/inspections', icon: History },
    { label: 'Defects & Actions', path: '/defects', icon: AlertTriangle },
    { label: 'Products', path: '/products', icon: Package },
    { label: 'Batches', path: '/batches', icon: Layers },
    { label: 'Gemini Intel', path: '/quality-ai', icon: Sparkles },
    { label: 'Accounts', path: '/users', icon: UserCheck },
  ];

  const roleStyles = {
    inspector: {
      bg: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
      icon: UserCheck,
      name: 'Inspector',
    },
    supervisor: {
      bg: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
      icon: Wrench,
      name: 'Supervisor',
    },
    manager: {
      bg: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
      icon: ShieldCheck,
      name: 'Manager',
    },
  };

  const handleRoleSwitch = async (newRole) => {
    try {
      await loginAsDemo(newRole);
      navigate(location.pathname);
    } catch (err) {
      console.error('Role switch failed', err);
    }
  };

  const currentRole = roleStyles[user.role] || roleStyles.inspector;
  const RoleIcon = currentRole.icon;

  return (
    <header className="bg-slate-950/95 backdrop-blur-md text-white border-b border-slate-800/80 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo & System Brand */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <span className="text-base">ðŸ”²</span>
              </div>
              <div>
                <div className="text-base font-extrabold text-white tracking-tight flex items-center space-x-1.5">
                  <span>Traceon</span>
                </div>
              </div>
            </Link>

            {/* Live Model Indicators */}
            <div className="hidden xl:flex items-center space-x-2 pl-3 border-l border-slate-800 text-[10px]">
              <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Gemini 3.8 Flash</span>
              </span>
              <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                <Cpu className="w-2.5 h-2.5 text-indigo-400" />
                <span>ResNetLite</span>
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-1 lg:space-x-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.path === '/'
                ? location.pathname === '/'
                : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{item.label}</span>
                  {item.badge && !isActive && (
                    <span className="hidden lg:inline-block text-[9px] font-bold px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Role Badge & Dropdown Switcher */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 bg-slate-900/90 border border-slate-800 rounded-xl px-2 py-1">
              <RoleIcon className="w-3.5 h-3.5 text-indigo-400" />
              <select
                value={user.role}
                onChange={(e) => handleRoleSwitch(e.target.value)}
                className={`text-xs font-bold px-2 py-0.5 rounded-lg border cursor-pointer focus:outline-none ${currentRole.bg}`}
                title="Switch role for judging evaluation"
              >
                <option value="inspector">Inspector (Rajesh)</option>
                <option value="supervisor">Supervisor (Priya)</option>
                <option value="manager">Manager (Vikram)</option>
              </select>
            </div>

            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-900 transition border border-transparent hover:border-slate-800"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden flex overflow-x-auto px-4 py-2 bg-slate-900 border-t border-slate-800/80 space-x-2 scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium transition ${
                isActive ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
