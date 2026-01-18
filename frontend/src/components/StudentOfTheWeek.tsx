import React, { useState, useEffect, useRef } from 'react';
import { sotwAPI } from '../services/api';
import { Crown, Trophy, Calendar, Award, Sparkles, Download } from 'lucide-react';
import html2canvas from 'html2canvas';

interface SOTW {
  user_id: string;
  name: string;
  user: {
    name: string;
    institution: string;
    profilePicture?: string;
    username: string;
  };
  institution: string;
  weekly_score: number;
  start_date: string;
  end_date: string;
  winner_quote: string;
}

interface CurrentSOTW {
  current: SOTW | null;
  previous: SOTW[];
}

// Helper to get initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const StudentOfTheWeek: React.FC = () => {
  const [sotwData, setSotwData] = useState<CurrentSOTW | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSOTWData();
  }, []);

  const loadSOTWData = async () => {
    try {
      setLoading(true);
      const [currentResponse, archiveResponse] = await Promise.all([
        sotwAPI.getCurrent(),
        sotwAPI.getArchive()
      ]);
      
      // If no current winner (week still ongoing), show the most recent from archive
      const current = currentResponse.data.winner || (archiveResponse.data.archive?.[0] || null);
      
      setSotwData({
        current,
        previous: archiveResponse.data.archive || []
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadCard = async () => {
    if (!cardRef.current || !sotwData?.current) return;

    try {
      setDownloading(true);
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true
      });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `SOTW-${sotwData.current.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.png`;
      link.click();
    } catch (error) {
      console.error('Failed to download card:', error);
      alert('Failed to download card. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2">
          <Crown className="text-yellow-500" size={24} />
          <h3 className="text-xl font-bold text-gray-900">Student of the Week</h3>
        </div>
        {sotwData?.current && (
          <button
            onClick={downloadCard}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            title="Download SOTW card as image"
          >
            <Download size={18} />
            {downloading ? 'Downloading...' : 'Download'}
          </button>
        )}
      </div>

      {sotwData?.current ? (
        <div className="mb-6">
          <div ref={cardRef} className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-6 text-white shadow-lg">
            {/* iSchkul SOTW Header */}
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/30">
              <Sparkles size={20} className="text-white" />
              <span className="text-sm font-bold uppercase tracking-wide">iSchkul Student of the Week</span>
            </div>

            {/* Winner Card */}
            <div className="flex items-center gap-4 mb-6">
              {/* Profile Picture or Initials */}
              {sotwData.current.user?.profilePicture ? (
                <img
                  src={sotwData.current.user.profilePicture}
                  alt={sotwData.current.name}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white/40"
                />
              ) : (
                <div className="w-20 h-20 bg-white/30 rounded-full flex items-center justify-center border-4 border-white/40">
                  <span className="text-3xl font-bold text-white">
                    {getInitials(sotwData.current.name)}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <h4 className="text-2xl font-bold">{sotwData.current.name}</h4>
                <p className="text-yellow-100">{sotwData.current.institution}</p>
              </div>
              <Trophy size={40} className="text-white opacity-80" />
            </div>

            {/* Stats */}
            <div className="space-y-3 bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Award size={16} className="text-white" />
                <span className="font-semibold">{sotwData.current.weekly_score} XP earned</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-white" />
                <span>
                  {new Date(sotwData.current.start_date).toLocaleDateString()} - {new Date(sotwData.current.end_date).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Achievement Badge */}
            <div className="mt-4 flex items-center gap-2 justify-center">
              <span className="inline-flex items-center gap-2 bg-white/25 px-4 py-2 rounded-full text-sm font-semibold backdrop-blur-sm">
                <Crown size={16} />
                🏆 Weekly Champion 🏆
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <Trophy size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No Student of the Week selected yet.</p>
          <p className="text-sm text-gray-400 mt-1">Check back next week!</p>
        </div>
      )}

      {/* Previous Winners */}
      {sotwData?.previous && sotwData.previous.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Previous Winners</h4>
          <div className="space-y-3">
            {sotwData.previous.slice(0, 5).map((winner, index) => (
              <div key={winner._id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{winner.name}</p>
                  <p className="text-sm text-gray-500">{winner.weekly_score} XP • {new Date(winner.start_date).toLocaleDateString()}</p>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  Winner
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};