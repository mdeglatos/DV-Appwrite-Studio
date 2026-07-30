
import React, { useRef, useEffect } from 'react';
import type { Models } from 'appwrite';
import type { Message, AppwriteProject, AppwriteFunction, UserPrefs } from '../types';
import { ChatMessage } from './ChatMessage';
import { LoadingSpinnerIcon, BotIcon } from './Icons';

interface MainContentProps {
    messages: Message[];
    activeProject: AppwriteProject | null;
    selectedFunction: AppwriteFunction | null;
    isFunctionContextLoading: boolean;
    currentUser: Models.User<UserPrefs>;
    isLeftSidebarOpen: boolean;
    setIsLeftSidebarOpen: (isOpen: boolean) => void;
}

const EmptyState = ({ title, description, icon, action }: { title: string, description: string, icon?: React.ReactNode, action?: React.ReactNode }) => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-fade-in">
       <div className="relative group mb-8">
           <div className="absolute -inset-8 bg-gradient-to-t from-cyan-600/20 to-purple-600/20 rounded-full blur-2xl opacity-50"></div>
           <div className="relative w-24 h-24 bg-gray-900/80 backdrop-blur-xl rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl">
               {icon || <BotIcon size={48} className="text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />}
           </div>
       </div>
       <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">{title}</h2>
       <p className="text-gray-400 max-w-lg mb-8 leading-relaxed text-lg">{description}</p>
       {action}
   </div>
);

export const MainContent: React.FC<MainContentProps> = ({
    messages,
    activeProject,
    selectedFunction,
    isFunctionContextLoading,
    currentUser,
    setIsLeftSidebarOpen,
}) => {
    const chatContainerRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const renderWelcomeMessage = () => {
        if (isFunctionContextLoading) {
             return <EmptyState 
                title="Syncing Context" 
                description="Loading function code and dependencies..." 
                icon={<LoadingSpinnerIcon className="animate-spin text-cyan-400" />} 
             />;
        }
        if (!activeProject) {
            return <EmptyState 
                title={`Welcome, ${currentUser.name}`} 
                description="Select an Appwrite project to begin managing your infrastructure."
                action={
                     <button onClick={() => setIsLeftSidebarOpen(true)} className="px-8 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 rounded-full text-white font-medium transition-all hover:scale-105 shadow-lg">
                        Open Menu
                    </button>
                }
            />;
        }
        if (selectedFunction) {
             return <EmptyState 
                title="Engineering Mode" 
                description={`Context loaded for "${selectedFunction.name}". I can read, edit, and deploy your code.`}
                icon={<span className="text-5xl">👨‍💻</span>}
             />;
        }
        
        return <EmptyState 
            title="System Ready" 
            description={`Connected to "${activeProject.name}". Manage databases, storage, users, or write serverless functions.`}
        />;
    };

    return (
        <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth custom-scrollbar relative">
            <div className="max-w-3xl mx-auto min-h-full flex flex-col space-y-6">
                {messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        {renderWelcomeMessage()}
                    </div>
                ) : (
                    messages.map((msg) => (
                        <ChatMessage key={msg.id} message={msg} />
                    ))
                )}
            </div>
        </main>
    );
};
