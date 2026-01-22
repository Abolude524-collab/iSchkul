import React, { useState, useEffect } from 'react';
import { Menu, X, LogOut, Settings, User, Bell, Trophy } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../services/store';
import { getAPIEndpoint } from '../services/api';
import { io, Socket } from 'socket.io-client';
import SyncStatus from './SyncStatus';

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const { user, token, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsOpen(false);
  };

  const fetchNotificationCount = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(getAPIEndpoint('/notifications/count'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setNotificationCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching notification count:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotificationCount();

      // Set up real-time Socket.IO connection for notification updates
      const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
        auth: {
          token: localStorage.getItem('authToken')
        }
      });

      newSocket.on('connect', () => {
        console.log('Navbar connected to notification socket');
        newSocket.emit('join-user', user.id);
      });

      newSocket.on('new-notification', () => {
        // Refresh notification count when new notification arrives
        fetchNotificationCount();
      });

      newSocket.on('disconnect', () => {
        console.log('Navbar disconnected from notification socket');
      });

      setSocket(newSocket);

      // Refresh notification count every 30 seconds as backup
      const interval = setInterval(fetchNotificationCount, 30000);

      return () => {
        newSocket.disconnect();
        clearInterval(interval);
      };
    }
  }, [user]);

  const isActive = (path: string) => location.pathname === path;

  const navLinks = [
    { label: 'Home', path: '/', protected: false, adminOnly: false },
    { label: 'About', path: '/about', protected: false, adminOnly: false },
    { label: user?.isAdmin ? 'Admin Dashboard' : 'Dashboard', path: user?.isAdmin ? '/admin' : '/dashboard', protected: true, adminOnly: user?.isAdmin || false },
    ...(user?.isAdmin ? [] : [{ label: 'Quiz', path: '/quiz', protected: true, adminOnly: false }]),
    ...(user?.isAdmin ? [] : [{ label: 'Flashcards', path: '/flashcards', protected: true, adminOnly: false }]),
    ...(user?.isAdmin ? [] : [{ label: 'Leaderboard', path: '/leaderboard', protected: true, adminOnly: false }]),
    //...(user?.isAdmin ? [] : [{ label: 'XP History', path: '/xp-history', protected: true, adminOnly: false }]),
 
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
            <span className="text-white font-bold text-xl hidden sm:inline">iSchkul</span>
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
                <SyncStatus token={token || undefined} />
                <button
                  onClick={() => navigate('/notification')}
                  className="p-2 hover:bg-blue-700 rounded-full transition-colors relative"
                >
                  <Bell size={20} className="text-white" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => navigate('/xp-history')}
                  className="p-2 hover:bg-blue-700 rounded-full transition-colors"
                  aria-label="XP History"
                >
                  <Trophy size={20} className="text-yellow-400" />
                </button>
                <button
                  onClick={() => navigate('/profile')}
                  className="p-2 hover:bg-blue-700 rounded-full transition-colors"
                  aria-label="Profile"
                >
                  <User size={20} className="text-white" />
                </button>
                <button
                  onClick={() => navigate('/settings')}
                  className="p-2 hover:bg-blue-700 rounded-full transition-colors"
                  aria-label="Settings"
                >
                  <Settings size={20} className="text-white" />
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

          {/* Mobile section */}
          <div className="md:hidden flex items-center gap-2">
            {user && (
              <div className="scale-90 origin-right">
                <SyncStatus token={token || undefined} />
              </div>
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isOpen ? <X size={24} className="text-white" /> : <Menu size={24} className="text-white" />}
            </button>
          </div>
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
                  <button
                    onClick={() => {
                      navigate('/notification');
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-blue-100 hover:bg-blue-700 hover:text-white rounded-lg transition-colors relative"
                  >
                    <Bell size={18} />
                    Notifications
                    {notificationCount > 0 && (
                      <span className="absolute right-4 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </span>
                    )}
                  </button>
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
