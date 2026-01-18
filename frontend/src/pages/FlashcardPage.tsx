import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuthStore } from '../services/store';
import { gamificationAPI, flashcardSetsAPI, flashcardAPI } from '../services/api';
import { Loader, AlertCircle, CheckCircle, Clock, BookOpen, Upload, ArrowLeft, Plus, Share2, Edit, Trash2, Eye, Copy, Brain, Target, TrendingUp, Zap, FileText, Sparkles, RotateCcw, ChevronRight, Star, BarChart3 } from 'lucide-react';
import { Flashcard, FlashcardSet } from '../types/flashcards';
import FlashcardBrowseView from '../components/flashcards/FlashcardBrowseView';
import FlashcardReviewView from '../components/flashcards/FlashcardReviewView';

// Mode Selection Component
const ModeSelectionView: React.FC<{
  onSelectMode: (mode: 'manual' | 'generated' | 'browse') => void;
}> = ({ onSelectMode }) => (
  <div className="max-w-6xl mx-auto px-4">
    <div className="text-center mb-12">
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 mb-6 pb-2">
        Flashcard Studio
      </h1>
      <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
        Master any subject with our powerful flashcard system. Choose how you want to build your knowledge today.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {/* Browse All Flashcards */}
      <div className="group relative bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-green-500/20 transition-colors" />
        <div className="p-8">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
            <BookOpen className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">My Collection</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">Review your existing flashcard sets and keep your knowledge fresh with spaced repetition.</p>

          <ul className="space-y-3 mb-10">
            <li className="flex items-center gap-3 text-sm text-gray-600">
              <CheckCircle size={18} className="text-green-500" /> Unified View
            </li>
            <li className="flex items-center gap-3 text-sm text-gray-600">
              <CheckCircle size={18} className="text-green-500" /> Spaced Repetition
            </li>
            <li className="flex items-center gap-3 text-sm text-gray-600">
              <CheckCircle size={18} className="text-green-500" /> Progress Tracking
            </li>
          </ul>

          <button
            onClick={() => onSelectMode('browse')}
            className="w-full py-4 px-6 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-bold shadow-lg shadow-green-200 active:scale-95"
          >
            Open Collection
          </button>
        </div>
      </div>

      {/* Manual Mode */}
      <div className="group relative bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-blue-500/20 transition-colors" />
        <div className="p-8">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
            <Edit className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Manual Craft</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">Create bespoke flashcards manually. Perfect for specific subjects requiring nuanced questions.</p>

          <ul className="space-y-3 mb-10">
            <li className="flex items-center gap-3 text-sm text-gray-600">
              <CheckCircle size={18} className="text-blue-500" /> Complete Control
            </li>
            <li className="flex items-center gap-3 text-sm text-gray-600">
              <CheckCircle size={18} className="text-blue-500" /> Rich Content
            </li>
            <li className="flex items-center gap-3 text-sm text-gray-600">
              <CheckCircle size={18} className="text-blue-500" /> Custom Tags
            </li>
          </ul>

          <button
            onClick={() => onSelectMode('manual')}
            className="w-full py-4 px-6 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-200 active:scale-95"
          >
            Create Manually
          </button>
        </div>
      </div>

      {/* Generated Mode */}
      <div className="group relative bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-purple-500/20 transition-colors" />
        <div className="p-8">
          <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
            <Sparkles className="w-8 h-8 text-purple-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Generator</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">Turn your PDFs, docs, or notes into flashcards instantly using advanced Gemini AI.</p>

          <ul className="space-y-3 mb-10">
            <li className="flex items-center gap-3 text-sm text-gray-600">
              <CheckCircle size={18} className="text-purple-500" /> Instant Results
            </li>
            <li className="flex items-center gap-3 text-sm text-gray-600">
              <CheckCircle size={18} className="text-purple-500" /> Smart Extraction
            </li>
            <li className="flex items-center gap-3 text-sm text-gray-600">
              <CheckCircle size={18} className="text-purple-500" /> Time Saver
            </li>
          </ul>

          <button
            onClick={() => onSelectMode('generated')}
            className="w-full py-4 px-6 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all font-bold shadow-lg shadow-purple-200 active:scale-95"
          >
            Smart Generate
          </button>
        </div>
      </div>
    </div>
  </div>
);


// Flashcard Sets View Component
const FlashcardSetsView: React.FC<{
  sets: FlashcardSet[];
  onEditSet: (set: FlashcardSet) => void;
  onDeleteSet: (id: string) => void;
  onCopyShareLink: (url: string) => void;
  onCreateSet: () => void;
  onOpenSet?: (set: FlashcardSet) => void;
  copiedLink: string | null;
  mode?: 'manual' | 'generated';
}> = ({ sets, onEditSet, onDeleteSet, onCopyShareLink, onCreateSet, onOpenSet, copiedLink, mode = 'manual' }) => (
  <div className="space-y-8 animate-in fade-in duration-700">
    {/* Header */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
          {mode === 'manual' ? 'Mastery Sets' : 'Smart Sets'}
        </h1>
        <p className="text-gray-500 mt-1">Manage and study your collections</p>
      </div>
      {mode === 'manual' && (
        <button
          onClick={onCreateSet}
          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 font-bold"
        >
          <Plus size={20} />
          Create New Set
        </button>
      )}
    </div>

    {/* Sets Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {sets.length === 0 ? (
        <div className="col-span-full bg-white rounded-3xl border-2 border-dashed border-gray-200 p-16 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen size={40} className="text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Nothing here yet
          </h3>
          <p className="text-gray-500 mb-8 max-w-sm mx-auto leading-relaxed">
            {mode === 'manual'
              ? 'Start your journey by creating your first manual flashcard set.'
              : 'Upload your notes and let our AI generate a smart set for you.'
            }
          </p>
          {mode === 'manual' && (
            <button
              onClick={onCreateSet}
              className="px-8 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-bold"
            >
              Create First Set
            </button>
          )}
        </div>
      ) : (
        sets.map((set, index) => (
          <div
            key={set._id}
            className="group relative bg-white rounded-3xl shadow-sm border border-gray-100 p-6 hover:shadow-xl hover:border-blue-100 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Subject Badge */}
            <div className="flex justify-between items-start mb-4">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${index % 3 === 0 ? 'bg-blue-50 text-blue-600' :
                index % 3 === 1 ? 'bg-purple-50 text-purple-600' :
                  'bg-pink-50 text-pink-600'
                }`}>
                {set.subject || 'General'}
              </span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onEditSet(set)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                  title="Edit set"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => onDeleteSet(set._id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  title="Delete set"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-1">
              {set.title}
            </h3>

            {set.description && (
              <p className="text-gray-500 text-sm mb-6 line-clamp-2 h-10 leading-relaxed">
                {set.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs font-bold text-gray-400 mb-8 pb-4 border-b border-gray-50 uppercase tracking-tighter">
              <div className="flex items-center gap-1.5">
                <FileText size={14} className="text-gray-300" />
                {set.cardCount} Cards
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-gray-300" />
                {new Date(set.createdAt).toLocaleDateString()}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { if (typeof onOpenSet === 'function') onOpenSet(set); }}
                className="flex-1 px-4 py-3 bg-gray-900 text-white text-sm font-bold rounded-2xl hover:bg-blue-600 transition-all active:scale-95 shadow-lg shadow-gray-200"
              >
                Study Now
              </button>
              <button
                onClick={() => onCopyShareLink(set.shareUrl)}
                className="p-3 border border-gray-100 text-gray-400 rounded-2xl hover:text-blue-600 hover:bg-blue-50 hover:border-blue-100 transition-all active:scale-95"
                title="Copy share link"
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>

    {/* Copied Link Notification */}
    {copiedLink && (
      <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-right-8 duration-300 z-50">
        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
          <CheckCircle size={18} />
        </div>
        <div className="pr-4">
          <p className="font-bold text-sm">Link Copied!</p>
          <p className="text-xs text-gray-400">Share with your friends</p>
        </div>
      </div>
    )}
  </div>
);

// `FlashcardBrowseView` has been moved to `src/components/flashcards/FlashcardBrowseView.tsx`



// `FlashcardReviewView` has been moved to `src/components/flashcards/FlashcardReviewView.tsx`



const FlashcardGenerateView: React.FC<{
  generateText: string;
  setGenerateText: (text: string) => void;
  numCards: number;
  setNumCards: (num: number) => void;
  generating: boolean;
  uploadedFile: File | null;
  setUploadedFile: (file: File | null) => void;
  subject: string;
  setSubject: (text: string) => void;
  onGenerate: () => void;
  onBack: () => void;
}> = ({ generateText, setGenerateText, numCards, setNumCards, generating, uploadedFile, setUploadedFile, subject, setSubject, onGenerate, onBack }) => (
  <div className="space-y-6">
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center gap-3 mb-4">
        <Sparkles size={24} className="text-purple-600" />
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Generate Flashcards</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Subject <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Biology, Algebra, French History"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm sm:text-base"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Subject name is required to organize your flashcards</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Study Material</label>
          <textarea
            value={generateText}
            onChange={(e) => setGenerateText(e.target.value)}
            placeholder="Paste your study material here, or upload a file below..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm sm:text-base"
            rows={6}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Number of Cards</label>
            <input
              type="number"
              value={numCards}
              onChange={(e) => setNumCards(parseInt(e.target.value) || 10)}
              min="1"
              max="50"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm sm:text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Upload File (PDF, DOCX, TXT)</label>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm sm:text-base"
            />
          </div>
        </div>

        {uploadedFile && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <FileText size={16} className="text-blue-600" />
            <span className="text-sm text-blue-700">{uploadedFile.name}</span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onGenerate}
            disabled={generating || !subject.trim() || (!generateText.trim() && !uploadedFile)}
            className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
            title={!subject.trim() ? "Subject name is required" : ""}
          >
            {generating ? <RotateCcw size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {generating ? 'Generating...' : 'Generate Cards'}
          </button>
          <button
            onClick={onBack}
            className="flex-1 sm:flex-none px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm sm:text-base"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  </div>
);

export const FlashcardPage: React.FC = () => {
  const { user, refreshUserStats } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setId = searchParams.get('setId');

  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [currentSet, setCurrentSet] = useState<any>(null);
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'select' | 'manual' | 'generated' | 'browse'>('select');
  const [view, setView] = useState<'sets' | 'browse' | 'review' | 'generate'>('sets');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [newCard, setNewCard] = useState({ front: '', back: '', difficulty: 'medium', tags: '' });
  const [showAddCard, setShowAddCard] = useState(false);
  const [generateText, setGenerateText] = useState('');
  const [generateSubject, setGenerateSubject] = useState('');
  const [numCards, setNumCards] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSet, setEditingSet] = useState<FlashcardSet | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Mode switching functions
  const handleSelectMode = (selectedMode: 'manual' | 'generated' | 'browse') => {
    setMode(selectedMode);
    if (selectedMode === 'browse') {
      // Browse all flashcards
      setView('sets');
      loadSets();
    } else if (selectedMode === 'generated') {
      // Go directly to generation form
      setView('generate');
    } else {
      // Manual: show sets for manual mode
      setView('sets');
      loadSets();
    }
  };

  const handleSwitchMode = () => {
    setMode('select');
    setView('sets');
    setCurrentSet(null);
    navigate('/flashcards');
  };

  const [setFormData, setSetFormData] = useState({
    title: '',
    description: '',
    subject: '',
    isPublic: false,
    tags: '',
  });

  const [flashcardFormData, setFlashcardFormData] = useState({
    flashcards: [{ front: '', back: '', difficulty: 'medium', tags: '' }],
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    console.debug('FlashcardPage useEffect run', { setId, view });

    if (setId) {
      // If we have a setId in URL, show the cards for that set
      setMode('browse');
      setView('browse');
      fetchFlashcards(setId);
    } else {
      // If no setId, show the mode selection (home screen)
      setMode('select');
      setView('sets');
      setLoading(false); // Stop loading to show mode selection
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

  const fetchFlashcards = async (setIdParam?: string) => {
    setLoading(true);
    try {
      // If we have a setId, load the set information
      const targetSetId = setIdParam || setId;
      console.debug('fetchFlashcards', { targetSetId });
      if (targetSetId) {
        try {
          const setsResponse = await flashcardSetsAPI.getUserSets();
          const currentSetData = setsResponse.data.sets.find((s: any) => s._id === targetSetId);
          setCurrentSet(currentSetData);
        } catch (setError) {
          console.error('Failed to load set:', setError);
        }
      }

      // Load flashcards
      const response = await flashcardAPI.getDueCards(50, targetSetId || undefined);
      setDueCards(response.data.flashcards);
      const allCardsResponse = await flashcardAPI.getUserCards(100, targetSetId || undefined);
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
    if (!generateSubject.trim()) {
      setError('Subject name is required');
      return;
    }
    if (!generateText.trim() && !uploadedFile) {
      setError('Please provide text or upload a file');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      // First, create the flashcard set with subject
      const setResponse = await flashcardSetsAPI.createSet({
        title: generateSubject.trim(),
        subject: generateSubject.trim(),
        description: `Generated from ${uploadedFile?.name || 'pasted text'}`,
        isPublic: false,
        tags: ['generated', 'ai'],
      });

      // Then generate cards into that set
      await flashcardAPI.generateCards({
        text: generateText || undefined,
        numCards,
        setId: setResponse.data.setId,
        subject: generateSubject.trim(),
        file: uploadedFile,
      });

      setGenerateText('');
      setGenerateSubject('');
      setUploadedFile(null);
      setNumCards(10);
      setCurrentSet(setResponse.data);
      setView('browse');
      fetchFlashcards(setResponse.data.setId);
    } catch (err: any) {
      setError(err.message || 'Failed to generate flashcards');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportSet = async (targetSet?: FlashcardSet | null) => {
    const selected = targetSet || currentSet;
    if (!selected) return;
    try {
      const response = await flashcardAPI.exportSetPdf(selected._id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selected.title || 'flashcards'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to export PDF');
    }
  };

  const handleDownloadCard = async (cardId: string, targetSet?: FlashcardSet | null) => {
    const selected = targetSet || currentSet;
    if (!selected) return;
    try {
      const response = await flashcardAPI.downloadCard(selected._id, cardId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `flashcard-${cardId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to download card');
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
          // Refresh user stats in auth store
          await refreshUserStats();
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

  // Flashcard form management functions
  const addFlashcard = () => {
    setFlashcardFormData({
      flashcards: [...flashcardFormData.flashcards, { front: '', back: '', difficulty: 'medium', tags: '' }]
    });
  };

  const removeFlashcard = (index: number) => {
    setFlashcardFormData({
      flashcards: flashcardFormData.flashcards.filter((_, i) => i !== index)
    });
  };

  const updateFlashcard = (index: number, field: string, value: string) => {
    const updatedFlashcards = [...flashcardFormData.flashcards];
    updatedFlashcards[index] = { ...updatedFlashcards[index], [field]: value };
    setFlashcardFormData({ flashcards: updatedFlashcards });
  };

  const handleDownloadTemplate = () => {
    const csvContent = "front,back,difficulty,tags\n\"What is the capital of France?\",\"Paris\",\"medium\",\"geography,europe\"\n\"What is 2 + 2?\",\"4\",\"easy\",\"math,basics\"";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'flashcard_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target?.result as string;
      const lines = csv.split('\n');
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

      const flashcards = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
        if (values.length >= 2) {
          flashcards.push({
            front: values[0] || '',
            back: values[1] || '',
            difficulty: values[2] || 'medium',
            tags: values[3] || '',
          });
        }
      }

      if (flashcards.length > 0) {
        setFlashcardFormData({ flashcards });
      }
    };
    reader.readAsText(file);
  };

  // Set management functions
  const handleCreateSet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Create the set first
      const setResponse = await flashcardSetsAPI.createSet({
        title: setFormData.title,
        description: setFormData.description,
        subject: setFormData.subject,
        isPublic: setFormData.isPublic,
        tags: setFormData.tags.split(',').map((t) => t.trim()).filter(t => t),
      });

      // If there are flashcards to add, add them to the set
      if (flashcardFormData.flashcards.length > 0 && flashcardFormData.flashcards.some(card => card.front.trim() && card.back.trim())) {
        const validCards = flashcardFormData.flashcards.filter(card => card.front.trim() && card.back.trim());
        if (validCards.length > 0) {
          await flashcardSetsAPI.addCardsToSet({
            setId: setResponse.data.setId,
            cards: validCards.map(card => ({
              front: card.front,
              back: card.back,
              tags: card.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t),
              difficulty: card.difficulty,
            })),
          });
        }
      }

      setSetFormData({ title: '', description: '', subject: '', isPublic: false, tags: '' });
      setFlashcardFormData({ flashcards: [{ front: '', back: '', difficulty: 'medium', tags: '' }] });
      setShowCreateForm(false);
      loadSets();
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Your session has expired. Please log in again.');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(err.message || 'Failed to create flashcard set');
      }
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

      {/* Mobile-first container with responsive padding */}
      <div className="flex-grow w-full px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">

        {/* Page Header - Mobile optimized */}
        <div className="mb-6 sm:mb-8">
          {mode !== 'select' && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSwitchMode}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  ← Back
                </button>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
                    {mode === 'browse' ? 'My Flashcards' : mode === 'manual' ? 'Create Manually' : 'Generate from Files'}
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    {mode === 'browse'
                      ? 'Browse, study, and manage all your flashcards'
                      : mode === 'manual'
                        ? 'Create and manage your flashcard sets manually'
                        : 'Generate flashcards automatically from documents'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentSet ? (
            <div className="flex items-center gap-3 mb-4">
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
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">{currentSet.title}</h1>
                {currentSet.subject && (
                  <p className="text-blue-600 font-medium text-sm sm:text-base">{currentSet.subject}</p>
                )}
              </div>
            </div>
          ) : mode === 'select' && (
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Flashcards</h1>
            </div>
          )}

          {currentSet?.description && (
            <p className="text-gray-600 mt-2 text-sm sm:text-base">{currentSet.description}</p>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm sm:text-base">{error}</p>
            </div>
          </div>
        )}

        {/* Main Content Based on Mode and View */}
        {/* Main Content Based on View and Mode */}
        {view === 'review' ? (
          <FlashcardReviewView
            dueCards={dueCards}
            currentCardIndex={currentCardIndex}
            isFlipped={isFlipped}
            onFlip={() => setIsFlipped(!isFlipped)}
            onReview={handleReview}
            onNextCard={() => {
              if (currentCardIndex < dueCards.length - 1) {
                setCurrentCardIndex(currentCardIndex + 1);
                setIsFlipped(false);
              } else {
                setView('browse');
                fetchFlashcards();
              }
            }}
            onPrevCard={() => {
              if (currentCardIndex > 0) {
                setCurrentCardIndex(currentCardIndex - 1);
                setIsFlipped(false);
              }
            }}
          />
        ) : mode === 'select' ? (
          <ModeSelectionView onSelectMode={handleSelectMode} />
        ) : mode === 'browse' ? (
          // Browse all flashcards - unified view
          currentSet ? (
            <FlashcardBrowseView
              flashcards={flashcards}
              dueCards={dueCards}
              currentSet={currentSet}
              onStartReview={() => setView('review')}
              onGenerate={() => { }}
              onAddCard={() => { }}
              showAddCard={false}
              newCard={newCard}
              setNewCard={setNewCard}
              onAddCardSubmit={handleAddCard}
              mode="browse"
              onExportSet={() => handleExportSet(currentSet)}
              onDownloadCard={(cardId) => handleDownloadCard(cardId, currentSet)}
            />
          ) : (
            <FlashcardSetsView
              sets={sets}
              onEditSet={handleEditSet}
              onDeleteSet={handleDeleteSet}
              onCopyShareLink={handleCopyShareLink}
              onCreateSet={() => { }}
              copiedLink={copiedLink}
              mode="browse"
              onOpenSet={(s) => {
                setCurrentSet(s);
                setView('browse');
                navigate(`/flashcards?setId=${s._id}`);
                fetchFlashcards(s._id);
              }}
            />
          )
        ) : mode === 'manual' ? (
          // Manual Mode Views
          view === 'sets' ? (
            <FlashcardSetsView
              sets={sets}
              onEditSet={handleEditSet}
              onDeleteSet={handleDeleteSet}
              onCopyShareLink={handleCopyShareLink}
              onCreateSet={() => setShowCreateForm(true)}
              copiedLink={copiedLink}
              mode="manual"
            />
          ) : view === 'browse' ? (
            <FlashcardBrowseView
              flashcards={flashcards}
              dueCards={dueCards}
              currentSet={currentSet}
              onStartReview={() => setView('review')}
              onGenerate={() => {
                // Manual mode doesn't allow generation
                setError('Manual mode does not support AI generation. Switch to Generated mode for file-based flashcard creation.');
              }}
              onAddCard={() => setShowAddCard(!showAddCard)}
              showAddCard={showAddCard}
              newCard={newCard}
              setNewCard={setNewCard}
              onAddCardSubmit={handleAddCard}
              mode="manual"
              onExportSet={() => handleExportSet(currentSet)}
              onDownloadCard={(cardId) => handleDownloadCard(cardId, currentSet)}
            />
          ) : null
        ) : mode === 'generated' ? (
          // Generated Mode Views
          view === 'sets' ? (
            <FlashcardSetsView
              sets={sets}
              onEditSet={handleEditSet}
              onDeleteSet={handleDeleteSet}
              onCopyShareLink={handleCopyShareLink}
              onCreateSet={() => {
                // Generated mode doesn't allow manual set creation
                setError('Generated mode does not support manual set creation. Upload a document to generate flashcards automatically.');
              }}
              copiedLink={copiedLink}
              mode="generated"
            />
          ) : view === 'generate' ? (
            <FlashcardGenerateView
              generateText={generateText}
              setGenerateText={setGenerateText}
              subject={generateSubject}
              setSubject={setGenerateSubject}
              numCards={numCards}
              setNumCards={setNumCards}
              generating={generating}
              uploadedFile={uploadedFile}
              setUploadedFile={setUploadedFile}
              onGenerate={handleGenerate}
              onBack={() => setView('sets')}
            />
          ) : view === 'browse' ? (
            <FlashcardBrowseView
              flashcards={flashcards}
              dueCards={dueCards}
              currentSet={currentSet}
              onStartReview={() => setView('review')}
              onGenerate={() => setView('generate')}
              onAddCard={() => {
                // Generated mode doesn't allow manual card addition
                setError('Generated mode does not support manual card creation. Use the Generate tab to create cards from documents.');
              }}
              showAddCard={false} // Always false in generated mode
              newCard={newCard}
              setNewCard={setNewCard}
              onAddCardSubmit={handleAddCard}
              mode="generated"
              onExportSet={() => handleExportSet(currentSet)}
              onDownloadCard={(cardId) => handleDownloadCard(cardId, currentSet)}
              onOpenSet={(s) => {
                setCurrentSet(s);
                setMode('generated');
                setView('browse');
                navigate(`/flashcards?setId=${s._id}`);
                fetchFlashcards(s._id);
              }}
            />
          ) : null
        ) : null}
      </div>

      {/* Create/Edit Set Modal - Mobile optimized */}
      {(showCreateForm || editingSet) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
                {editingSet ? 'Edit Set' : 'Create New Set'}
              </h3>
              <form onSubmit={editingSet ? handleUpdateSet : handleCreateSet} className="space-y-6">
                {/* Set Information */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">Title</label>
                      <input
                        type="text"
                        value={setFormData.title}
                        onChange={(e) => setSetFormData({ ...setFormData, title: e.target.value })}
                        placeholder="e.g., Biology 101"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm sm:text-base"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm sm:text-base"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Description</label>
                    <textarea
                      value={setFormData.description}
                      onChange={(e) => setSetFormData({ ...setFormData, description: e.target.value })}
                      placeholder="Describe what this set covers..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm sm:text-base"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">Tags (comma-separated)</label>
                      <input
                        type="text"
                        value={setFormData.tags}
                        onChange={(e) => setSetFormData({ ...setFormData, tags: e.target.value })}
                        placeholder="science, biology, cells"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm sm:text-base"
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
                </div>

                {/* Flashcards Section - Only for new sets */}
                {!editingSet && (
                  <div className="border-t pt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-semibold text-gray-900">Add Flashcards</h4>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleDownloadTemplate}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          📥 Download CSV Template
                        </button>
                        <label className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors cursor-pointer">
                          📤 Upload CSV
                          <input
                            type="file"
                            accept=".csv"
                            onChange={handleCSVUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Flashcard Forms */}
                    <div className="space-y-4">
                      {flashcardFormData.flashcards.map((card, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-3">
                            <h5 className="font-medium text-gray-900">Card {index + 1}</h5>
                            {flashcardFormData.flashcards.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeFlashcard(index)}
                                className="text-red-500 hover:text-red-700 text-sm"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-900 mb-1">Front (Question)</label>
                              <textarea
                                value={card.front}
                                onChange={(e) => updateFlashcard(index, 'front', e.target.value)}
                                placeholder="Enter the question..."
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                                rows={2}
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-900 mb-1">Back (Answer)</label>
                              <textarea
                                value={card.back}
                                onChange={(e) => updateFlashcard(index, 'back', e.target.value)}
                                placeholder="Enter the answer..."
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                                rows={2}
                                required
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-900 mb-1">Difficulty</label>
                              <select
                                value={card.difficulty}
                                onChange={(e) => updateFlashcard(index, 'difficulty', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                              >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-900 mb-1">Tags (optional)</label>
                              <input
                                type="text"
                                value={card.tags}
                                onChange={(e) => updateFlashcard(index, 'tags', e.target.value)}
                                placeholder="comma-separated tags"
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={addFlashcard}
                      className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      + Add Another Card
                    </button>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
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
                      setFlashcardFormData({ flashcards: [{ front: '', back: '', difficulty: 'medium', tags: '' }] });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};
