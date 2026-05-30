import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, handleFirestoreError, OperationType, db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import AnalysisArea from './components/AnalysisArea';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'chat' | 'analysis'>('chat');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Ensure user document exists (simple check)
        const userRef = doc(db, 'users', currentUser.uid);
        try {
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    email: currentUser.email,
                    displayName: currentUser.displayName || '',
                    createdAt: Date.now()
                });
            }
        } catch (e) {
            console.error("Failed to setup user doc", e);
        }
      } else {
        setCurrentSessionId(null);
        setCurrentView('chat');
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F9F7F2]">
        <div className="w-8 h-8 border-4 border-[#5A6B5B] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F9F7F2] font-sans text-[#4A443F] overflow-hidden w-full max-w-[1440px] mx-auto shadow-2xl relative">
      <Sidebar 
        user={user} 
        currentSessionId={currentSessionId} 
        onSelectSession={setCurrentSessionId} 
        currentView={currentView}
        onSetView={setCurrentView}
      />
      {currentView === 'chat' ? (
        <ChatArea 
          user={user} 
          currentSessionId={currentSessionId} 
          onSelectSession={setCurrentSessionId} 
        />
      ) : (
        <AnalysisArea user={user} />
      )}
      
      {/* Hide scrollbar injected style */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none; /* Firefox */
        }
      `}</style>
    </div>
  );
}

