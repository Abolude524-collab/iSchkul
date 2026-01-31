
import React, { useState, useEffect } from 'react';
import { X, Trophy, User, Clock, Calendar } from 'lucide-react';
import { getAPIEndpoint } from '../services/api';

interface LeaderboardEntry {
    rank: number;
    user: {
        id?: string;
        name: string;
        username: string;
    };
    score: number;
    percentage: number;
    timeSpent: number;
    completedAt: string;
}

interface LeaderboardModalProps {
    quizId: string;
    quizTitle: string;
    onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ quizId, quizTitle, onClose }) => {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({
        total: 0,
        pages: 1,
        perPage: 10
    });

    useEffect(() => {
        fetchLeaderboard(page);
    }, [quizId, page]);

    const fetchLeaderboard = async (pageNum: number) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('authToken');
            const response = await fetch(getAPIEndpoint(`/quizzes/${quizId}/leaderboard?page=${pageNum}&limit=${pagination.perPage}`), {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch leaderboard');
            }

            const data = await response.json();
            // Backend now returns object with leaderboard array and pagination metadata
            if (data.pagination) {
                setLeaderboard(data.leaderboard);
                setPagination(data.pagination);
            } else {
                // Fallback for old response format
                setLeaderboard(data.leaderboard || []);
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePrevPage = () => {
        if (page > 1) setPage(p => p - 1);
    };

    const handleNextPage = () => {
        if (page < pagination.pages) setPage(p => p + 1);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    const startIdx = (page - 1) * pagination.perPage + 1;
    const endIdx = Math.min(startIdx + pagination.perPage - 1, pagination.total);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Trophy className="text-yellow-500" size={24} />
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Leaderboard</h2>
                            <p className="text-sm text-gray-500">{quizTitle}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : error ? (
                        <div className="text-center text-red-500 py-8">{error}</div>
                    ) : leaderboard.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">No attempts yet. Be the first!</div>
                    ) : (
                        <div className="space-y-2">
                            {leaderboard.map((entry) => (
                                <div
                                    key={`${entry.rank}-${entry.completedAt}`}
                                    className={`flex items-center p-4 rounded-lg border ${entry.rank === 1 ? 'bg-yellow-50 border-yellow-200' :
                                        entry.rank === 2 ? 'bg-gray-50 border-gray-200' :
                                            entry.rank === 3 ? 'bg-orange-50 border-orange-200' :
                                                'bg-white border-gray-100'
                                        }`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-4 ${entry.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                                        entry.rank === 2 ? 'bg-gray-200 text-gray-700' :
                                            entry.rank === 3 ? 'bg-orange-100 text-orange-700' :
                                                'bg-gray-100 text-gray-500'
                                        }`}>
                                        {entry.rank}
                                    </div>

                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                                            {entry.user.name}
                                            {entry.user.username === 'Guest' && (
                                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Guest</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center gap-3 mt-1">
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} /> {formatTime(entry.timeSpent)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar size={12} /> {new Date(entry.completedAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className={`text-lg font-bold ${entry.percentage >= 80 ? 'text-green-600' :
                                            entry.percentage >= 60 ? 'text-blue-600' :
                                                'text-gray-600'
                                            }`}>
                                            {entry.percentage.toFixed(0)}%
                                        </div>
                                        <div className="text-xs text-gray-500">{entry.score} pts</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                {!loading && !error && leaderboard.length > 0 && (
                    <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-between items-center">
                        <div className="text-sm text-gray-600">
                            Showing <span className="font-medium">{startIdx}</span> to <span className="font-medium">{endIdx}</span> of <span className="font-medium">{pagination.total}</span> entries
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handlePrevPage}
                                disabled={page === 1}
                                className={`px-3 py-1 text-sm rounded-md border ${page === 1
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                Previous
                            </button>
                            <button
                                onClick={handleNextPage}
                                disabled={page === pagination.pages}
                                className={`px-3 py-1 text-sm rounded-md border ${page === pagination.pages
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
