import React, { useState } from 'react';
import { Menu, X, LogOut, Settings, User, Bell } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../services/store';

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'About', path: '/about' },
    { label: 'Dashboard', path: '/dashboard', protected: true },
    { label: 'Quiz', path: '/quiz', protected: true },
    { label: 'Flashcards', path: '/flashcards', protected: true },
    { label: 'Calculator', path: '/calculator', protected: true },
    { label: 'Leaderboard', path: '/leaderboard', protected: true },
    { label: 'Admin', path: '/admin', protected: true, adminOnly: true },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-bold text-blue-600">
              I
            </div>
            <span className="text-white font-bold text-xl hidden sm:inline">ischkul</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              (!link.protected || user) && (!link.adminOnly || user?.isAdmin) && (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`transition-colors ${
                    isActive(link.path)
                      ? 'text-white font-semibold border-b-2 border-white pb-2'
                      : 'text-blue-100 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              )
            ))}
          </div>

          {/* Right Section */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                <button className="p-2 hover:bg-blue-700 rounded-full transition-colors">
                  <Bell size={20} className="text-white" />
                </button>
                <div className="flex items-center gap-3">
                  {user.avatar && (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  )}
                  <span className="text-white text-sm">{user.name?.split(' ')[0]}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-white hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="bg-white text-blue-600 hover:bg-gray-100 px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {isOpen ? <X size={24} className="text-white" /> : <Menu size={24} className="text-white" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-3">
            {navLinks.map((link) => (
              (!link.protected || user) && (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`block px-4 py-2 rounded-lg transition-colors ${
                    isActive(link.path)
                      ? 'bg-blue-700 text-white font-semibold'
                      : 'text-blue-100 hover:bg-blue-700 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              )
            ))}

            <div className="pt-4 border-t border-blue-400 space-y-2">
              {user ? (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-blue-100 hover:bg-blue-700 hover:text-white rounded-lg transition-colors"
                  >
                    <User size={18} />
                    Profile
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-blue-100 hover:bg-blue-700 hover:text-white rounded-lg transition-colors"
                  >
                    <Settings size={18} />
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                  >
                    <LogOut size={18} />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setIsOpen(false)}
                    className="block px-4 py-2 text-blue-100 hover:bg-blue-700 hover:text-white rounded-lg transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setIsOpen(false)}
                    className="block px-4 py-2 bg-white text-blue-600 hover:bg-gray-100 rounded-lg font-semibold transition-colors"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
