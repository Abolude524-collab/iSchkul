import React, { useEffect, useState, useRef } from 'react';
import { Camera, Edit2, Save, X, User as UserIcon } from 'lucide-react';
import { Navbar } from '../components/Navbar';


const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface ProfileData {
  name: string;
  email: string;
  avatar?: string;
  username?: string;
  phonenumber?: string;
  institution?: string;
  studentcategory?: string;
}

interface ChatProfileData {
  bio?: string;
  status?: string;
}

export const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [chatProfile, setChatProfile] = useState<ChatProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<ProfileData>>({});
  const [editedChatProfile, setEditedChatProfile] = useState<Partial<ChatProfileData>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const [meRes, chatRes] = await Promise.all([
        fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/users/chat-profile`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (meRes.ok) {
        const responseData = await meRes.json();
        const data = responseData.user;
        // Map backend fields to frontend interface
        const profileData: ProfileData = {
          name: data.name,
          email: data.email,
          avatar: data.avatar,
          username: data.username,
          phonenumber: data.phoneNumber,   // Map phoneNumber -> phonenumber
          institution: data.institution,
          studentcategory: data.studentCategory // Map studentCategory -> studentcategory
        };
        setProfile(profileData);
        setEditedProfile(profileData);
      }

      if (chatRes.ok) {
        const data = await chatRes.json();
        setChatProfile(data);
        setEditedChatProfile(data);
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedProfile(profile || {});
    setEditedChatProfile(chatProfile || {});
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('authToken');

      // Update main profile
      const profileRes = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editedProfile)
      });

      // Update chat profile
      const chatRes = await fetch(`${API_BASE}/api/users/chat-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editedChatProfile)
      });

      if (profileRes.ok && chatRes.ok) {
        await fetchProfile();
        setIsEditing(false);
      } else {
        alert('Failed to update profile');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const token = localStorage.getItem('authToken');

      const res = await fetch(`${API_BASE}/api/auth/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        await fetchProfile();
      }
    } catch (err) {
      console.error('Avatar upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 sm:p-12 mb-6">
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 sm:w-40 sm:h-40 bg-white/30 rounded-full mb-4"></div>
              <div className="h-8 w-48 bg-white/30 rounded mb-2"></div>
              <div className="h-4 w-32 bg-white/30 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayName = profile?.name || profile?.username || 'User';
  const avatarUrl = profile?.avatar;

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Profile Hero */}
        <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 sm:p-12 text-white shadow-2xl mb-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative group mb-6">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-white shadow-xl">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/20 flex items-center justify-center">
                    <UserIcon size={64} className="text-white/80" />
                  </div>
                )}
              </div>
              <div
                className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={32} />
                <span className="text-sm mt-2">{uploading ? 'Uploading...' : 'Change Photo'}</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold mb-2">{displayName}</h1>
            <p className="text-lg opacity-90">{profile?.email}</p>

            {!isEditing && (
              <button
                onClick={handleEdit}
                className="mt-6 inline-flex items-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-full font-semibold hover:shadow-lg transition-all hover:-translate-y-0.5"
              >
                <Edit2 size={18} /> Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Profile Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
          {/* Personal Information */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 pb-4 border-b-2 border-gray-200 dark:border-gray-700">
              Personal Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Full Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedProfile.name || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="Enter your full name"
                  />
                ) : (
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-gray-900 dark:text-white">
                    {profile?.name || <em className="text-gray-400">Not set</em>}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Username
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedProfile.username || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, username: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="Choose a username"
                  />
                ) : (
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-gray-900 dark:text-white">
                    {profile?.username || <em className="text-gray-400">Not set</em>}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Email
                </label>
                <div className="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400">
                  {profile?.email}
                </div>
              </div>
            </div>
          </div>

          {/* Academic & Contact */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 pb-4 border-b-2 border-gray-200 dark:border-gray-700">
              Academic & Contact
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Phone Number
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editedProfile.phonenumber || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, phonenumber: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="Enter phone number"
                  />
                ) : (
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-gray-900 dark:text-white">
                    {profile?.phonenumber || <em className="text-gray-400">Not set</em>}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Student Category
                </label>
                {isEditing ? (
                  <select
                    value={editedProfile.studentcategory || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, studentcategory: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  >
                    <option value="">Select Category</option>
                    <option value="High School">High School</option>
                    <option value="Undergraduate">Undergraduate</option>
                    <option value="Graduate">Graduate</option>
                    <option value="Professional">Professional</option>
                  </select>
                ) : (
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-gray-900 dark:text-white">
                    {profile?.studentcategory || <em className="text-gray-400">Not set</em>}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Institution
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedProfile.institution || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, institution: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="Enter institution name"
                  />
                ) : (
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-gray-900 dark:text-white">
                    {profile?.institution || <em className="text-gray-400">Not set</em>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Chat Profile */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 pb-4 border-b-2 border-gray-200 dark:border-gray-700">
            Chat Profile
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                Bio
              </label>
              {isEditing ? (
                <textarea
                  value={editedChatProfile.bio || ''}
                  onChange={(e) => setEditedChatProfile({ ...editedChatProfile, bio: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  rows={3}
                  placeholder="Tell us about yourself..."
                />
              ) : (
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-gray-900 dark:text-white min-h-[4rem]">
                  {chatProfile?.bio || <em className="text-gray-400">No bio set</em>}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                Status
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedChatProfile.status || ''}
                  onChange={(e) => setEditedChatProfile({ ...editedChatProfile, status: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="What's your current status?"
                />
              ) : (
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-gray-900 dark:text-white">
                  {chatProfile?.status || <em className="text-gray-400">No status</em>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex flex-col sm:flex-row justify-center gap-4 pb-8">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 bg-white text-gray-700 border-2 border-gray-300 px-8 py-3 rounded-full font-semibold hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X size={18} /> Cancel
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default ProfilePage;
