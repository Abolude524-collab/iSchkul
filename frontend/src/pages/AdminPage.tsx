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
  BookOpen,
  Brain,
  MessageSquare,
  FileText,
  Trophy,
  Target,
  Award
} from 'lucide-react';

interface AnalyticsData {
  overview: {
    totalUsers: number;
    totalQuizzes: number;
    totalFlashcards: number;
    totalMessages: number;
    activeUsers: number;
    newUsersToday: number;
    quizAttempts: number;
    avgScore: number;
  };
  userGrowth: Array<{ date: string; count: number }>;
  quizPerformance: Array<{ subject: string; avgScore: number; attempts: number }>;
  featureUsage: {
    quizzes: number;
    flashcards: number;
    chat: number;
    files: number;
  };
  recentActivity: Array<{
    type: string;
    user: string;
    action: string;
    timestamp: string;
  }>;
}

interface User {
  _id: string;
  email: string;
  displayName: string;
  role: string;
  xp: number;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
}

interface Leaderboard {
  _id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  prizes: string[];
  rankings: Array<{
    userId: string;
    name: string;
    total_xp: number;
    rank: number;
  }>;
  status: 'active' | 'ended';
}

export const AdminPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'analytics' | 'notifications' | 'leaderboards' | 'system'>('overview');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [leaderboards, setLeaderboards] = useState<Leaderboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    targetUsers: 'all',
    type: 'info'
  });
  const [leaderboardForm, setLeaderboardForm] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    prizes: ['']
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!user.isAdmin) {
      navigate('/dashboard');
      return;
    }

    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');

      // Load analytics
      const analyticsResponse = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:7071'}/api/analytics/overview`,
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
        `${process.env.REACT_APP_API_URL || 'http://localhost:7071'}/api/admin/users`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.users || []);
      }

      // Load leaderboards
      const leaderboardsResponse = await leaderboardAPI.getAllLeaderboards();
      if (leaderboardsResponse.data) {
        setLeaderboards(leaderboardsResponse.data.leaderboards || []);
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
        `${process.env.REACT_APP_API_URL || 'http://localhost:7071'}/api/admin/notifications/send`,
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
        setNotificationForm({ title: '', message: '', targetUsers: 'all', type: 'info' });
        alert('Notification sent successfully!');
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
        `${process.env.REACT_APP_API_URL || 'http://localhost:7071'}/api/admin/users/role`,
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

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const token = localStorage.getItem('authToken');
      await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:7071'}/api/admin/users`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ userId })
        }
      );
      loadData(); // Refresh data
    } catch (err: any) {
      alert('Error deleting user: ' + err.message);
    }
  };

  const createLeaderboard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await leaderboardAPI.createLeaderboard({
        ...leaderboardForm,
        prizes: leaderboardForm.prizes.filter(prize => prize.trim() !== '')
      });
      setLeaderboardForm({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        prizes: ['']
      });
      loadData(); // Refresh data
    } catch (err: any) {
      alert('Error creating leaderboard: ' + err.message);
    }
  };

  const endLeaderboard = async (leaderboardId: string) => {
    if (!confirm('Are you sure you want to end this leaderboard competition?')) return;

    try {
      await leaderboardAPI.endLeaderboard(leaderboardId);
      loadData(); // Refresh data
    } catch (err: any) {
      alert('Error ending leaderboard: ' + err.message);
    }
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

      <div className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage users, monitor analytics, and control system settings</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-8">
          <nav className="flex space-x-8 border-b border-gray-200">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'users', label: 'User Management', icon: Users },
              { id: 'analytics', label: 'Analytics', icon: TrendingUp },
              { id: 'leaderboards', label: 'Leaderboards', icon: Trophy },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'system', label: 'System', icon: Settings }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && analytics && (
          <div className="space-y-8">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <Users className="text-blue-600" size={24} />
                  <div>
                    <p className="text-sm text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics.overview.totalUsers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <BookOpen className="text-green-600" size={24} />
                  <div>
                    <p className="text-sm text-gray-600">Total Quizzes</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics.overview.totalQuizzes}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <Brain className="text-purple-600" size={24} />
                  <div>
                    <p className="text-sm text-gray-600">Flashcards Created</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics.overview.totalFlashcards}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <Activity className="text-orange-600" size={24} />
                  <div>
                    <p className="text-sm text-gray-600">Active Today</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics.overview.activeUsers}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Usage */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Usage</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <BookOpen className="mx-auto text-blue-600 mb-2" size={32} />
                  <p className="text-2xl font-bold text-gray-900">{analytics.featureUsage.quizzes}</p>
                  <p className="text-sm text-gray-600">Quiz Sessions</p>
                </div>
                <div className="text-center">
                  <Brain className="mx-auto text-purple-600 mb-2" size={32} />
                  <p className="text-2xl font-bold text-gray-900">{analytics.featureUsage.flashcards}</p>
                  <p className="text-sm text-gray-600">Flashcard Reviews</p>
                </div>
                <div className="text-center">
                  <MessageSquare className="mx-auto text-green-600 mb-2" size={32} />
                  <p className="text-2xl font-bold text-gray-900">{analytics.featureUsage.chat}</p>
                  <p className="text-sm text-gray-600">Chat Messages</p>
                </div>
                <div className="text-center">
                  <FileText className="mx-auto text-orange-600 mb-2" size={32} />
                  <p className="text-2xl font-bold text-gray-900">{analytics.featureUsage.files}</p>
                  <p className="text-sm text-gray-600">Files Uploaded</p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {analytics.recentActivity.slice(0, 10).map((activity, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Activity size={16} className="text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.user} {activity.action}
                      </p>
                      <p className="text-xs text-gray-500">{activity.timestamp}</p>
                    </div>
                    <span className="text-xs text-gray-400">{activity.type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* User Management Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
              <p className="text-sm text-gray-600">Manage user accounts and permissions</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">XP</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user._id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={user.role || 'user'}
                          onChange={(e) => updateUserRole(user._id, e.target.value)}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          <option value="superadmin">Super Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.xp || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => deleteUser(user._id)}
                          className="text-red-600 hover:text-red-900 ml-4"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="max-w-2xl">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Send Notification</h3>

              <form onSubmit={sendNotification} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Notification Title
                  </label>
                  <input
                    type="text"
                    value={notificationForm.title}
                    onChange={(e) => setNotificationForm({ ...notificationForm, title: e.target.value })}
                    placeholder="e.g., New Feature Available!"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Message
                  </label>
                  <textarea
                    value={notificationForm.message}
                    onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })}
                    placeholder="Enter your notification message..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Target Users
                    </label>
                    <select
                      value={notificationForm.targetUsers}
                      onChange={(e) => setNotificationForm({ ...notificationForm, targetUsers: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="all">All Users</option>
                      <option value="active">Active Users</option>
                      <option value="inactive">Inactive Users</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Type
                    </label>
                    <select
                      value={notificationForm.type}
                      onChange={(e) => setNotificationForm({ ...notificationForm, type: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="info">Info</option>
                      <option value="success">Success</option>
                      <option value="warning">Warning</option>
                      <option value="error">Error</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Send size={20} />
                  Send Notification
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && analytics && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* User Growth Chart Placeholder */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">User Growth</h3>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <BarChart3 size={48} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-500">Chart visualization would go here</p>
                    <p className="text-sm text-gray-400 mt-2">
                      {analytics.userGrowth.length} data points available
                    </p>
                  </div>
                </div>
              </div>

              {/* Quiz Performance */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quiz Performance by Subject</h3>
                <div className="space-y-3">
                  {analytics.quizPerformance.map((subject, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{subject.subject}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${subject.avgScore}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">{subject.avgScore.toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* System Health */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <CheckCircle className="mx-auto text-green-600 mb-2" size={32} />
                  <p className="text-sm font-medium text-gray-900">Database</p>
                  <p className="text-xs text-gray-600">Healthy</p>
                </div>
                <div className="text-center">
                  <CheckCircle className="mx-auto text-green-600 mb-2" size={32} />
                  <p className="text-sm font-medium text-gray-900">API</p>
                  <p className="text-xs text-gray-600">Operational</p>
                </div>
                <div className="text-center">
                  <CheckCircle className="mx-auto text-green-600 mb-2" size={32} />
                  <p className="text-sm font-medium text-gray-900">AI Services</p>
                  <p className="text-xs text-gray-600">Available</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboards Tab */}
        {activeTab === 'leaderboards' && (
          <div className="space-y-8">
            {/* Create New Leaderboard */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Trophy size={20} />
                Create New Leaderboard
              </h3>
              <form onSubmit={createLeaderboard} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={leaderboardForm.title}
                      onChange={(e) => setLeaderboardForm({ ...leaderboardForm, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={leaderboardForm.description}
                      onChange={(e) => setLeaderboardForm({ ...leaderboardForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="datetime-local"
                      value={leaderboardForm.startDate}
                      onChange={(e) => setLeaderboardForm({ ...leaderboardForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="datetime-local"
                      value={leaderboardForm.endDate}
                      onChange={(e) => setLeaderboardForm({ ...leaderboardForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prizes</label>
                  {leaderboardForm.prizes.map((prize, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={prize}
                        onChange={(e) => updatePrizeField(index, e.target.value)}
                        placeholder={`Prize ${index + 1}`}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {leaderboardForm.prizes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePrizeField(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <XCircle size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addPrizeField}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    + Add Prize
                  </button>
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Leaderboard
                </button>
              </form>
            </div>

            {/* Existing Leaderboards */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Target size={20} />
                Active Leaderboards
              </h3>
              <div className="space-y-4">
                {leaderboards.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No leaderboards created yet.</p>
                ) : (
                  leaderboards.map((leaderboard) => (
                    <div key={leaderboard._id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{leaderboard.title}</h4>
                          <p className="text-gray-600 text-sm mb-2">{leaderboard.description}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>Starts: {new Date(leaderboard.startDate).toLocaleDateString()}</span>
                            <span>Ends: {new Date(leaderboard.endDate).toLocaleDateString()}</span>
                            <span>{leaderboard.rankings.length} participants</span>
                          </div>
                          {leaderboard.prizes.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm font-medium text-gray-700">Prizes:</p>
                              <ul className="text-sm text-gray-600">
                                {leaderboard.prizes.map((prize, idx) => (
                                  <li key={idx}>🏆 {prize}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {leaderboard.status === 'active' && (
                            <button
                              onClick={() => endLeaderboard(leaderboard._id)}
                              className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                            >
                              End Competition
                            </button>
                          )}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            leaderboard.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {leaderboard.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">System Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Maintenance Mode</p>
                    <p className="text-sm text-gray-600">Temporarily disable user access for maintenance</p>
                  </div>
                  <button className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200">
                    Enable
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Cache Clear</p>
                    <p className="text-sm text-gray-600">Clear all system caches</p>
                  </div>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Clear Cache
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Backup Database</p>
                    <p className="text-sm text-gray-600">Create a backup of all user data</p>
                  </div>
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    Backup Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};