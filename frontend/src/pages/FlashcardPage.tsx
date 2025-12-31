import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuthStore } from '../services/store';
import { gamificationAPI, flashcardSetsAPI, flashcardAPI } from '../services/api';
import { Loader, AlertCircle, CheckCircle, Clock, BookOpen, Upload, ArrowLeft, Plus, Share2, Edit, Trash2, Eye, Copy } from 'lucide-react';

interface Flashcard {
  _id: string;
  front: string;
  back: string;
  difficulty: string;
  tags: string[];
  interval: number;
  easeFactor: number;
  nextReview: string;
  successRate: number;
}

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

export const FlashcardPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setId = searchParams.get('setId');

  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [currentSet, setCurrentSet] = useState<any>(null);
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'sets' | 'browse' | 'review' | 'generate'>('sets');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [newCard, setNewCard] = useState({ front: '', back: '', difficulty: 'medium', tags: '' });
  const [showAddCard, setShowAddCard] = useState(false);
  const [generateText, setGenerateText] = useState('');
  const [numCards, setNumCards] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSet, setEditingSet] = useState<FlashcardSet | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const [setFormData, setSetFormData] = useState({
    title: '',
    description: '',
    subject: '',
    isPublic: false,
    tags: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    if (setId) {
      // If we have a setId, show the cards for that set
      setView('browse');
      fetchFlashcards();
    } else {
      // If no setId, show the sets overview
      setView('sets');
      loadSets();
    }
  }, [user, navigate, setId]);

  const loadSets = async () => {
    setLoading(true);
    try {
      const response = await flashcardSetsAPI.getUserSets();
      setSets(response.data.sets);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFlashcards = async () => {
    setLoading(true);
    try {
      // If we have a setId, load the set information
      if (setId) {
        try {
          const setsResponse = await flashcardSetsAPI.getUserSets();
          const currentSetData = setsResponse.data.sets.find((s: any) => s._id === setId);
          setCurrentSet(currentSetData);
        } catch (setError) {
          console.error('Failed to load set:', setError);
        }
      }

      // Load flashcards
      const response = await flashcardAPI.getDueCards(50, setId || undefined);
      setDueCards(response.data.flashcards);

      const allCardsResponse = await flashcardAPI.getUserCards(100, setId || undefined);
      setFlashcards(allCardsResponse.data.flashcards);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await flashcardAPI.createCard({
        front: newCard.front,
        back: newCard.back,
        difficulty: newCard.difficulty,
        tags: newCard.tags.split(',').map((t) => t.trim()).filter(t => t),
        setId: setId || undefined,
      });

      setNewCard({ front: '', back: '', difficulty: 'medium', tags: '' });
      setShowAddCard(false);
      fetchFlashcards();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGenerate = async () => {
    if (!generateText.trim() && !uploadedFile) {
      setError('Please provide text or upload a file');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      let fileData = undefined;
      if (uploadedFile) {
        // Convert file to base64
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(uploadedFile);
        });
        fileData = {
          filename: uploadedFile.name,
          mimetype: uploadedFile.type,
          data: base64.split(',')[1] // Remove data:mimetype prefix
        };
      }

      await flashcardAPI.generateCards({
        text: generateText || undefined,
        numCards,
        setId: setId || undefined,
        file: fileData,
      });

      setGenerateText('');
      setUploadedFile(null);
      setNumCards(10);
      setView('browse');
      fetchFlashcards();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleReview = async (quality: number) => {
    try {
      await flashcardAPI.recordReview(dueCards[currentCardIndex]._id, quality);

      if (currentCardIndex < dueCards.length - 1) {
        setCurrentCardIndex(currentCardIndex + 1);
        setIsFlipped(false);
      } else {
        // Award XP for completing flashcard review session
        try {
          await gamificationAPI.awardXP({
            activityType: 'FLASHCARD_COMPLETE',
            xpAmount: 5,
            description: `Completed flashcard review session (${dueCards.length} cards)`
          });
        } catch (xpError) {
          console.error('Failed to award XP:', xpError);
        }

        setView('browse');
        fetchFlashcards();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Set management functions
  const handleCreateSet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await flashcardSetsAPI.createSet({
        title: setFormData.title,
        description: setFormData.description,
        subject: setFormData.subject,
        isPublic: setFormData.isPublic,
        tags: setFormData.tags.split(',').map((t) => t.trim()).filter(t => t),
      });

      setSetFormData({ title: '', description: '', subject: '', isPublic: false, tags: '' });
      setShowCreateForm(false);
      loadSets();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditSet = (set: FlashcardSet) => {
    setEditingSet(set);
    setSetFormData({
      title: set.title,
      description: set.description,
      subject: set.subject,
      isPublic: set.isPublic,
      tags: set.tags.join(', '),
    });
  };

  const handleUpdateSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSet) return;

    try {
      await flashcardSetsAPI.updateSet(editingSet._id, {
        title: setFormData.title,
        description: setFormData.description,
        subject: setFormData.subject,
        isPublic: setFormData.isPublic,
        tags: setFormData.tags.split(',').map((t) => t.trim()).filter(t => t),
      });

      setEditingSet(null);
      setSetFormData({ title: '', description: '', subject: '', isPublic: false, tags: '' });
      loadSets();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteSet = async (setId: string) => {
    if (!confirm('Are you sure you want to delete this flashcard set? This action cannot be undone.')) {
      return;
    }

    try {
      await flashcardSetsAPI.deleteSet(setId);
      loadSets();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCopyShareLink = async (shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(shareUrl);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading flashcards...</p>
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
          {currentSet ? (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => {
                    setView('sets');
                    navigate('/flashcards');
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Back to sets"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{currentSet.title}</h1>
                  {currentSet.subject && (
                    <p className="text-blue-600 font-medium">{currentSet.subject}</p>
                  )}
                </div>
              </div>
              {currentSet.description && (
                <p className="text-gray-600 mt-2">{currentSet.description}</p>
              )}
              {currentSet.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {currentSet.tags.map((tag: string, index: number) => (
                    <span key={index} className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <h1 className="text-4xl font-bold text-gray-900">Flashcards</h1>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {view === 'sets' ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
              <h1 className="text-4xl font-bold text-gray-900">Flashcard Sets</h1>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
              >
                <Plus size={18} />
                Create Set
              </button>
            </div>

            {/* Create/Edit Form */}
            {(showCreateForm || editingSet) && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  {editingSet ? 'Edit Set' : 'Create New Set'}
                </h3>
                <form onSubmit={editingSet ? handleUpdateSet : handleCreateSet} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">Title</label>
                      <input
                        type="text"
                        value={setFormData.title}
                        onChange={(e) => setSetFormData({ ...setFormData, title: e.target.value })}
                        placeholder="e.g., Biology 101"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">Subject</label>
                      <input
                        type="text"
                        value={setFormData.subject}
                        onChange={(e) => setSetFormData({ ...setFormData, subject: e.target.value })}
                        placeholder="e.g., Biology"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Description</label>
                    <textarea
                      value={setFormData.description}
                      onChange={(e) => setSetFormData({ ...setFormData, description: e.target.value })}
                      placeholder="Describe what this set covers..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">Tags (comma-separated)</label>
                      <input
                        type="text"
                        value={setFormData.tags}
                        onChange={(e) => setSetFormData({ ...setFormData, tags: e.target.value })}
                        placeholder="science, biology, cells"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="isPublic"
                        checked={setFormData.isPublic}
                        onChange={(e) => setSetFormData({ ...setFormData, isPublic: e.target.checked })}
                        className="mr-2"
                      />
                      <label htmlFor="isPublic" className="text-sm font-medium text-gray-900">Make this set public</label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {editingSet ? 'Update Set' : 'Create Set'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setEditingSet(null);
                        setSetFormData({ title: '', description: '', subject: '', isPublic: false, tags: '' });
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Sets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sets.length === 0 ? (
                <div className="col-span-full text-center py-12 bg-white rounded-xl border border-gray-200">
                  <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 text-lg mb-4">No flashcard sets yet</p>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create Your First Set
                  </button>
                </div>
              ) : (
                sets.map((set) => (
                  <div key={set._id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-grow">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{set.title}</h3>
                        {set.subject && (
                          <p className="text-blue-600 font-medium text-sm mb-2">{set.subject}</p>
                        )}
                        {set.description && (
                          <p className="text-gray-600 text-sm mb-3">{set.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditSet(set)}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit set"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteSet(set._id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete set"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {set.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {set.tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full">
                            {tag}
                          </span>
                        ))}
                        {set.tags.length > 3 && (
                          <span className="text-gray-400 text-xs">+{set.tags.length - 3} more</span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                      <span>{set.cardCount} cards</span>
                      <span>{set.viewCount} views</span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/flashcards?setId=${set._id}`)}
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-1"
                      >
                        <Eye size={16} />
                        Study Cards
                      </button>
                      <button
                        onClick={() => handleCopyShareLink(set.shareUrl)}
                        className={`px-3 py-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-1 ${
                          copiedLink === set.shareUrl
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title="Copy share link"
                      >
                        {copiedLink === set.shareUrl ? <CheckCircle size={16} /> : <Share2 size={16} />}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : view === 'browse' ? (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <p className="text-gray-600 text-sm">Total Cards</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{flashcards.length}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <p className="text-gray-600 text-sm">Due Today</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{dueCards.length}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <p className="text-gray-600 text-sm">Avg Success Rate</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {flashcards.length > 0
                    ? (flashcards.reduce((sum, card) => sum + card.successRate, 0) / flashcards.length * 100).toFixed(0)
                    : 0}
                  %
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 flex-wrap">
              <button
                onClick={() => setView('generate')}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all"
              >
                🤖 Generate
              </button>
              <button
                onClick={() => setShowAddCard(!showAddCard)}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
              >
                + New Card
              </button>
              {dueCards.length > 0 && (
                <button
                  onClick={() => setView('review')}
                  className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all"
                >
                  Start Review ({dueCards.length})
                </button>
              )}
            </div>

            {/* Add Card Form */}
            {showAddCard && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <form onSubmit={handleAddCard} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Front (Question)</label>
                    <textarea
                      value={newCard.front}
                      onChange={(e) => setNewCard({ ...newCard, front: e.target.value })}
                      placeholder="Enter the question or prompt..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      rows={3}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Back (Answer)</label>
                    <textarea
                      value={newCard.back}
                      onChange={(e) => setNewCard({ ...newCard, back: e.target.value })}
                      placeholder="Enter the answer..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      rows={3}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">Difficulty</label>
                      <select
                        value={newCard.difficulty}
                        onChange={(e) => setNewCard({ ...newCard, difficulty: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">Tags (comma-separated)</label>
                      <input
                        type="text"
                        value={newCard.tags}
                        onChange={(e) => setNewCard({ ...newCard, tags: e.target.value })}
                        placeholder="math, calculus"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Create Card
                  </button>
                </form>
              </div>
            )}

            {/* Cards List */}
            <div className="space-y-3">
              {flashcards.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                  <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 text-lg mb-4">No flashcards yet</p>
                  <button
                    onClick={() => setShowAddCard(true)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create Your First Card
                  </button>
                </div>
              ) : (
                flashcards.map((card, index) => (
                  <div key={card._id} className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-grow">
                        <p className="font-semibold text-gray-900">{card.front}</p>
                        <p className="text-gray-600 text-sm mt-1">{card.back}</p>
                      </div>
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                        #{index + 1}
                      </span>
                    </div>
                    <div className="flex gap-2 items-center text-xs text-gray-500">
                      <Clock size={14} />
                      <span>Next review in {card.interval} days</span>
                      <span className="text-green-600 font-semibold ml-auto">
                        {(card.successRate * 100).toFixed(0)}% success
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : view === 'generate' ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Generate Flashcards</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Paste Text or Upload File</label>
                  <textarea
                    value={generateText}
                    onChange={(e) => setGenerateText(e.target.value)}
                    placeholder="Paste your study material here, or upload a PDF/DOCX file..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    rows={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Or Upload PDF/DOCX</label>
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  {uploadedFile && (
                    <p className="text-sm text-gray-600 mt-1">Selected: {uploadedFile.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Number of Cards</label>
                  <select
                    value={numCards}
                    onChange={(e) => setNumCards(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value={5}>5 cards</option>
                    <option value={10}>10 cards</option>
                    <option value={15}>15 cards</option>
                    <option value={20}>20 cards</option>
                  </select>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={generating || (!generateText.trim() && !uploadedFile)}
                  className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {generating ? <Loader size={18} className="animate-spin" /> : '🤖 Generate Flashcards'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Review Mode */
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Card {currentCardIndex + 1} of {dueCards.length}
                </h2>
                <button
                  onClick={() => setView('browse')}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Exit Review
                </button>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${((currentCardIndex + 1) / dueCards.length) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Card */}
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="bg-gradient-to-br from-blue-600 to-purple-600 text-white p-12 rounded-2xl cursor-pointer min-h-[400px] flex items-center justify-center text-center transform transition-all hover:shadow-2xl"
              style={{
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              <div>
                <p className="text-sm font-medium text-blue-100 mb-4">
                  {isFlipped ? 'Answer' : 'Question'}
                </p>
                <p className="text-3xl font-bold">
                  {isFlipped ? dueCards[currentCardIndex].back : dueCards[currentCardIndex].front}
                </p>
                <p className="text-blue-100 text-sm mt-8">Click to reveal answer</p>
              </div>
            </div>

            {/* Quality Buttons */}
            {isFlipped && (
              <div className="mt-12 space-y-3">
                <p className="text-center text-gray-600 mb-6">How well did you remember?</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <button
                    onClick={() => handleReview(0)}
                    className="p-4 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-semibold transition-colors"
                  >
                    Failed (0)
                  </button>
                  <button
                    onClick={() => handleReview(1)}
                    className="p-4 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg font-semibold transition-colors"
                  >
                    Hard (1)
                  </button>
                  <button
                    onClick={() => handleReview(2)}
                    className="p-4 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded-lg font-semibold transition-colors"
                  >
                    OK (2)
                  </button>
                  <button
                    onClick={() => handleReview(4)}
                    className="p-4 bg-lime-100 text-lime-700 hover:bg-lime-200 rounded-lg font-semibold transition-colors"
                  >
                    Good (4)
                  </button>
                  <button
                    onClick={() => handleReview(5)}
                    className="p-4 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg font-semibold transition-colors"
                  >
                    Perfect (5)
                  </button>
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
