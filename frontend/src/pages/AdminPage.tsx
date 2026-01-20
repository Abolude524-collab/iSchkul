import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuthStore } from '../services/store';
import { leaderboardAPI } from '../services/api';
import {
  Users,
  BarChart3,
  TrendingUp,
  Activity,
  Bell,
  Settings,
  Shield,
  Mail,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  UserCheck,
  UserX,
  Send,
  Calendar,
  Trophy,
  Target,
  Award,
  Crown,
  UserPlus,
  UserMinus,
  MessageSquare,
  Plus,
  Edit,
  Lock,
  Unlock,
  Zap,
  RefreshCw
} from 'lucide-react';

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  adminUsers: number;
  totalQuizzes: number;
  totalFlashcards: number;
  totalGroups: number;
  recentActivity: any[];
}

interface User {
  _id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  isAdmin: boolean;
  xp: number;
  level: number;
  createdAt: string;
  lastActive: string;
}

interface SentNotification {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  createdAt: string;
  recipientCount: number;
  readCount: number;
}

interface Leaderboard {
  _id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  prizes: string[];
  rankings: any[];
  isRestricted?: boolean;
  allowedUsers?: string[];
  createdAt: string;
}

export const AdminPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'leaderboards' | 'notifications' | 'system'>('dashboard');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [leaderboards, setLeaderboards] = useState<Leaderboard[]>([]);
  const [sentNotifications, setSentNotifications] = useState<SentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncingXp, setSyncingXp] = useState(false);
  const [recalculatingSotw, setRecalculatingSotw] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Notification form
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    type: 'info'
  });

  // Leaderboard form
  const [leaderboardForm, setLeaderboardForm] = useState({
    title: '',
    description: '',
    durationDays: 7,
    prizes: [''],
    isRestricted: false,
    allowedUsers: [] as string[]
  });

  const [showLeaderboardForm, setShowLeaderboardForm] = useState(false);
  const [editingLeaderboard, setEditingLeaderboard] = useState<Leaderboard | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Check if user is admin - allow isAdmin flag, admin role, or superadmin role
    const isUserAdmin = user.isAdmin === true || user.role === 'admin' || user.role === 'superadmin';
    if (!isUserAdmin) {
      console.warn('User is not admin. User role:', user.role, 'isAdmin:', user.isAdmin);
      navigate('/');
      return;
    }

    loadData();
  }, [user, navigate]);

  // Real-time data updates
  useEffect(() => {
    if (!user || (!user.isAdmin && user.role !== 'admin' && user.role !== 'superadmin')) {
      return;
    }

    const interval = setInterval(() => {
      loadData(true);
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const token = localStorage.getItem('authToken');

      // Load analytics
      const analyticsResponse = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/analytics/overview`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setAnalytics(analyticsData);
      }

      // Load users
      const usersResponse = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/users`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.users || []);
      }

      // Load leaderboards
      try {
        const leaderboardsResponse = await leaderboardAPI.listLeaderboards();
        if (leaderboardsResponse.data) {
          setLeaderboards(leaderboardsResponse.data.leaderboards || []);
        }
      } catch (leaderboardError) {
        console.error('Failed to load leaderboards:', leaderboardError);
        // Don't fail the entire page if leaderboards fail
        setLeaderboards([]);
      }

      // Load sent notifications
      const notificationsResponse = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/notifications/sent`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (notificationsResponse.ok) {
        const notificationsData = await notificationsResponse.json();
        setSentNotifications(notificationsData.notifications || []);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/notifications/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(notificationForm)
        }
      );

      if (response.ok) {
        setNotificationForm({ title: '', message: '', type: 'info' });
        alert('Notification sent successfully!');
        loadData(); // Refresh data including sent notifications
      } else {
        throw new Error('Failed to send notification');
      }
    } catch (err: any) {
      alert('Error sending notification: ' + err.message);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const token = localStorage.getItem('authToken');
      await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/users/role`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ userId, role: newRole })
        }
      );
      loadData(); // Refresh data
    } catch (err: any) {
      alert('Error updating user role: ' + err.message);
    }
  };

  const syncUserXp = async (userId: string, userName: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/sync-xp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ userId })
        }
      );

      if (response.ok) {
        const result = await response.json();
        alert(`✓ XP synced for ${userName}: ${result.xp} XP (${result.xpLogsTotal} from logs)`);
        loadData(true);
      } else {
        throw new Error('Failed to sync user XP');
      }
    } catch (err: any) {
      alert(`✗ Error syncing XP: ${err.message}`);
    }
  };

  const syncAllXp = async () => {
    setSyncingXp(true);
    setSyncMessage('');
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/sync-all-xp`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        setSyncMessage(`✓ Successfully synced XP for ${result.usersUpdated} users`);
        setTimeout(() => setSyncMessage(''), 3000);
        loadData(true);
      } else {
        throw new Error('Failed to sync XP');
      }
    } catch (err: any) {
      setSyncMessage(`✗ Error: ${err.message}`);
    } finally {
      setSyncingXp(false);
    }
  };

  const recalculateSotw = async () => {
    setRecalculatingSotw(true);
    setSyncMessage('');
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/recalculate-sotw`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        setSyncMessage(`✓ Successfully recalculated SOTW. Winner: ${result.winner?.name || 'None'}`);
        setTimeout(() => setSyncMessage(''), 3000);
        loadData(true);
      } else {
        throw new Error('Failed to recalculate SOTW');
      }
    } catch (err: any) {
      setSyncMessage(`✗ Error: ${err.message}`);
    } finally {
      setRecalculatingSotw(false);
    }
  };

  const createLeaderboard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await leaderboardAPI.createLeaderboard({
        title: leaderboardForm.title,
        description: leaderboardForm.description,
        durationDays: leaderboardForm.durationDays,
        prizes: leaderboardForm.prizes.filter(prize => prize.trim() !== ''),
        isRestricted: leaderboardForm.isRestricted,
        allowedUsers: leaderboardForm.allowedUsers
      });
      setLeaderboardForm({
        title: '',
        description: '',
        durationDays: 7,
        prizes: [''],
        isRestricted: false,
        allowedUsers: []
      });
      setShowLeaderboardForm(false);
      loadData();
    } catch (err: any) {
      alert('Error creating leaderboard: ' + err.message);
    }
  };

  const endLeaderboard = async (leaderboardId: string) => {
    if (!confirm('Are you sure you want to end this leaderboard competition?')) return;

    try {
      await leaderboardAPI.endLeaderboard(leaderboardId);
      loadData();
    } catch (err: any) {
      alert('Error ending leaderboard: ' + err.message);
    }
  };

  const viewLeaderboard = (leaderboardId: string) => {
    // Navigate to leaderboard details page or open modal
    navigate(`/leaderboard/${leaderboardId}`);
  };

  const addPrizeField = () => {
    setLeaderboardForm({
      ...leaderboardForm,
      prizes: [...leaderboardForm.prizes, '']
    });
  };

  const updatePrizeField = (index: number, value: string) => {
    const newPrizes = [...leaderboardForm.prizes];
    newPrizes[index] = value;
    setLeaderboardForm({
      ...leaderboardForm,
      prizes: newPrizes
    });
  };

  const removePrizeField = (index: number) => {
    setLeaderboardForm({
      ...leaderboardForm,
      prizes: leaderboardForm.prizes.filter((_, i) => i !== index)
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'bg-red-100 text-red-800';
      case 'admin': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <div className="flex-grow">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <Shield className="h-8 w-8 text-blue-600" />
                    Admin Dashboard
                  </h1>
                  <p className="mt-2 text-gray-600">Manage users, analytics, and platform settings</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Welcome back</p>
                    <p className="font-semibold text-gray-900">{user?.name}</p>
                  </div>
                  <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <Crown className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Navigation Tabs */}
          <div className="mb-8">
            <nav className="flex space-x-8 overflow-x-auto">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
                { id: 'users', label: 'User Management', icon: Users },
                { id: 'leaderboards', label: 'Leaderboards', icon: Trophy },
                { id: 'notifications', label: 'Notifications', icon: Bell },
                { id: 'system', label: 'System', icon: Settings }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Analytics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Users</p>
                      <p className="text-3xl font-bold text-gray-900">{analytics?.totalUsers || 0}</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-600" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Users</p>
                      <p className="text-3xl font-bold text-gray-900">{analytics?.activeUsers || 0}</p>
                    </div>
                    <Activity className="h-8 w-8 text-green-600" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Admin Users</p>
                      <p className="text-3xl font-bold text-gray-900">{analytics?.adminUsers || 0}</p>
                    </div>
                    <Shield className="h-8 w-8 text-purple-600" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Leaderboards</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {leaderboards.filter(l => l.status === 'active').length}
                      </p>
                    </div>
                    <Trophy className="h-8 w-8 text-yellow-600" />
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                </div>
                <div className="p-6">
                  {analytics?.recentActivity?.length > 0 ? (
                    <div className="space-y-4">
                      {analytics.recentActivity.map((activity, index) => (
                        <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                          <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Activity className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{activity.user}</p>
                            <p className="text-sm text-gray-600">{activity.action}</p>
                          </div>
                          <span className="text-xs text-gray-500">{activity.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No recent activity</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
                  <p className="text-sm text-gray-600">View and manage all platform users</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">XP</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user._id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-700">
                                  {user.name?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase()}
                                </span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{user.name || user.username}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {user.xp} XP (Level {user.level})
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2 flex-wrap">
                              {user.role !== 'superadmin' && (
                                <>
                                  {user.role === 'user' ? (
                                    <button
                                      onClick={() => updateUserRole(user._id, 'admin')}
                                      className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                                    >
                                      <UserPlus className="h-4 w-4" />
                                      Promote
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => updateUserRole(user._id, 'user')}
                                      className="text-orange-600 hover:text-orange-900 flex items-center gap-1"
                                    >
                                      <UserMinus className="h-4 w-4" />
                                      Demote
                                    </button>
                                  )}
                                </>
                              )}
                              <button
                                onClick={() => syncUserXp(user._id, user.name || user.username)}
                                className="text-green-600 hover:text-green-900 flex items-center gap-1"
                                title="Sync XP from activity logs"
                              >
                                <RefreshCw className="h-4 w-4" />
                                Sync XP
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboards Tab */}
          {activeTab === 'leaderboards' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Leaderboard Management</h3>
                  <p className="text-sm text-gray-600">Create and manage leaderboard competitions</p>
                </div>
                <button
                  onClick={() => setShowLeaderboardForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create Leaderboard
                </button>
              </div>

              {/* Leaderboard Form */}
              {showLeaderboardForm && (
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h4 className="text-lg font-semibold mb-4">Create New Leaderboard</h4>
                  <form onSubmit={createLeaderboard} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                      <input
                        type="text"
                        value={leaderboardForm.title}
                        onChange={(e) => setLeaderboardForm({...leaderboardForm, title: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={leaderboardForm.description}
                        onChange={(e) => setLeaderboardForm({...leaderboardForm, description: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
                      <input
                        type="number"
                        value={leaderboardForm.durationDays}
                        onChange={(e) => setLeaderboardForm({...leaderboardForm, durationDays: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Prizes</label>
                      {leaderboardForm.prizes.map((prize, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={prize}
                            onChange={(e) => updatePrizeField(index, e.target.value)}
                            placeholder={`Prize ${index + 1}`}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {leaderboardForm.prizes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePrizeField(index)}
                              className="px-3 py-2 text-red-600 hover:text-red-800"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addPrizeField}
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        Add Prize
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="restricted"
                        checked={leaderboardForm.isRestricted}
                        onChange={(e) => setLeaderboardForm({...leaderboardForm, isRestricted: e.target.checked})}
                        className="rounded"
                      />
                      <label htmlFor="restricted" className="text-sm text-gray-700">
                        Restrict to specific users only
                      </label>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
                        Create Leaderboard
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLeaderboardForm(false)}
                        className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Leaderboards List */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participants</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {leaderboards.map((leaderboard) => (
                        <tr key={leaderboard._id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{leaderboard.title}</div>
                              <div className="text-sm text-gray-500">{leaderboard.description}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              leaderboard.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {leaderboard.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {leaderboard.participantCount || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(leaderboard.endDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              {leaderboard.status === 'active' && (
                                <button
                                  onClick={() => endLeaderboard(leaderboard._id)}
                                  className="text-red-600 hover:text-red-900 flex items-center gap-1"
                                >
                                  <XCircle className="h-4 w-4" />
                                  End
                                </button>
                              )}
                              <button 
                                onClick={() => viewLeaderboard(leaderboard._id)}
                                className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Notification</h3>
                <p className="text-sm text-gray-600 mb-6">Send notifications to all users or specific groups</p>

                <form onSubmit={sendNotification} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={notificationForm.title}
                      onChange={(e) => setNotificationForm({...notificationForm, title: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Notification title"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                    <textarea
                      value={notificationForm.message}
                      onChange={(e) => setNotificationForm({...notificationForm, message: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                      placeholder="Notification message"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={notificationForm.type}
                      onChange={(e) => setNotificationForm({...notificationForm, type: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="info">Info</option>
                      <option value="success">Success</option>
                      <option value="warning">Warning</option>
                      <option value="error">Error</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Send Notification
                  </button>
                </form>
              </div>

              {/* Sent Notifications History */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">Sent Notifications History</h3>
                  <p className="text-sm text-gray-600 mt-1">View notifications you've sent to users</p>
                </div>
                <div className="p-6">
                  {sentNotifications.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No notifications sent yet</p>
                  ) : (
                    <div className="space-y-4">
                      {sentNotifications.map((notification, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-gray-900">{notification.title}</h4>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  notification.type === 'info' ? 'bg-blue-100 text-blue-800' :
                                  notification.type === 'success' ? 'bg-green-100 text-green-800' :
                                  notification.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {notification.type}
                                </span>
                              </div>
                              <p className="text-gray-700 mb-2">{notification.message}</p>
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span>Sent: {new Date(notification.createdAt).toLocaleString()}</span>
                                <span>Recipients: {notification.recipientCount}</span>
                                <span>Read: {notification.readCount}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* System Tab */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              {/* Gamification Maintenance */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="h-6 w-6 text-yellow-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Gamification Maintenance</h3>
                </div>
                <p className="text-sm text-gray-600 mb-6">Sync user XP and recalculate Student of the Week awards</p>

                {syncMessage && (
                  <div className={`mb-4 p-4 rounded-lg ${
                    syncMessage.startsWith('✓')
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {syncMessage}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">Sync All Users XP</h4>
                          <p className="text-sm text-gray-700 mb-4">
                            Manually synchronize XP calculations for all users based on their quiz scores, daily logins, and activity.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={syncAllXp}
                        disabled={syncingXp}
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center justify-center gap-2"
                      >
                        <RefreshCw className={`h-4 w-4 ${syncingXp ? 'animate-spin' : ''}`} />
                        {syncingXp ? 'Syncing...' : 'Sync All XP'}
                      </button>
                    </div>

                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">Recalculate Student of the Week</h4>
                          <p className="text-sm text-gray-700 mb-4">
                            Recalculate and announce the winner of this week's Student of the Week based on current XP rankings.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={recalculateSotw}
                        disabled={recalculatingSotw}
                        className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:bg-purple-400 flex items-center justify-center gap-2"
                      >
                        <Trophy className={`h-4 w-4 ${recalculatingSotw ? 'animate-spin' : ''}`} />
                        {recalculatingSotw ? 'Recalculating...' : 'Recalculate SOTW'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* System Information */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">System Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Total XP Distributed</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {analytics?.totalUsers ? (analytics.totalUsers * 100).toLocaleString() : '0'}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Active Competitions</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {leaderboards.filter(l => l.status === 'active').length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      <Footer />
    </div>
  );
};
