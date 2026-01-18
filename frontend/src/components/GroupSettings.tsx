import React, { useState } from 'react';
import { groupAPI } from '../services/api';

interface Group {
  _id: string;
  name: string;
  description: string;
  category: string;
  isPrivate: boolean;
  tags: string[];
  members: any[];
  inviteLink?: {
    code: string;
    expiresAt: string;
    maxUses: number;
    currentUses: number;
  };
  createdBy: string;
  createdAt: string;
}

interface GroupSettingsProps {
  group: Group;
  onClose: () => void;
  onUpdate: () => void;
}

export const GroupSettings: React.FC<GroupSettingsProps> = ({
  group,
  onClose,
  onUpdate
}) => {
  const [formData, setFormData] = useState({
    name: group.name,
    description: group.description,
    category: group.category,
    isPrivate: group.isPrivate,
    tags: group.tags.join(', ')
  });
  const [inviteLink, setInviteLink] = useState(group.inviteLink);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const updateData = {
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };

      await groupAPI.updateGroup(group._id, updateData);
      setSuccess('Group updated successfully');
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update group');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInviteLink = async () => {
    try {
      const response = await groupAPI.generateInviteLink(group._id, {
        expiresInDays: 7,
        maxUses: 50
      });
      setInviteLink(response.data.inviteLink);
      setSuccess('Invite link generated successfully');
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate invite link');
    }
  };

  const handleRevokeInviteLink = async () => {
    if (!confirm('Are you sure you want to revoke the current invite link?')) return;

    try {
      await groupAPI.revokeInviteLink(group._id);
      setInviteLink(undefined);
      setSuccess('Invite link revoked successfully');
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to revoke invite link');
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) return;

    try {
      await groupAPI.deleteGroup(group._id);
      setSuccess('Group deleted successfully');
      // Redirect to groups list
      window.location.href = '/groups';
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete group');
    }
  };

  const copyInviteLink = () => {
    if (inviteLink) {
      const link = `${window.location.origin}/groups/join/${inviteLink.code}`;
      navigator.clipboard.writeText(link);
      setSuccess('Invite link copied to clipboard');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">Group Settings</h2>
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

      {/* Settings Form */}
      <div className="flex-1 overflow-y-auto p-4">
        <form onSubmit={handleUpdateGroup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="study">Study Group</option>
              <option value="project">Project Group</option>
              <option value="general">General</option>
              <option value="gaming">Gaming</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="math, physics, homework"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isPrivate"
              checked={formData.isPrivate}
              onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isPrivate" className="ml-2 text-sm text-gray-700">
              Private Group
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Group'}
          </button>
        </form>

        {/* Invite Link Section */}
        <div className="mt-8 pt-6 border-t">
          <h3 className="text-md font-medium text-gray-900 mb-4">Invite Link</h3>

          {inviteLink ? (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={`${window.location.origin}/groups/join/${inviteLink.code}`}
                  readOnly
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-sm"
                />
                <button
                  onClick={copyInviteLink}
                  className="bg-gray-500 text-white px-3 py-2 rounded-md hover:bg-gray-600 text-sm"
                >
                  Copy
                </button>
              </div>
              <div className="text-sm text-gray-600">
                <p>Expires: {new Date(inviteLink.expiresAt).toLocaleDateString()}</p>
                <p>Uses: {inviteLink.currentUses}/{inviteLink.maxUses}</p>
              </div>
              <button
                onClick={handleRevokeInviteLink}
                className="w-full bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600"
              >
                Revoke Link
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateInviteLink}
              className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600"
            >
              Generate Invite Link
            </button>
          )}
        </div>

        {/* Danger Zone */}
        <div className="mt-8 pt-6 border-t">
          <h3 className="text-md font-medium text-red-900 mb-4">Danger Zone</h3>
          <button
            onClick={handleDeleteGroup}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700"
          >
            Delete Group
          </button>
        </div>
      </div>
    </div>
  );
};