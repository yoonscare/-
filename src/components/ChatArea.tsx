import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, HeartHandshake, Leaf, Coffee, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, updateDoc, doc, getDoc } from 'firebase/firestore';
import { ChatMessage } from '../types';

interface ChatAreaProps {
  user: User | null;
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
}

const QUICK_PROMPTS = [
  { icon: <Leaf size={18} />, text: "오늘 학생 지도 때문에 너무 지쳤어요." },
  { icon: <Coffee size={18} />, text: "학부모님 연락을 받고 마음이 무거워요." },
  { icon: <Smile size={18} />, text: "행정 업무가 너무 많아서 번아웃이 오네요." }
];

export default function ChatArea({ user, currentSessionId, onSelectSession }: ChatAreaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!currentSessionId || !user) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, `sessions/${currentSessionId}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: ChatMessage[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      setMessages(fetched);
      scrollToBottom();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `sessions/${currentSessionId}/messages`);
    });

    return () => unsubscribe();
  }, [currentSessionId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const currentText = text.trim();
    setInput('');
    setIsLoading(true);

    try {
      let sessionId = currentSessionId;
      
      // If user is logged in, use server logic to persist to DB
      if (user) {
        if (!sessionId) {
          // Create new session
          const sessionRef = await addDoc(collection(db, 'sessions'), {
            userId: user.uid,
            title: currentText.slice(0, 30) + (currentText.length > 30 ? '...' : ''),
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
          sessionId = sessionRef.id;
          onSelectSession(sessionId);
        } else {
            const sessionRef = doc(db, 'sessions', sessionId);
            await updateDoc(sessionRef, {
                updatedAt: Date.now()
            });
        }

        // Add user message to DB
        await addDoc(collection(db, `sessions/${sessionId}/messages`), {
          role: 'user',
          text: currentText,
          createdAt: Date.now()
        });

        // Let the server handle AI response, we'll hit our Express endpoint
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            history: messages.map(m => ({ role: m.role, text: m.text })),
            message: currentText
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch response');

        // Add model message to DB
        await addDoc(collection(db, `sessions/${sessionId}/messages`), {
          role: 'model',
          text: data.text,
          createdAt: Date.now()
        });

        // Update session with detected category
        if (data.category && data.category !== '기타') {
            await updateDoc(doc(db, 'sessions', sessionId), {
                category: data.category
            });
        }
      } else {
        // Fallback for not logged in, local state only
        const newUserMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: currentText, createdAt: Date.now() };
        setMessages(prev => [...prev, newUserMsg]);
        
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            history: messages.map(m => ({ role: m.role, text: m.text })),
            message: currentText
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch response');

        const newModelMsg: ChatMessage = { id: (Date.now()+1).toString(), role: 'model', text: data.text, createdAt: Date.now() };
        setMessages(prev => [...prev, newModelMsg]);
      }
    } catch (error) {
      console.error(error);
      if (!user) {
        setMessages(prev => [
            ...prev,
            { id: (Date.now()+1).toString(), role: 'model', text: '연결에 문제가 발생했습니다. (백엔드 오류)', createdAt: Date.now() }
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F9F7F2] text-[#4A443F] flex-1 relative min-w-0">
      {/* Header */}
      <header className="flex items-center justify-between p-6 md:p-8 bg-transparent shrink-0">
        <div className="hidden md:block">
            <h1 className="text-3xl font-serif text-[#3D4B3E] mb-2 font-bold tracking-tight">선생님, 오늘도 고생 많으셨어요.</h1>
            <p className="text-[#7C756B]">잠시 분필을 내려놓고 마음을 돌보는 시간을 가져보세요.</p>
        </div>
        <div className="md:hidden flex-1 text-center font-serif text-xl text-[#3D4B3E]">따뜻한 교무실</div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto w-full px-4 md:px-8 space-y-6 pb-[100px]">
        {messages.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto py-12"
          >
            <div className="w-24 h-24 md:w-32 md:h-32 bg-[#E9EDEA] rounded-full flex items-center justify-center mb-8 border-[6px] border-[#F3EFE9] shadow-inner relative overflow-hidden">
                <div className="absolute inset-0 bg-[#5A6B5B] opacity-10 rounded-full"></div>
                <HeartHandshake className="text-[#5A6B5B] fill-current opacity-70" size={56} />
            </div>
            
            <h2 className="text-3xl font-serif text-[#3D4B3E] mb-4">공감과 위로의 공간</h2>
            <p className="text-[#7C756B] leading-relaxed max-w-md mx-auto mb-10 text-sm md:text-base">
              오직 선생님만을 위한 익명 상담실입니다.<br />
              어떤 이야기든 판단 없이 들어드릴게요.<br />
              편안한 마음으로 시작해보세요.
            </p>

            {/* Quick Prompts */}
            <div className="w-full flex gap-3 overflow-x-auto pb-4 snap-x hide-scrollbar">
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt.text)}
                  className="shrink-0 snap-start flex flex-col items-start p-5 bg-white border border-[#E8E1D5] rounded-[24px] hover:border-[#B68E65] transition-all text-left shadow-sm min-w-[200px] hover:shadow-md cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#F3EFE9] text-[#B68E65] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    {prompt.icon}
                  </div>
                  <span className="text-[#4A443F] font-medium text-sm">{prompt.text}</span>
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col space-y-6 max-w-3xl mx-auto">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[85%] md:max-w-[75%] rounded-[24px] p-5 shadow-sm text-sm md:text-base ${
                      msg.role === 'user' 
                        ? 'bg-[#5A6B5B] text-white rounded-br-sm' 
                        : 'bg-white text-[#4A443F] border border-[#E8E1D5] rounded-bl-sm shadow-md'
                    }`}
                  >
                    {msg.role === 'model' ? (
                      <div className="prose prose-sm md:prose-base prose-stone max-w-none text-[#4A443F] prose-p:leading-relaxed">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-white rounded-[24px] rounded-bl-sm p-5 border border-[#E8E1D5] shadow-sm flex items-center space-x-2 w-20 justify-center h-[60px]">
                  <div className="w-2 h-2 bg-[#DED9D0] rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-[#DED9D0] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-[#DED9D0] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="absolute bottom-6 left-0 right-0 px-4 md:px-8 bg-transparent shrink-0 z-10 pointer-events-none">
        <div className="max-w-3xl mx-auto relative flex items-end bg-white rounded-full shadow-lg border border-[#E8E1D5] transition-shadow p-2 pointer-events-auto shadow-[#5A6B5B]/5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={user ? "선생님, 편하게 마음속 이야기를 들려주세요..." : "로그인하시면 이전 상담을 계속 이어갈 수 있습니다..."}
            className="flex-1 max-h-32 min-h-[48px] bg-transparent resize-none outline-none py-3 px-6 text-[#4A443F] placeholder:text-[#A0AE9F] leading-relaxed"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isLoading}
            className="shrink-0 p-3 mb-1 mr-1 rounded-full bg-[#5A6B5B] text-white hover:bg-[#4A5B4B] disabled:bg-[#D8DFDA] disabled:text-[#F3EFE9] disabled:cursor-not-allowed transition-all shadow-md active:scale-95 flex items-center justify-center w-12 h-12"
          >
            <Send size={20} className="ml-1" />
          </button>
        </div>
      </footer>
    </div>
  );
}
