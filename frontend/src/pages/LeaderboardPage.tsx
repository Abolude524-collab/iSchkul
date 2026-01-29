import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuthStore } from '../services/store';
import { leaderboardAPI, gamificationAPI } from '../services/api';
import { Trophy, Users, Calendar, Award, Crown, Target, TrendingUp, Medal } from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  institution: string;
  total_xp: number; // All-time total XP
  xp?: number; // Weekly XP (for Global Competition)
  weeklyXp?: number; // Alternative field name
  avatar?: string;
}

interface WeeklyLeaderboard {
  _id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  prizes: Array<{ rank: number; description: string } | string>;
  rankings: LeaderboardEntry[];
}

export const LeaderboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all-time' | 'weekly'>('weekly');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState<WeeklyLeaderboard | null>(null);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [isParticipating, setIsParticipating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load all-time leaderboard
      const leaderboardRes = await gamificationAPI.getLeaderboard();
      setLeaderboard(leaderboardRes.data.leaderboard);

      // Find user's rank in all-time leaderboard
      const userEntry = leaderboardRes.data.leaderboard.find((entry: LeaderboardEntry) => entry.id === user?.id);
      setUserRank(userEntry || null);

      // Load weekly leaderboard (Global Competition)
      const weeklyRes = await leaderboardAPI.getActiveLeaderboard();
      if (weeklyRes.data.leaderboard) {
        setWeeklyLeaderboard(weeklyRes.data.leaderboard);
        // Check if user is participating
        if (weeklyRes.data.leaderboard.rankings) {
          setIsParticipating(weeklyRes.data.leaderboard.rankings.some((r: LeaderboardEntry) => r.id === user?.id));
        }
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWeeklyLeaderboard = async () => {
    if (!weeklyLeaderboard) return;
    try {
      await leaderboardAPI.joinLeaderboard(weeklyLeaderboard._id);
      setIsParticipating(true);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLeaveWeeklyLeaderboard = async () => {
    if (!weeklyLeaderboard) return;
    try {
      await leaderboardAPI.leaveLeaderboard(weeklyLeaderboard._id);
      setIsParticipating(false);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="text-yellow-500 w-4 h-4 sm:w-5 sm:h-5" />;
      case 2:
        return <Medal className="text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />;
      case 3:
        return <Award className="text-amber-600 w-4 h-4 sm:w-5 sm:h-5" />;
      default:
        return <span className="text-gray-500 font-bold text-xs sm:text-sm">#{rank}</span>;
    }
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-yellow-600';
      case 2:
        return 'bg-gradient-to-r from-gray-300 to-gray-500';
      case 3:
        return 'bg-gradient-to-r from-amber-400 to-amber-600';
      default:
        return 'bg-gray-100';
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

      <div className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-2 sm:mb-4">
            🏆 Leaderboards
          </h1>
          <p className="text-gray-600 text-sm sm:text-base md:text-lg">
            Compete with fellow students and climb the ranks!
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-4 sm:mb-6">
          <button
            onClick={() => setActiveTab('weekly')}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg text-sm sm:text-base font-semibold transition-colors ${
              activeTab === 'weekly'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Global Weekly Competition
          </button>
          <button
            onClick={() => setActiveTab('all-time')}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg text-sm sm:text-base font-semibold transition-colors ${
              activeTab === 'all-time'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            All-Time Rankings
          </button>
        </div>

        {/* Weekly Leaderboard Card */}
        {activeTab === 'weekly' && weeklyLeaderboard && (
          <div className="mb-8 sm:mb-12">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-4 sm:p-6 text-white mb-4 sm:mb-6">
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold mb-2">{weeklyLeaderboard.title}</h2>
                  <p className="text-purple-100 text-sm sm:text-base">{weeklyLeaderboard.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div className="flex items-center gap-1">
                    <Calendar size={16} className="sm:w-4 sm:h-4" />
                    <span>Ends {new Date(weeklyLeaderboard.endDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users size={16} className="sm:w-4 sm:h-4" />
                    <span>{weeklyLeaderboard.rankings?.length || 0} participants</span>
                  </div>
                </div>

                {weeklyLeaderboard.prizes && weeklyLeaderboard.prizes.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 text-sm sm:text-base">Prizes:</h3>
                    <ul className="text-xs sm:text-sm space-y-1">
                      {weeklyLeaderboard.prizes.slice(0, 3).map((prize, idx) => {
                        const key = typeof prize === 'string' ? `prize-${idx}-${prize}` : `prize-${prize.rank}-${idx}`;
                        return (
                          <li key={key}>🏆 {typeof prize === 'string' ? prize : prize.description}</li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {isParticipating && (
                  <button
                    onClick={handleLeaveWeeklyLeaderboard}
                    className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm sm:text-base font-semibold transition-colors"
                  >
                    Leave Competition
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* All-Time Rankings */}
        {activeTab === 'all-time' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">All-Time Leaderboard</h3>
                {userRank && (
                  <div className="text-left sm:text-right">
                    <p className="text-xs sm:text-sm text-gray-500">Your Rank</p>
                    <p className="text-xl sm:text-2xl font-bold text-blue-600">#{userRank.rank}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {leaderboard.slice(0, 20).map((entry, idx) => (
                <div key={`alltime-${entry.id}-${idx}`} className={`p-3 sm:p-4 flex items-center gap-2 sm:gap-4 ${entry.id === user?.id ? 'bg-blue-50' : ''}`}>
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getRankBadgeColor(entry.rank)}`}>
                    {getRankIcon(entry.rank)}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">{entry.name}</p>
                    <p className="text-xs sm:text-sm text-gray-500 truncate">{entry.institution}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900 text-sm sm:text-base">{entry.total_xp} XP</p>
                    {entry.id === user?.id && (
                      <span className="text-xs text-blue-600 font-semibold">You</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weekly Competition Rankings */}
        {activeTab === 'weekly' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">Competition Rankings</h3>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">XP earned during the competition period</p>
            </div>
            {!weeklyLeaderboard || !weeklyLeaderboard.rankings || weeklyLeaderboard.rankings.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <Trophy size={48} className="text-gray-300 mx-auto mb-4 sm:w-16 sm:h-16" />
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No Active Competition</h3>
                <p className="text-sm sm:text-base text-gray-600">Check back later for upcoming competitions!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {weeklyLeaderboard.rankings.map((entry, idx) => {
                  const weeklyXp = entry.xp || entry.weeklyXp || 0;
                  return (
                    <div key={`weekly-${entry.id}-${idx}`} className={`p-3 sm:p-4 flex items-center gap-2 sm:gap-4 ${entry.id === user?.id ? 'bg-blue-50' : ''}`}>
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getRankBadgeColor(entry.rank)}`}>
                        {getRankIcon(entry.rank)}
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">{entry.name}</p>
                        <p className="text-xs sm:text-sm text-gray-500">{weeklyXp} XP earned</p>
                      </div>
                      {entry.id === user?.id && (
                        <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                          You
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};