import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupAPI, personalChatAPI } from '../services/api';
import { useAuthStore } from '../services/store';
import { Navbar } from '../components/Navbar';

interface Group {
  _id: string;
  name: string;
  description: string;
  category: string;
  isPrivate: boolean;
  tags: string[];
  members: any[];
  inviteLink?: any;
  createdBy: string;
  createdAt: string;
}

interface User {
  _id: string;
  name: string;
  username: string;
  email: string;
  avatar?: string;
}

export const GroupsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    category: 'study',
    isPrivate: false,
    tags: '',
    memberIds: [] as string[]
  });
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const response = await groupAPI.getGroups();
      setGroups(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async (query: string = '') => {
    setLoadingUsers(true);
    try {
      // Get contacts from personal chat list
      const chatResponse = await personalChatAPI.listChats();
      const chats = Array.isArray(chatResponse.data?.chats) ? chatResponse.data.chats :
        Array.isArray(chatResponse.chats) ? chatResponse.chats :
          Array.isArray(chatResponse.data) ? chatResponse.data : [];

      // Extract other participants from chats
      let contacts = chats
        .map((chat: any) => chat?.otherParticipant)
        .filter((p: any) => p && p._id !== user?._id);

      // Remove duplicates
      contacts = Array.from(new Map(contacts.map((c: any) => [c._id, c])).values());

      // Filter by search query if provided
      if (query.trim()) {
        const lowerQuery = query.toLowerCase();
        contacts = contacts.filter((c: any) =>
          c.name?.toLowerCase().includes(lowerQuery) ||
          c.username?.toLowerCase().includes(lowerQuery)
        );
      }

      setAvailableUsers(contacts);
    } catch (err: any) {
      console.error('Failed to load contacts:', err);
      setAvailableUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddMember = (userId: string, userName: string) => {
    if (!createForm.memberIds.includes(userId)) {
      setCreateForm(prev => ({
        ...prev,
        memberIds: [...prev.memberIds, userId]
      }));
    }
  };

  const handleRemoveMember = (userId: string) => {
    setCreateForm(prev => ({
      ...prev,
      memberIds: prev.memberIds.filter(id => id !== userId)
    }));
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingGroup(true);
    try {
      const groupData = {
        ...createForm,
        tags: createForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };

      const response = await groupAPI.createGroup(groupData);
      setGroups(prev => [response.data.group, ...prev]);
      setShowCreateForm(false);
      setCreateForm({
        name: '',
        description: '',
        category: 'study',
        isPrivate: false,
        tags: '',
        memberIds: []
      });
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleJoinGroup = async (inviteCode: string) => {
    const code = prompt('Enter invite code:');
    if (!code) return;

    try {
      await groupAPI.joinGroup(code);
      loadGroups(); // Refresh to show new group
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to join group');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Study Groups</h1>
            <p className="text-gray-600 mt-2">Connect with fellow students and collaborate on projects</p>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => handleJoinGroup('')}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
            >
              Join Group
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              Create Group
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700">
            {error}
          </div>
        )}

        {/* Create Group Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4">Create New Group</h2>
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={createForm.category}
                      onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
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
                    <label className="flex items-center mt-6">
                      <input
                        type="checkbox"
                        id="isPrivate"
                        checked={createForm.isPrivate}
                        onChange={(e) => setCreateForm({ ...createForm, isPrivate: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Private Group</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={createForm.tags}
                    onChange={(e) => setCreateForm({ ...createForm, tags: e.target.value })}
                    placeholder="math, physics, homework"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">
                    Add Members <span className="text-gray-500 font-normal">(Optional)</span>
                  </h3>
                  <p className="text-xs text-gray-600 mb-3">
                    Select from your connected contacts to add them to the group.
                  </p>

                  {/* Member Search */}
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Search your contacts by name..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        loadAvailableUsers(e.target.value);
                      }}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                    />

                    {/* User Search Results */}
                    {searchQuery && (
                      <div className="border border-gray-300 rounded-md bg-white max-h-40 overflow-y-auto">
                        {loadingUsers ? (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            Loading users...
                          </div>
                        ) : availableUsers.length > 0 ? (
                          availableUsers.map((user) => (
                            <div
                              key={user._id}
                              className="p-3 border-b last:border-b-0 flex items-center justify-between hover:bg-gray-50"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                                <p className="text-xs text-gray-600">@{user.username}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddMember(user._id, user.name)}
                                disabled={createForm.memberIds.includes(user._id)}
                                className={`px-3 py-1 rounded text-sm font-medium ${createForm.memberIds.includes(user._id)
                                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-500 text-white hover:bg-blue-600'
                                  }`}
                              >
                                {createForm.memberIds.includes(user._id) ? 'Added' : 'Add'}
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            No contacts found matching that search
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selected Members */}
                  {createForm.memberIds.length > 0 && (
                    <div className="mb-3 p-3 bg-blue-50 rounded-md">
                      <p className="text-xs text-blue-900 font-medium mb-2">
                        {createForm.memberIds.length} member(s) selected:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {createForm.memberIds.map((memberId) => {
                          const member = availableUsers.find(u => u._id === memberId);
                          return (
                            <div
                              key={memberId}
                              className="inline-flex items-center gap-2 bg-blue-200 text-blue-900 px-3 py-1 rounded-full text-sm"
                            >
                              <span>{member?.name || memberId}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(memberId)}
                                className="text-blue-900 hover:text-blue-700 font-semibold"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-600">
                    💡 Tip: You can also add members later using the invite link or by manually inviting them.
                  </p>
                </div>

                <div className="flex space-x-3 pt-4 border-t">
                  <button
                    type="submit"
                    disabled={creatingGroup || !createForm.name.trim()}
                    className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {creatingGroup ? 'Creating...' : 'Create Group'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setCreateForm({
                        name: '',
                        description: '',
                        category: 'study',
                        isPrivate: false,
                        tags: '',
                        memberIds: []
                      });
                      setError('');
                    }}
                    className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Groups Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <div
              key={group._id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/groups/${group._id}`)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                  {group.isPrivate && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                      Private
                    </span>
                  )}
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {group.description || 'No description provided'}
                </p>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>{group.members?.length || 0} members</span>
                  <span className="capitalize">{group.category}</span>
                </div>

                {group.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {group.tags.slice(0, 3).map((tag, index) => (
                      <span
                        key={index}
                        className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {group.tags.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{group.tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                <div className="text-xs text-gray-400">
                  Created {new Date(group.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>

        {groups.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">👥</div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">No groups yet</h3>
            <p className="text-gray-600 mb-6">Create your first study group to get started!</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600"
            >
              Create Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
};