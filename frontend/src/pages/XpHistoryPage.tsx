import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import { Trophy, TrendingUp, Calendar, Award, Activity, BookOpen, Zap, Users, FileText, MessageSquare } from 'lucide-react';
import { Navbar } from '../components/Navbar';

interface XpLog {
  id: string;
  xpEarned: number;
  activityType: string;
  metadata?: {
    quizScore?: number;
    description?: string;
  };
  timestamp: string;
}

interface XpStats {
  timeRange: string;
  totalXp: number;
  totalActivities: number;
  byActivityType: Array<{
    activityType: string;
    totalXp: number;
    count: number;
  }>;
  dailyBreakdown: Array<{
    date: string;
    xp: number;
    activities: number;
  }>;
}

const activityConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  QUIZ_COMPLETE: {
    label: 'Quiz Completed',
    icon: <Award className="w-5 h-5" />,
    color: 'text-blue-500'
  },
  FLASHCARD_COMPLETE: {
    label: 'Flashcards Studied',
    icon: <BookOpen className="w-5 h-5" />,
    color: 'text-purple-500'
  },
  NOTE_SUMMARY: {
    label: 'Note Summarized',
    icon: <FileText className="w-5 h-5" />,
    color: 'text-green-500'
  },
  DAILY_LOGIN: {
    label: 'Daily Login',
    icon: <Calendar className="w-5 h-5" />,
    color: 'text-amber-500'
  },
  STREAK_BONUS: {
    label: 'Streak Bonus',
    icon: <Zap className="w-5 h-5" />,
    color: 'text-yellow-500'
  },
  COMMUNITY_PARTICIPATION: {
    label: 'Community Activity',
    icon: <Users className="w-5 h-5" />,
    color: 'text-pink-500'
  },
  DOCUMENT_UPLOAD: {
    label: 'Document Uploaded',
    icon: <FileText className="w-5 h-5" />,
    color: 'text-teal-500'
  },
  AI_TUTOR_USAGE: {
    label: 'AI Tutor Session',
    icon: <MessageSquare className="w-5 h-5" />,
    color: 'text-indigo-500'
  }
};

export const XpHistoryPage: React.FC = () => {
  const { user } = useAuthStore();
  const [badges, setBadges] = useState<any[]>([]);
  const [logs, setLogs] = useState<XpLog[]>([]);
  const [stats, setStats] = useState<XpStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [userStats, setUserStats] = useState<{ totalXp: number; level: number } | null>(null);

  useEffect(() => {
    fetchXpHistory();
    fetchXpStats();
    fetchBadges();
  }, [timeRange]);

  const fetchBadges = async () => {
    try {
      const [badgesRes, activityRes, userBadgesRes] = await Promise.all([
        api.get('/gamification/badges').catch(() => ({ data: { badges: [] } })),
        api.get('/gamification/activity').catch(() => ({ data: { badges: [] } })),
        api.get('/users/badges/my').catch(() => ({ data: { badges: [] } }))
      ]);

      const calculatedBadges = badgesRes.data.badges || [];
      const storedBadgeCodes = activityRes.data.badges || [];
      const userBadges = userBadgesRes.data.badges || [];

      const storedBadges = storedBadgeCodes.map((code: string) => {
        if (code === 'ActiveLearner') return { name: 'Active Learner', description: 'Earned 50+ XP', icon: '🔥' };
        return { name: code, description: 'Achievement Unlocked', icon: '⭐' };
      });

      // Convert user badges from DB to display format
      const formattedUserBadges = userBadges.map((badge: any) => ({
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        awardedDate: badge.awardedDate,
        type: badge.type,
        metadata: badge.metadata
      }));

      // Combine all badges and dedup by name
      const allBadges = [...calculatedBadges, ...storedBadges, ...formattedUserBadges];
      const uniqueBadges = Array.from(new Map(allBadges.map(item => [item.name, item])).values());

      setBadges(uniqueBadges);
    } catch (error) {
      console.error('Failed to fetch badges:', error);
    }
  };

  const fetchXpHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get('/xp-history', {
        params: { limit: 50, skip: 0 }
      });

      if (response.data.success) {
        setLogs(response.data.data.logs);
        setUserStats(response.data.data.userStats);
      }
    } catch (error) {
      console.error('Failed to fetch XP history:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchXpStats = async () => {
    try {
      const response = await api.get('/xp-history/stats', {
        params: { timeRange }
      });

      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch XP stats:', error);
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getActivityConfig = (activityType: string) => {
    return activityConfig[activityType] || {
      label: activityType,
      icon: <Activity className="w-5 h-5" />,
      color: 'text-gray-500'
    };
  };

  if (loading && logs.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading XP History...</div>
      </div>
    );
  }

  // Calculate level progress
  const currentXp = userStats?.totalXp || 0;
  const currentLevel = userStats?.level || 1;
  const xpForNextLevel = ((currentLevel) * 100);
  const xpForCurrentLevel = ((currentLevel - 1) * 100);
  const progressInLevel = currentXp - xpForCurrentLevel;
  const progressPercent = Math.min(100, Math.max(0, (progressInLevel / 100) * 100));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Navbar />
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <Trophy className="w-10 h-10 text-yellow-400" />
              XP History & Badges
            </h1>
            <p className="text-slate-300">Track your learning progress, level up, and earn badges</p>
          </div>

          {/* User Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-6 h-6 text-blue-200" />
                <span className="text-blue-100 text-sm font-medium">Total XP</span>
              </div>
              <p className="text-4xl font-bold text-white">{currentXp}</p>
              <p className="text-blue-200 text-xs mt-2">{100 - (currentXp % 100)} XP to next level</p>
            </div>

            <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Award className="w-6 h-6 text-purple-200" />
                  <span className="text-purple-100 text-sm font-medium">Level {currentLevel}</span>
                </div>
                <span className="text-xs font-bold bg-purple-800 text-purple-200 px-2 py-1 rounded">{Math.round(progressPercent)}%</span>
              </div>

              <div className="w-full bg-purple-900/50 rounded-full h-3 mt-2">
                <div
                  className="bg-white h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <p className="text-purple-200 text-xs mt-2">Next Level: {currentLevel + 1}</p>
            </div>

            <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
              <div className="flex items-center gap-3 mb-2">
                <Activity className="w-6 h-6 text-green-200" />
                <span className="text-green-100 text-sm font-medium">Activities ({timeRange})</span>
              </div>
              <p className="text-4xl font-bold text-white">{stats?.totalActivities || 0}</p>
            </div>
          </div>

          {/* Badges Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Award className="w-6 h-6 text-yellow-400" />
              Your Badges
            </h2>
            {badges.length === 0 ? (
              <div className="bg-slate-800 rounded-xl p-8 text-center border border-slate-700">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-700 rounded-full mb-4">
                  <Award className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-white mb-1">No Badges Yet</h3>
                <p className="text-slate-400">Keep learning to unlock achievements!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {badges.map((badge, idx) => (
                  <div 
                    key={`badge-${badge.name || badge.icon}-${idx}`} 
                    className={`rounded-xl p-4 flex flex-col items-center text-center hover:scale-105 transition-transform ${
                      badge.type === 'sotw' 
                        ? 'bg-gradient-to-br from-yellow-500 to-orange-600 border-2 border-yellow-300 shadow-lg shadow-yellow-500/50' 
                        : 'bg-slate-800 border border-slate-700'
                    }`}
                  >
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 text-2xl ${
                      badge.type === 'sotw'
                        ? 'bg-white/20 shadow-lg'
                        : 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg'
                    }`}>
                      {badge.icon || (badge.type === 'sotw' ? '🏆' : '⭐')}
                    </div>
                    <h3 className={`font-bold text-sm mb-1 ${badge.type === 'sotw' ? 'text-white' : 'text-white'}`}>
                      {badge.name}
                    </h3>
                    <p className={`text-xs mb-2 ${badge.type === 'sotw' ? 'text-white/80' : 'text-slate-400'}`}>
                      {badge.description}
                    </p>
                    {badge.awardedDate && (
                      <p className={`text-xs ${badge.type === 'sotw' ? 'text-white/60' : 'text-slate-500'}`}>
                        {new Date(badge.awardedDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Time Range Filter */}
          <div className="bg-slate-800 rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4">
            <span className="text-slate-300 font-medium">Time Range:</span>
            <div className="flex gap-2">
              {['7d', '30d', '90d', 'all'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                >
                  {range === 'all' ? 'All Time' : range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Type Breakdown */}
          {stats && stats.byActivityType.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Activity className="w-6 h-6" />
                Activity Breakdown
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.byActivityType.map((activity, index) => {
                  const config = getActivityConfig(activity.activityType);
                  return (
                    <div
                      key={`activity-${activity.activityType}-${index}`}
                      className="bg-slate-700 rounded-lg p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={config.color}>{config.icon}</div>
                        <div>
                          <p className="text-white font-medium">{config.label}</p>
                          <p className="text-slate-400 text-sm">{activity.count} times</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-400">+{activity.totalXp}</p>
                        <p className="text-slate-400 text-xs">XP</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Activity Log */}
          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Recent Activity</h2>

            {logs.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">No activity yet</p>
                <p className="text-slate-500 text-sm">Start learning to earn XP!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log, index) => {
                  const config = getActivityConfig(log.activityType);
                  return (
                    <div
                      key={`log-${log.id || log.timestamp}-${index}`}
                      className="bg-slate-700 rounded-lg p-4 flex items-center justify-between hover:bg-slate-600 transition"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`${config.color} bg-slate-800 rounded-full p-3`}>
                          {config.icon}
                        </div>
                        <div>
                          <p className="text-white font-medium">{config.label}</p>
                          {log.metadata?.description && (
                            <p className="text-slate-400 text-sm">{log.metadata.description}</p>
                          )}
                          {log.metadata?.quizScore !== undefined && (
                            <p className="text-slate-400 text-sm">Score: {log.metadata.quizScore}%</p>
                          )}
                          <p className="text-slate-500 text-xs mt-1">{formatDate(log.timestamp)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-400">+{log.xpEarned}</p>
                        <p className="text-slate-400 text-xs">XP</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
