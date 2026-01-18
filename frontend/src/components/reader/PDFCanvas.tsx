import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up worker

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

interface PDFCanvasProps {
    fileUrl: string;
    onPageChange: (pageNumber: number) => void;
}

export const PDFCanvas: React.FC<PDFCanvasProps> = ({ fileUrl, onPageChange }) => {
    const [numPages, setNumPages] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Log once on mount
    useEffect(() => {
        console.log('📄 PDFCanvas mounted - Loading PDF:', fileUrl);
        console.log('🔑 PDFCanvas - Token exists:', !!localStorage.getItem('authToken'));
    }, [fileUrl]);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        console.log('📄 PDF loaded successfully - Pages:', numPages);
        setNumPages(numPages);
    }

    function onDocumentLoadError(error: Error) {
        console.error('🔴 PDF load error:', error);
    }

    // Memoize document options to prevent unnecessary reloads
    const documentOptions = useMemo(() => {
        const token = localStorage.getItem('authToken');
        console.log('📄 PDFCanvas - Creating options with token:', !!token);
        
        return {
            httpHeaders: {
                'Authorization': `Bearer ${token}`
            }
        };
    }, []); // Empty deps - only create once on mount

    // Intersection Observer for page tracking
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const pageNum = parseInt(entry.target.getAttribute('data-page-number') || '1');
                        onPageChange(pageNum);
                    }
                });
            },
            {
                root: containerRef.current,
                threshold: 0.5, // 50% visibility to trigger
            }
        );

        const pages = document.querySelectorAll('.pdf-page');
        pages.forEach((page) => observer.observe(page));

        return () => observer.disconnect();
    }, [numPages]);

    return (
        <div className="h-full overflow-y-auto bg-gray-200 p-8 flex justify-center" ref={containerRef}>
            <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                options={documentOptions}
                className="flex flex-col gap-4 items-center"
            >
                {Array.from(new Array(numPages), (el, index) => (
                    <div
                        key={`page_${index + 1}`}
                        className="pdf-page shadow-lg"
                        data-page-number={index + 1}
                    >
                        <Page
                            pageNumber={index + 1}
                            width={800} // Fixed width for now, responsive later
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                        />
                    </div>
                ))}
            </Document>
        </div>
    );
};
