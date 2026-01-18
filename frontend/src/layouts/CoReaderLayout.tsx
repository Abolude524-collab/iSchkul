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
                style={{ width: isSidebarOpen ? '70%' : '100%' }}
            >
                <div className="h-full w-full relative">
                    {children}

                    {/* Toggle Button */}
                    <button
                        onClick={onToggleSidebar}
                        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-6 py-3 rounded-full text-white font-medium shadow-lg transition-all duration-300 hover:scale-105 ${isSidebarOpen
                                ? 'bg-gradient-to-r from-purple-600 to-blue-600 translate-x-[-320px] md:translate-x-[-25vw]'
                                : 'bg-gradient-to-r from-blue-600 to-purple-600'
                            }`}
                    >
                        {isSidebarOpen ? (
                            <>
                                <span>Hide AI</span>
                            </>
                        ) : (
                            <>
                                <span>✨ AI Co-Reader</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Sidebar Area (AI Chat) */}
            <div
                className={`absolute right-0 top-0 h-full bg-white border-l shadow-xl transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                style={{ width: '30%', minWidth: '320px' }}
            >
                {sidebar}
            </div>
        </div>
    );
};
