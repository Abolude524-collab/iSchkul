import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Loader, Plus, BookOpen, Clock, Trash2, DownloadCloud, CheckCircle } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { getAPIEndpoint } from '../services/api';
import { getOfflineDocuments, saveDocument } from '../services/indexedDB';

interface Document {
    _id: string;
    title: string;
    filename: string;
    pages: number;
    createdAt: string;
    indexStatus: string;
}

export const CoReaderLibraryPage: React.FC = () => {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('authToken');
            
            // 1. Try local cache first (merge or fallback)
            const offlineDocs = await getOfflineDocuments();
            if (offlineDocs.length > 0) {
                setDocuments(offlineDocs as Document[]);
            }

            if (navigator.onLine) {
                const response = await fetch(getAPIEndpoint('/documents'), {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    setDocuments(data);
                    
                    // Update cache for metadata (don't download blobs yet)
                    // This ensures the library list is available offline
                    for (const doc of data) {
                        await saveDocument(doc);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch documents:', error);
        } finally {
            setLoading(false);
        }
    };

    const downloadForOffline = async (doc: Document) => {
        try {
            const token = localStorage.getItem('authToken');
            console.log('📥 Downloading for offline:', doc.title);
            
            const contentResponse = await fetch(getAPIEndpoint(`/documents/${doc._id}/content`), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (contentResponse.ok) {
                const blob = await contentResponse.blob();
                await saveDocument(doc, blob);
                alert(`${doc.title} is now available offline!`);
            } else {
                throw new Error('Failed to download content');
            }
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download document for offline use.');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name.replace('.pdf', ''));

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(getAPIEndpoint('/documents/upload'), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                setFile(null);
                fetchDocuments(); // Refresh list
            } else {
                alert('Upload failed. Please try again.');
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('An error occurred during upload.');
        } finally {
            setUploading(false);
        }
    };

    const handleDocumentClick = (docId: string) => {
        navigate(`/co-reader/${docId}`);
    };

    return (
        <div className="min-h-screen bg-gray-50 font-['Inter']">
            <Navbar />

            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600">
                                AI Co-Reader Library
                            </span>
                            <span className="text-sm font-normal px-3 py-1 bg-purple-100 text-purple-700 rounded-full">Beta</span>
                        </h1>
                        <p className="text-gray-600 mt-1">Upload your coursework and let AI help you study.</p>
                    </div>

                    <form onSubmit={handleUpload} className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                        <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                            <Plus size={16} />
                            {file ? file.name.substring(0, 15) + (file.name.length > 15 ? '...' : '') : 'Select PDF'}
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </label>
                        <button
                            type="submit"
                            disabled={!file || uploading}
                            className={`px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 transition-all ${!file || uploading
                                    ? 'bg-gray-300 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-md'
                                }`}
                        >
                            {uploading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
                            Upload
                        </button>
                    </form>
                </div>

                {/* Document Grid */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader size={40} className="text-purple-600 animate-spin" />
                    </div>
                ) : documents.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-dashed border-gray-300">
                        <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText size={32} className="text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No documents yet</h3>
                        <p className="text-gray-500 max-w-md mx-auto mb-6">Upload a PDF lecture note, textbook chapter, or research paper to get started.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {documents.map((doc) => (
                            <div
                                key={doc._id}
                                onClick={() => handleDocumentClick(doc._id)}
                                className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Clock size={16} className="text-gray-400" />
                                </div>

                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 flex-shrink-0">
                                        <FileText size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-purple-700 transition-colors">
                                            {doc.title}
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                            <span>{doc.pages} pages</span>
                                            <span>•</span>
                                            <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${doc.indexStatus === 'completed'
                                                ? 'bg-green-100 text-green-700'
                                                : doc.indexStatus === 'processing'
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : 'bg-red-100 text-red-700'
                                            }`}>
                                            {doc.indexStatus === 'completed' ? 'Ready' : doc.indexStatus}
                                        </span>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                downloadForOffline(doc);
                                            }}
                                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-purple-600 transition-colors"
                                            title="Download for offline access"
                                        >
                                            <DownloadCloud size={16} />
                                        </button>
                                    </div>

                                    <button className="text-sm font-medium text-purple-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                        Read Now <BookOpen size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
