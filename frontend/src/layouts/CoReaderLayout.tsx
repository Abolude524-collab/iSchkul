import React, { ReactNode } from 'react';

interface CoReaderLayoutProps {
    children: ReactNode;
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
    sidebar: ReactNode;
}

export const CoReaderLayout: React.FC<CoReaderLayoutProps> = ({
    children,
    sidebar,
    isSidebarOpen,
    onToggleSidebar,
}) => {
    return (
        <div className="flex h-screen overflow-hidden bg-gray-50 relative">
            {/* Main Content Area (PDF) */}
            <div
                className="h-full transition-all duration-300 ease-in-out"
                style={{ width: isSidebarOpen ? 'calc(100% - min(90vw, 400px))' : '100%' }}
            >
                <div className="h-full w-full relative">
                    {children}

                    {/* Toggle Button */}
                    <button
                        onClick={onToggleSidebar}
                        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-full text-white text-sm sm:text-base font-medium shadow-lg transition-all duration-300 hover:scale-105 ${isSidebarOpen
                                ? 'bg-gradient-to-r from-purple-600 to-blue-600 translate-x-[-280px] sm:translate-x-[-320px] md:translate-x-[-25vw]'
                                : 'bg-gradient-to-r from-blue-600 to-purple-600'
                            }`}
                    >
                        {isSidebarOpen ? (
                            <>
                                <span className="hidden sm:inline">Hide AI</span>
                                <span className="sm:hidden">Hide</span>
                            </>
                        ) : (
                            <>
                                <span className="hidden sm:inline">✨ AI Co-Reader</span>
                                <span className="sm:hidden">✨ AI</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Sidebar Area (AI Chat) */}
            <div
                className={`absolute right-0 top-0 h-full bg-white border-l shadow-xl transition-transform duration-300 ease-in-out z-40 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                style={{ width: 'min(90vw, 400px)' }}
            >
                {sidebar}
            </div>
        </div>
    );
};
