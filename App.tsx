
import React, { useEffect } from 'react';
import LoginPage from './components/LoginPage';
import { AgentApp } from './components/AgentApp';
import { LandingPage } from './components/LandingPage';
import { LoadingSpinnerIcon } from './components/Icons';
import { useAuth } from './hooks/useAuth';
import { useRouter, routes } from './services/router';

const App: React.FC = () => {
    // isAuthLoading is now only true during the very first session check
    const { currentUser, setCurrentUser, isAuthLoading, handleLogout, refreshUser } = useAuth();
    const { route, navigate } = useRouter();

    useEffect(() => {
        if (isAuthLoading) return;

        if (currentUser) {
            // An unmatched path must never reach a render — send it to the project resolver.
            if (route.name === 'login' || route.name === 'landing' || route.name === 'not-found') {
                navigate('/', { replace: true });
            }
        } else {
            if (route.name !== 'login' && route.name !== 'landing') {
                navigate(routes.landing(), { replace: true });
            }
        }
    }, [currentUser, isAuthLoading, route.name, navigate]);

    if (isAuthLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-100 font-sans">
                <div className="flex flex-col items-center gap-4 animate-fade-in">
                    <LoadingSpinnerIcon />
                    <p className="text-gray-400 text-sm tracking-wider uppercase">Initializing Studio...</p>
                </div>
            </div>
        );
    }

    if (currentUser) {
        return <AgentApp currentUser={currentUser} onLogout={handleLogout} refreshUser={refreshUser} />;
    }

    if (route.name === 'login') {
        return <LoginPage onLoginSuccess={setCurrentUser} />;
    }

    return <LandingPage onGetStarted={() => navigate(routes.login())} />;
};

export default App;
