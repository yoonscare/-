import { useState, useEffect } from 'react';
import { LogOut, Plus, MessageSquare, Menu, X, LogIn, PieChart as PieChartIcon } from 'lucide-react';
import { User } from 'firebase/auth';
import { auth, loginWithGoogle, logout, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { Session } from '../types';

interface SidebarProps {
  user: User | null;
  currentSessionId: string | null;
  onSelectSession: (id: string | null) => void;
  currentView: 'chat' | 'analysis';
  onSetView: (view: 'chat' | 'analysis') => void;
}

export default function Sidebar({ user, currentSessionId, onSelectSession, currentView, onSetView }: SidebarProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      return;
    }

    const q = query(
      collection(db, 'sessions'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Session[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() } as Session);
      });
      setSessions(fetched);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sessions');
    });

    return () => unsubscribe();
  }, [user]);

  const toggleSidebar = () => setIsOpen(!isOpen);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#5A6B5B] text-[#F9F7F2]">
      <div className="p-6 flex items-center justify-between border-b border-[#4A5B4B]">
        <h2 className="font-serif text-xl">상담 기록</h2>
        <button onClick={toggleSidebar} className="md:hidden text-[#E8E1D5] hover:text-white">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <button
          onClick={() => { onSelectSession(null); onSetView('chat'); setIsOpen(false); }}
          className={`w-full flex items-center p-3 rounded-2xl transition-colors ${
            !currentSessionId && currentView === 'chat' ? 'bg-[#7C8F7C] text-white shadow-inner' : 'hover:bg-[#4A5B4B] text-[#D8DFDA]'
          }`}
        >
          <Plus size={20} className="mr-3 shrink-0" />
          <span className="truncate">새로운 상담 시작</span>
        </button>

        <button
          onClick={() => { onSetView('analysis'); setIsOpen(false); }}
          className={`w-full flex items-center p-3 rounded-2xl transition-colors mt-2 ${
            currentView === 'analysis' ? 'bg-[#7C8F7C] text-white shadow-inner' : 'hover:bg-[#4A5B4B] text-[#D8DFDA]'
          }`}
        >
          <PieChartIcon size={20} className="mr-3 shrink-0" />
          <span className="truncate">데이터 분석</span>
        </button>

        <div className="pt-6 pb-2 text-xs font-semibold uppercase tracking-wider text-[#A0AE9F] px-3">
          이전 상담
        </div>

        {sessions.length === 0 ? (
          <div className="text-sm text-[#A0AE9F] px-4 py-6 text-center">
            아직 기록된 상담이 없습니다.
          </div>
        ) : (
          sessions.map(session => (
            <button
              key={session.id}
              onClick={() => { onSelectSession(session.id); onSetView('chat'); setIsOpen(false); }}
              className={`w-full flex items-center p-3 rounded-2xl transition-colors text-left ${
                currentSessionId === session.id && currentView === 'chat' ? 'bg-[#7C8F7C] text-white shadow-inner' : 'hover:bg-[#4A5B4B] text-[#D8DFDA]'
              }`}
              title={session.title}
            >
              <MessageSquare size={18} className="mr-3 shrink-0 opacity-70" />
              <span className="truncate text-sm">{session.title || '새로운 상담'}</span>
            </button>
          ))
        )}
      </div>

      <div className="p-4 border-t border-[#4A5B4B] mt-auto">
        {user ? (
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center overflow-hidden mr-3">
              <div className="w-8 h-8 rounded-full bg-[#B68E65] text-white flex items-center justify-center font-bold shrink-0 mr-3 text-sm">
                {user.displayName?.[0] || user.email?.[0] || 'T'}
              </div>
              <div className="truncate text-sm text-[#D8DFDA]">
                {user.displayName || '선생님'}
              </div>
            </div>
            <button onClick={logout} className="p-2 text-[#E8E1D5] hover:text-white rounded-full hover:bg-[#4A5B4B] transition-colors" aria-label="로그아웃">
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button 
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center p-3 rounded-2xl bg-[#B68E65] text-white font-medium hover:bg-[#A37B55] transition-colors"
          >
            <LogIn size={20} className="mr-3" />
            구글로 로그인
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button 
        onClick={toggleSidebar}
        className="md:hidden fixed top-6 left-6 z-50 p-2 bg-[#5A6B5B] text-white rounded-xl shadow-md"
      >
        <Menu size={24} />
      </button>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 h-screen shrink-0 relative z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-[#3D4B3E]/40 backdrop-blur-sm" onClick={toggleSidebar}>
          <div 
            className="w-80 max-w-[80vw] h-full shadow-2xl transition-transform" 
            onClick={e => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
