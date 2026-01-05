import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { StudentOfTheWeek } from '../components/StudentOfTheWeek';
import { useAuthStore } from '../services/store';
import { gamificationAPI } from '../services/api';
import { BookOpen, MessageSquare, Zap, Award, Users, Brain } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalXp: 0,
    streak: 0,
    badges: 0,
    cardsReviewed: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchUserStats = async () => {
    try {
      const response = await gamificationAPI.getUserStats();
      setStats({
        totalXp: response.data.totalXp,
        streak: response.data.streak,
        badges: response.data.badges.length,
        cardsReviewed: response.data.cardsReviewed || 0,
      });
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
      // Fallback to user object data
      setStats({
        totalXp: user?.total_xp || 0,
        streak: user?.current_streak || 0,
        badges: user?.badges?.length || 0,
        cardsReviewed: 0,
      });
    }
  };

  const awardDailyXP = async () => {
    try {
      await gamificationAPI.awardXP('DAILY_STREAK');
      // Refresh stats after awarding XP
      await fetchUserStats();
    } catch (error) {
      console.error('Failed to award daily XP:', error);
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
      await awardDailyXP();
      setLoading(false);
    };

    initializeDashboard();
  }, [user, navigate]);

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
      route: '/flashcard-sets',
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
      icon: Users,
      title: 'Social',
      description: 'Follow peers and compete on leaderboards',
      route: '/social',
      color: 'from-orange-500 to-red-500',
    },
    {
      icon: Zap,
      title: 'Co-Reader',
      description: 'Upload PDFs and get AI insights',
      route: '/reader',
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
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <div className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-gray-600 text-lg">
            {new Date().getHours() < 12
              ? '🌅 Good morning! Time to learn something new.'
              : new Date().getHours() < 18
              ? '☀️ Good afternoon! Keep up the momentum.'
              : '🌙 Good evening! A great time to study.'}
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
            <p className="text-xs text-gray-500 mt-4">+500 this week</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Streak</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{stats.streak} 🔥</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Award className="text-orange-600" size={24} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">Keep it going!</p>
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
                <p className="text-gray-600 text-sm font-medium">Cards Reviewed</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.cardsReviewed}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <BookOpen className="text-green-600" size={24} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">This month</p>
          </div>
        </div>

        {/* Student of the Week */}
        <div className="mb-12">
          <StudentOfTheWeek />
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
          <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Activity</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Brain size={20} className="text-blue-600" />
              </div>
              <div className="flex-grow">
                <p className="text-gray-900 font-medium">Quiz Completed: Calculus Fundamentals</p>
                <p className="text-gray-500 text-sm">Today at 2:30 PM • 85% Score</p>
              </div>
              <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">+150 XP</span>
            </div>

            <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <BookOpen size={20} className="text-purple-600" />
              </div>
              <div className="flex-grow">
                <p className="text-gray-900 font-medium">Flashcard Session: Biology</p>
                <p className="text-gray-500 text-sm">Yesterday • 24 cards reviewed</p>
              </div>
              <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">+48 XP</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Users size={20} className="text-green-600" />
              </div>
              <div className="flex-grow">
                <p className="text-gray-900 font-medium">Joined Study Group: Physics 101</p>
                <p className="text-gray-500 text-sm">2 days ago</p>
              </div>
              <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">+10 XP</span>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};
