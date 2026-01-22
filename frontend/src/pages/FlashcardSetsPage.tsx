import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuthStore } from '../services/store';
import { flashcardSetsAPI, flashcardAPI } from '../services/api';
import { Loader, Plus, Share2, Edit, Trash2, BookOpen, Eye, Copy, CheckCircle } from 'lucide-react';
import { OfflineDownloadButton } from '../components/OfflineDownloadButton';
import { getFlashcardSetsByUser, getAllFlashcardSets } from '../services/indexedDB';

interface FlashcardSet {
  _id: string;
  title: string;
  description: string;
  subject: string;
  tags: string[];
  isPublic: boolean;
  shareCode: string;
  shareUrl: string;
  cardCount: number;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
}

export const FlashcardSetsPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSet, setEditingSet] = useState<FlashcardSet | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '',
    isPublic: false,
    tags: '',
  });

  useEffect(() => {
    // Only redirect if we are online and have no user
    // If offline, we want to stay on the page to use saved data
    if (!user && navigator.onLine) {
      navigate('/login');
      return;
    }
    loadSets();
  }, [user, navigate, user?.id, user?._id]);

  const loadSets = async () => {
    try {
      setLoading(true);
      setError('');

      // OPTIMIZATION: Show offline data immediately if offline
      if (!navigator.onLine) {
        console.log('Detected offline status, loading sets from storage...');
        await loadSetsOffline();
        return;
      }

      // If online, we could technically race or just await. 
      // User wants SPEED. Let's load offline first, then refresh from network.
      const offlinePromise = loadSetsOffline(); 
      
      const response = await flashcardSetsAPI.getUserSets();
      setSets(response.data.sets);
    } catch (err: any) {
      console.warn('Network fetch failed, attempting offline load:', err.message);
      await loadSetsOffline();
    } finally {
      setLoading(false);
    }
  };

  const loadSetsOffline = async () => {
    setLoading(true);
    try {
      let offlineSets = [];
      const currentUserId = user?._id || user?.id;

      console.log('Loading flashcard sets from offline storage...', { userId: currentUserId });

      if (currentUserId) {
        offlineSets = await getFlashcardSetsByUser(currentUserId);
      }
      
      // Secondary fallback: get all local sets if user filtered return nothing
      if (!offlineSets || offlineSets.length === 0) {
        console.log('No user-specific sets found, fetching all local sets...');
        offlineSets = await getAllFlashcardSets();
      }
      
      if (offlineSets && offlineSets.length > 0) {
        console.log(`Successfully loaded ${offlineSets.length} offline flashcard sets`);
        setSets(offlineSets);
        setError('');
      } else {
        console.warn('No saved flashcard sets found in local database');
        setSets([]);
        setError('You are offline and have no saved flashcard sets. Go online to download some.');
      }
    } catch (offlineErr: any) {
      console.error('Failed to load flashcard sets offline:', offlineErr);
      setError('Failed to load flashcard sets from offline storage.');
    } finally {
      // Small delay ensures state is settled before spinner hides
      setTimeout(() => setLoading(false), 300);
    }
  };

  // 📡 Watch for online/offline status changes to auto-refresh
  useEffect(() => {
    const handleConnectivityChange = () => {
      console.log(`Connection changed: ${navigator.onLine ? 'ONLINE' : 'OFFLINE'}`);
      loadSets();
    };

    window.addEventListener('online', handleConnectivityChange);
    window.addEventListener('offline', handleConnectivityChange);

    return () => {
      window.removeEventListener('online', handleConnectivityChange);
      window.removeEventListener('offline', handleConnectivityChange);
    };
  }, [user?._id, user?.id]);

  const handleCreateSet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tags = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      await flashcardSetsAPI.createSet({
        ...formData,
        tags,
      });
      setFormData({
        title: '',
        description: '',
        subject: '',
        isPublic: false,
        tags: '',
      });
      setShowCreateForm(false);
      await loadSets();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSet) return;

    try {
      const tags = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      await flashcardSetsAPI.updateSet({
        setId: editingSet._id,
        ...formData,
        tags,
      });
      setEditingSet(null);
      setFormData({
        title: '',
        description: '',
        subject: '',
        isPublic: false,
        tags: '',
      });
      await loadSets();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteSet = async (setId: string) => {
    if (!confirm('Are you sure you want to delete this flashcard set? All cards will be deleted as well.')) {
      return;
    }

    try {
      await flashcardSetsAPI.deleteSet(setId);
      await loadSets();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditSet = (set: FlashcardSet) => {
    setEditingSet(set);
    setFormData({
      title: set.title,
      description: set.description,
      subject: set.subject,
      isPublic: set.isPublic,
      tags: set.tags.join(', '),
    });
  };

  const handleCopyShareLink = async (shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(shareUrl);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedLink(shareUrl);
      setTimeout(() => setCopiedLink(null), 2000);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      subject: '',
      isPublic: false,
      tags: '',
    });
    setEditingSet(null);
    setShowCreateForm(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading flashcard sets...</p>
          </div>
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
            📚 Flashcard Sets
          </h1>
          <p className="text-gray-600 text-lg">
            Create, organize, and share your flashcard collections
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Create/Edit Form */}
        {(showCreateForm || editingSet) && (
          <div className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingSet ? 'Edit Flashcard Set' : 'Create New Flashcard Set'}
            </h2>
            <form onSubmit={editingSet ? handleUpdateSet : handleCreateSet} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Biology, Mathematics"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe what this flashcard set covers..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Comma-separated tags (e.g., science, cells, biology)"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isPublic" className="ml-2 text-sm text-gray-700">
                  Make this set public (anyone with the link can view it)
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingSet ? 'Update Set' : 'Create Set'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            Create New Set
          </button>
        </div>

        {/* Sets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sets.map((set) => (
            <div key={set._id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{set.title}</h3>
                  {set.subject && (
                    <p className="text-sm text-blue-600 font-medium mb-2">{set.subject}</p>
                  )}
                  {set.description && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">{set.description}</p>
                  )}
                </div>
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => handleEditSet(set)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit set"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteSet(set._id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete set"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <div className="flex items-center gap-1">
                  <BookOpen size={14} />
                  <span>{set.cardCount} cards</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye size={14} />
                  <span>{set.viewCount} views</span>
                </div>
              </div>

              {set.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {set.tags.slice(0, 3).map((tag, index) => (
                    <span key={index} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                  {set.tags.length > 3 && (
                    <span className="text-gray-400 text-xs">+{set.tags.length - 3} more</span>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/flashcards?setId=${set._id}`)}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Study Cards
                </button>
                <OfflineDownloadButton
                  type="flashcard"
                  itemId={set._id}
                  itemData={{ set, cards: [] }}
                  size="small"
                />
                <button
                  onClick={() => handleCopyShareLink(set.shareUrl)}
                  className={`px-3 py-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-1 ${
                    copiedLink === set.shareUrl
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Copy share link"
                >
                  {copiedLink === set.shareUrl ? <CheckCircle size={14} /> : <Share2 size={14} />}
                </button>
              </div>

              {set.isPublic && (
                <div className="mt-3 text-xs text-green-600 font-medium">
                  ✓ Public - Shareable
                </div>
              )}
            </div>
          ))}
        </div>

        {sets.length === 0 && !loading && (
          <div className="text-center py-12">
            <BookOpen size={64} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No flashcard sets yet</h3>
            <p className="text-gray-600 mb-6">Create your first set to get started with organized learning</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus size={20} />
              Create Your First Set
            </button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};