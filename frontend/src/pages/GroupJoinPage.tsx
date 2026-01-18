import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { groupAPI } from '../services/api';
import { useAuthStore } from '../services/store';

interface Group {
  _id: string;
  name: string;
  description: string;
  category: string;
  isPrivate: boolean;
  tags: string[];
  members: any[];
  createdBy: string;
  createdAt: string;
}

export const GroupJoinPage: React.FC = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (inviteCode) {
      loadGroupPreview();
    }
  }, [inviteCode]);

  const loadGroupPreview = async () => {
    try {
      // For now, we'll try to join and see if it works
      // In a real implementation, you might want a separate endpoint to preview group info
      setLoading(false);
    } catch (err: any) {
      setError('Invalid or expired invite link');
      setLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!inviteCode) return;

    setJoining(true);
    setError('');

    try {
      await groupAPI.joinGroup(inviteCode);
      setSuccess(true);
      setTimeout(() => {
        navigate('/groups');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-green-500 text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to the group!</h2>
          <p className="text-gray-600">You have successfully joined the group. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md mx-4">
        <div className="text-center mb-6">
          <div className="text-blue-500 text-6xl mb-4">👥</div>
          <h1 className="text-2xl font-bold text-gray-900">Join Study Group</h1>
          <p className="text-gray-600 mt-2">
            You've been invited to join a study group
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              Invite Code: <code className="bg-gray-100 px-2 py-1 rounded">{inviteCode}</code>
            </p>
          </div>

          <button
            onClick={handleJoinGroup}
            disabled={joining}
            className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {joining ? 'Joining...' : 'Join Group'}
          </button>

          <button
            onClick={() => navigate('/groups')}
            className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
          >
            Back to Groups
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>By joining, you agree to follow the group rules and community guidelines.</p>
        </div>
      </div>
    </div>
  );
};