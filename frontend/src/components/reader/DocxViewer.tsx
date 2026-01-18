import React, { useState, useEffect } from 'react';

interface DocxViewerProps {
    documentId: string;
    onPageChange?: (pageNumber: number) => void;
}

export const DocxViewer: React.FC<DocxViewerProps> = ({ documentId, onPageChange }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [htmlContent, setHtmlContent] = useState<string>('');

    useEffect(() => {
        const loadDocx = async () => {
            try {
                setLoading(true);
                setError(null);

                const token = localStorage.getItem('authToken');
                console.log('📄 DocxViewer - Loading DOCX:', documentId);

                const response = await fetch(
                    `http://localhost:5000/api/documents/${documentId}/preview`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );

                if (!response.ok) {
                    throw new Error(`Failed to load document: ${response.statusText}`);
                }

                const html = await response.text();
                setHtmlContent(html);
                console.log('✅ DOCX loaded successfully');

                // Notify parent about page load
                if (onPageChange) {
                    onPageChange(1);
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                console.error('🔴 DOCX load error:', message);
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        loadDocx();
    }, [documentId, onPageChange]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading document...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50">
                <div className="text-center">
                    <div className="text-red-500 text-xl mb-4">⚠️</div>
                    <p className="text-red-600 font-semibold">Error loading document</p>
                    <p className="text-gray-600 text-sm mt-2">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-white overflow-auto">
            <iframe
                srcDoc={htmlContent}
                className="w-full h-full border-0"
                title="Document Viewer"
                style={{ minHeight: '100vh' }}
            />
        </div>
    );
};
