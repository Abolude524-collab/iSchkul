import React, { useState } from 'react';
import { groupAPI } from '../services/api';
import { useAuthStore } from '../services/store';

interface GroupMember {
  userId: string;
  username: string;
  email: string;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: string;
}

interface Group {
  _id: string;
  name: string;
  description: string;
  category: string;
  isPrivate: boolean;
  tags: string[];
  members: GroupMember[];
  inviteLink?: {
    code: string;
    expiresAt: string;
    maxUses: number;
    currentUses: number;
  };
  createdBy: string;
  createdAt: string;
}

interface GroupMemberListProps {
  group: Group;
  currentUserId: string;
  onClose: () => void;
  onRoleUpdate: () => void;
}

export const GroupMemberList: React.FC<GroupMemberListProps> = ({
  group,
  currentUserId,
  onClose,
  onRoleUpdate
}) => {
  const { user } = useAuthStore();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const currentUserRole = group.members.find(m => m.userId === currentUserId)?.role;
  const isAdmin = currentUserRole === 'admin';
  const isModerator = currentUserRole === 'moderator';

  const canManageMember = (memberRole: string) => {
    if (isAdmin) return true;
    if (isModerator && memberRole === 'member') return true;
    return false;
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await groupAPI.updateMemberRole(group._id, userId, { role: newRole });
      setSuccess('Role updated successfully');
      onRoleUpdate();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update role');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      await groupAPI.removeMember(group._id, userId);
      setSuccess('Member removed successfully');
      onRoleUpdate();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove member');
      setTimeout(() => setError(''), 3000);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-red-600 bg-red-100';
      case 'moderator': return 'text-blue-600 bg-blue-100';
      case 'member': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">Group Members</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
          title="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-3 bg-red-50 border-l-4 border-red-400 text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border-l-4 border-green-400 text-green-700">
          {success}
        </div>
      )}

      {/* Members List */}
      <div className="flex-1 overflow-y-auto">
        {group.members?.map((member) => (
          <div key={member.userId} className="p-4 border-b hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">{member.username}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${getRoleColor(member.role)}`}>
                    {member.role}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{member.email}</p>
                <p className="text-xs text-gray-400">
                  Joined {new Date(member.joinedAt).toLocaleDateString()}
                </p>
              </div>

              {/* Role Management */}
              {canManageMember(member.role) && member.userId !== currentUserId && (
                <div className="flex flex-col space-y-1">
                  {member.role !== 'admin' && (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                      className="text-xs border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="member">Member</option>
                      {isAdmin && <option value="moderator">Moderator</option>}
                      {isAdmin && <option value="admin">Admin</option>}
                    </select>
                  )}

                  {member.role !== 'admin' && (
                    <button
                      onClick={() => handleRemoveMember(member.userId)}
                      className="text-xs text-red-600 hover:text-red-800 px-2 py-1 border border-red-300 rounded hover:bg-red-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Member Count */}
      <div className="p-4 border-t bg-gray-50">
        <p className="text-sm text-gray-600">
          {group.members?.length || 0} member{(group.members?.length || 0) !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
};