import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { SOTWConfetti } from '../components/SOTWConfetti';
import { useAuthStore } from '../services/store';
import { gamificationAPI } from '../services/api';
import { BookOpen, MessageSquare, Zap, Award, Users, Brain, FileText, Clock } from 'lucide-react';

// Relative time helper
const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString();
};

// Day key helper
const startOfDayKey = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

const getActivityDetails = (activity: any) => {
  // Defensive check: ensure activity exists
  if (!activity) {
    return {
      icon: Zap,
      color: 'bg-gray-100 text-gray-600',
      title: 'Activity',
      subtitle: 'Unknown activity'
    };
  }

  // Get activity type from either field name (camelCase or snake_case)
  const activityType = activity.activity_type || activity.activityType;
  
  // Defensive check: ensure activity_type exists
  if (!activityType) {
    return {
      icon: Zap,
      color: 'bg-gray-100 text-gray-600',
      title: 'Activity',
      subtitle: 'Unknown activity'
    };
  }

  const type = activityType.toUpperCase();
  const metadata = activity.metadata || {};

  switch (type) {
    case 'QUIZ_COMPLETE':
    case 'QUIZ_COMPLETED':
      return {
        icon: Brain,
        color: 'bg-blue-100 text-blue-600',
        title: `Quiz: ${metadata.quizTitle || metadata.description || 'General Quiz'}`,
        subtitle: metadata.quizScore !== undefined ? `${metadata.quizScore}% Score` : 'Complete'
      };
    case 'FLASHCARD_COMPLETE':
    case 'FLASHCARD_REVIEWED':
      return {
        icon: BookOpen,
        color: 'bg-purple-100 text-purple-600',
        title: `Flashcards: ${metadata.flashcardSetName || 'Study Session'}`,
        subtitle: metadata.cardsReviewed ? `${metadata.cardsReviewed} cards` : 'Reviewed'
      };
    case 'DAILY_LOGIN':
    case 'APP_ENTRY':
      return {
        icon: Award,
        color: 'bg-orange-100 text-orange-600',
        title: 'Daily Login Bonus',
        subtitle: 'Streak continued!'
      };
    case 'STREAK_BONUS':
      return {
        icon: Zap,
        color: 'bg-yellow-100 text-yellow-600',
        title: 'Streak Milestone!',
        subtitle: 'Bonus XP'
      };
    case 'GROUP_MESSAGE':
    case 'COMMUNITY_PARTICIPATION':
      return {
        icon: Users,
        color: 'bg-green-100 text-green-600',
        title: 'Community Contribution',
        subtitle: 'Active member'
      };
    case 'FILE_UPLOAD':
    case 'DOCUMENT_UPLOAD':
      return {
        icon: FileText,
        color: 'bg-indigo-100 text-indigo-600',
        title: 'Material Added',
        subtitle: metadata.filename || metadata.fileName || metadata.title || 'Uploaded'
      };
    case 'NOTE_SUMMARY':
      return {
        icon: FileText,
        color: 'bg-green-100 text-green-600',
        title: 'Note Summarized',
        subtitle: metadata.noteTitle || 'AI Summary generated'
      };
    case 'AI_TUTOR_USAGE':
      return {
        icon: Brain,
        color: 'bg-indigo-100 text-indigo-600',
        title: 'AI Tutor Session',
        subtitle: metadata.subject || 'Learning'
      };
    default:
      return {
        icon: Zap,
        color: 'bg-gray-100 text-gray-600',
        title: type.replace(/_/g, ' '),
        subtitle: metadata.description || 'Action completed'
      };
  }
};

export const DashboardPage: React.FC = () => {
  const { user, refreshUserStats } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalXp: 0,
    weeklyXp: 0,
    streak: 0,
    level: 1,
    badges: 0,
    todaysXp: 0,
    isStreakActive: false,
    dailyLoginXp: 0,
    streakXpToday: 0,
    streakDays: [] as { date: string; label: string; streak: boolean; loginXp: number; streakXp: number }[],
  });
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const buildStreakSummary = (history: any[]) => {
    const dayMap: Record<string, { streak: boolean; loginXp: number; streakXp: number }> = {};
    history.forEach((log) => {
      if (!log?.timestamp) return;
      const key = startOfDayKey(new Date(log.timestamp));
      if (!dayMap[key]) dayMap[key] = { streak: false, loginXp: 0, streakXp: 0 };
      if (log.activity_type === 'daily_login') {
        dayMap[key].loginXp += log.xp_earned || 0;
      }
      if (log.activity_type === 'DAILY_STREAK') {
        dayMap[key].streak = true;
        dayMap[key].streakXp += log.xp_earned || 0;
      }
    });

    const today = new Date();
    const days: { date: string; label: string; streak: boolean; loginXp: number; streakXp: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = startOfDayKey(d);
      const label = d.toLocaleDateString(undefined, { weekday: 'short' });
      const info = dayMap[key] || { streak: false, loginXp: 0, streakXp: 0 };
      days.push({ date: key, label, streak: info.streak, loginXp: info.loginXp, streakXp: info.streakXp });
    }

    const todayKey = startOfDayKey(today);
    return {
      dailyLoginXp: dayMap[todayKey]?.loginXp || 0,
      streakXpToday: dayMap[todayKey]?.streakXp || 0,
      streakDays: days,
    };
  };

  const fetchUserStats = async () => {
    try {
      // Trigger app entry logic once per load
      gamificationAPI.userEnter().catch(console.error);

      const [activityResponse, statsResponse, historyResponse] = await Promise.all([
        gamificationAPI.getUserActivity(),
        gamificationAPI.getProfileStats().catch(() => ({ data: { xp: 0, currentStreak: 0, isStreakActive: false } })),
        gamificationAPI.getXpHistory(60).catch(() => ({ data: { history: [] } }))
      ]);

      const activityData = activityResponse.data;
      const statsData = statsResponse.data;
      const historyData = historyResponse.data;

      const streakSummary = buildStreakSummary(historyData.history || []);

      setStats({
        totalXp: statsData.xp || activityData.totalXp || 0,
        weeklyXp: statsData.weeklyXp || 0,
        streak: statsData.currentStreak || activityData.currentStreak || 0,
        level: statsData.level || activityData.level || 1,
        badges: statsData.badges?.length || 0,
        todaysXp: activityData.todaysXp || 0,
        isStreakActive: statsData.isStreakActive || false,
        dailyLoginXp: streakSummary.dailyLoginXp,
        streakXpToday: streakSummary.streakXpToday,
        streakDays: streakSummary.streakDays,
      });

      setActivities(historyData.history || []);
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
      // Fallback to user object data
      setStats({
        totalXp: user?.total_xp || 0,
        weeklyXp: 0,
        streak: user?.current_streak || 0,
        level: user?.level || 1,
        badges: user?.badges?.length || 0,
        todaysXp: 0,
        isStreakActive: false,
        dailyLoginXp: 0,
        streakXpToday: 0,
        streakDays: [],
      });
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const initializeDashboard = async () => {
      setLoading(true);
      await fetchUserStats();
      setLoading(false);
    };

    initializeDashboard();

    // Set up polling to refresh stats every 30 seconds
    const interval = setInterval(async () => {
      await fetchUserStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [user, navigate]);

  // Also refresh when user XP changes (from other pages)
  useEffect(() => {
    if (user?.total_xp) {
      setStats((prev) => ({
        ...prev,
        totalXp: user.total_xp || 0,
        streak: user.current_streak || 0,
        level: user.level || 1,
        badges: user.badges?.length || prev.badges,
      }));
    }
  }, [user?.total_xp, user?.level, user?.current_streak, user?.badges]);

  const features = [
    {
      icon: Brain,
      title: 'Generate Quiz',
      description: 'Create AI-powered quizzes from any topic',
      route: '/quiz',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: BookOpen,
      title: 'Flashcard Sets',
      description: 'Create and manage organized flashcard collections',
      route: '/flashcards',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: MessageSquare,
      title: 'Chat & Groups',
      description: 'Real-time collaboration with peers',
      route: '/chat',
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: Zap,
      title: 'Co-Reader',
      description: 'Upload PDFs and get AI insights',
      route: '/co-reader',
      color: 'from-yellow-500 to-orange-500',
    },
    {
      icon: Award,
      title: 'Leaderboard',
      description: 'Track your progress and compete globally',
      route: '/leaderboard',
      color: 'from-indigo-500 to-purple-500',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <SOTWConfetti />

      <div className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="mb-12" data-tour="dashboard-main">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-gray-600 text-lg">
            {new Date().getHours() < 12
              ? 'Good morning! Time to learn something new.'
              : new Date().getHours() < 18
                ? 'Good afternoon! Keep up the momentum.'
                : 'Good evening! A great time to study.'}
          </p>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total XP</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{stats.totalXp}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Zap className="text-blue-600" size={24} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">+{stats.weeklyXp} this week</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Streak</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {stats.streak} {stats.isStreakActive ? 'Crushing it!' : 'Earn more XP daily!'}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Award className="text-orange-600" size={24} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {stats.isStreakActive ? 'Active streak!' : 'Login daily to maintain streak'}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] text-gray-600">
              <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                <Award size={12} /> Daily login +{stats.dailyLoginXp} XP
              </span>
              <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded-full">
                <Zap size={12} /> Streak XP +{stats.streakXpToday} XP
              </span>
            </div>
            {stats.streakDays.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-gray-500 mb-2">Last 7 days</div>
                <div className="grid grid-cols-7 gap-2 text-center">
                  {stats.streakDays.map((day) => (
                    <div key={day.date} className="space-y-1">
                      <div className={`mx-auto w-8 h-8 rounded-full border flex items-center justify-center text-[11px] font-semibold ${day.streak ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 text-gray-500'}`}>
                        {day.label.slice(0, 2)}
                      </div>
                      <div className="text-[10px] text-gray-500 leading-none">
                        {day.loginXp ? `+${day.loginXp}` : ''}{day.streakXp ? `/${day.streakXp}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Badges</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{stats.badges}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Award className="text-purple-600" size={24} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">Achievements unlocked</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Level</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.level}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <BookOpen className="text-green-600" size={24} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">Earn XP to level up</p>
          </div>
        </div>



        {/* Features Grid */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Learning Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <button
                  key={index}
                  onClick={() => navigate(feature.route)}
                  className="group bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:border-gray-300 transition-all text-left"
                >
                  <div className={`inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br ${feature.color} rounded-lg mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon size={24} className="text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600 text-sm">{feature.description}</p>
                  <div className="mt-4 flex items-center text-blue-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
                    Get Started →
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
            <button 
              onClick={() => navigate('/xp-history')}
              className="text-blue-600 text-sm font-medium hover:underline"
            >
              View Full History
            </button>
          </div>
          
          <div className="space-y-4">
            {activities.length > 0 ? (
              activities.slice(0, 5).map((activity, index) => {
                const details = getActivityDetails(activity);
                const ActivityIcon = details.icon;
                return (
                  <div key={activity._id || index} className={`flex items-center gap-4 ${index !== Math.min(activities.length, 5) - 1 ? 'pb-4 border-b border-gray-100' : ''}`}>
                    <div className={`w-10 h-10 ${details.color} rounded-full flex items-center justify-center flex-shrink-0`}>
                      <ActivityIcon size={20} />
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="text-gray-900 font-semibold truncate">{details.title}</p>
                      <p className="text-gray-500 text-sm flex items-center gap-1">
                        <Clock size={12} />
                        {formatRelativeTime(activity.timestamp)} • {details.subtitle}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-lg">
                        +{(activity.xp_earned || activity.xpEarned || 0)} XP
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="text-gray-300" size={32} />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No activity yet</h3>
                <p className="text-gray-500 text-sm">Activities will appear here as you learn.</p>
              </div>
            )}
          </div>
        </div>
      </div>


    </div>
  );
};
