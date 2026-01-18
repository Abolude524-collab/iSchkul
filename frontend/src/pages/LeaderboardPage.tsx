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
  total_xp: number;
  avatar?: string;
}

interface GlobalLeaderboard {
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
  const [activeTab, setActiveTab] = useState<'global' | 'all-time'>('all-time');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<GlobalLeaderboard | null>(null);
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

      // Load global leaderboard
      const globalRes = await leaderboardAPI.getActiveLeaderboard();
      setGlobalLeaderboard(globalRes.data.leaderboard);

      // Check if user is participating in global leaderboard
      if (globalRes.data.leaderboard && globalRes.data.leaderboard.rankings) {
        setIsParticipating(globalRes.data.leaderboard.rankings.some((r: LeaderboardEntry) => r.id === user?.id));
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGlobalLeaderboard = async () => {
    if (!globalLeaderboard) return;

    try {
      await leaderboardAPI.joinLeaderboard(globalLeaderboard._id);
      setIsParticipating(true);
      await loadData(); // Refresh data
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLeaveGlobalLeaderboard = async () => {
    if (!globalLeaderboard) return;

    try {
      await leaderboardAPI.leaveLeaderboard(globalLeaderboard._id);
      setIsParticipating(false);
      await loadData(); // Refresh data
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="text-yellow-500" size={20} />;
      case 2:
        return <Medal className="text-gray-400" size={20} />;
      case 3:
        return <Award className="text-amber-600" size={20} />;
      default:
        return <span className="text-gray-500 font-bold">#{rank}</span>;
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

      <div className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            🏆 Leaderboards
          </h1>
          <p className="text-gray-600 text-lg">
            Compete with fellow students and climb the ranks!
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Global Leaderboard Section */}
        {globalLeaderboard && (
          <div className="mb-12">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{globalLeaderboard.title}</h2>
                  <p className="text-purple-100 mb-4">{globalLeaderboard.description}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar size={16} />
                      <span>Ends {new Date(globalLeaderboard.endDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users size={16} />
                      <span>{globalLeaderboard.rankings?.length || 0} participants</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {globalLeaderboard.prizes.length > 0 && (
                    <div className="mb-4">
                      <h3 className="font-semibold mb-2">Prizes:</h3>
                      <ul className="text-sm space-y-1">
                        {globalLeaderboard.prizes.slice(0, 3).map((prize, idx) => {
                          const key = typeof prize === 'string' ? `prize-${idx}-${prize}` : `prize-${prize.rank}-${idx}`;
                          return (
                            <li key={key}>🏆 {typeof prize === 'string' ? prize : prize.description}</li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  {!isParticipating ? (
                    <button
                      onClick={handleJoinGlobalLeaderboard}
                      className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                    >
                      Join Competition
                    </button>
                  ) : (
                    <button
                      onClick={handleLeaveGlobalLeaderboard}
                      className="bg-red-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors"
                    >
                      Leave Competition
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Global Leaderboard Rankings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">Current Rankings</h3>
              </div>
              <div className="divide-y divide-gray-200">
              {globalLeaderboard.rankings?.slice(0, 10).map((entry, idx) => (
                <div key={`global-${entry.id}-${idx}`} className={`p-4 flex items-center gap-4 ${entry.id === user?.id ? 'bg-blue-50' : ''}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getRankBadgeColor(entry.rank)}`}>
                      {getRankIcon(entry.rank)}
                    </div>
                    <div className="flex-grow">
                      <p className="font-semibold text-gray-900">{entry.name}</p>
                      <p className="text-sm text-gray-500">{entry.total_xp} XP earned</p>
                    </div>
                    {entry.id === user?.id && (
                      <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6">
          <button
            onClick={() => setActiveTab('all-time')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'all-time'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            All-Time Rankings
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'global'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Global Competition
          </button>
        </div>

        {/* All-Time Leaderboard */}
        {activeTab === 'all-time' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">All-Time Leaderboard</h3>
                {userRank && (
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Your Rank</p>
                    <p className="text-2xl font-bold text-blue-600">#{userRank.rank}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {leaderboard.slice(0, 20).map((entry, idx) => (
                <div key={`alltime-${entry.id}-${idx}`} className={`p-4 flex items-center gap-4 ${entry.id === user?.id ? 'bg-blue-50' : ''}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getRankBadgeColor(entry.rank)}`}>
                    {getRankIcon(entry.rank)}
                  </div>
                  <div className="flex-grow">
                    <p className="font-semibold text-gray-900">{entry.name}</p>
                    <p className="text-sm text-gray-500">{entry.institution}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{entry.total_xp} XP</p>
                    {entry.id === user?.id && (
                      <span className="text-xs text-blue-600 font-semibold">You</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Global Competition Tab */}
        {activeTab === 'global' && (
          <div className="space-y-6">
            {!globalLeaderboard ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Trophy size={64} className="text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Active Competition</h3>
                <p className="text-gray-600">Check back later for upcoming leaderboard competitions!</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900">Competition Rankings</h3>
                  <p className="text-gray-600 mt-1">XP earned during the competition period</p>
                </div>
                <div className="divide-y divide-gray-200">
                  {globalLeaderboard.rankings?.map((entry, idx) => (
                    <div key={`comp-${entry.id}-${idx}`} className={`p-4 flex items-center gap-4 ${entry.id === user?.id ? 'bg-blue-50' : ''}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getRankBadgeColor(entry.rank)}`}>
                        {getRankIcon(entry.rank)}
                      </div>
                      <div className="flex-grow">
                        <p className="font-semibold text-gray-900">{entry.name}</p>
                        <p className="text-sm text-gray-500">{entry.total_xp} XP earned</p>
                      </div>
                      {entry.id === user?.id && (
                        <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full">
                          You
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};