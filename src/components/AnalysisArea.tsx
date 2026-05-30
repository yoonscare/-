import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Session } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Brain, Sparkles, TrendingUp } from 'lucide-react';

interface AnalysisAreaProps {
  user: User | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  '민원': '#CF8B81',     // Soft red/coral
  '행정업무': '#DDAA76',   // Soft orange/tan
  '학생지도': '#84A59D',   // Soft green
  '수업': '#A8B7AB',       // Mute green
  '관계갈등': '#B5838D',   // Soft purple/mauve
  '기타': '#D8DFDA'        // Gray
};

export default function AnalysisArea({ user }: AnalysisAreaProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('전체');

  const ALL_CATEGORIES = ['전체', '민원', '행정업무', '학생지도', '수업', '관계갈등', '기타'];

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setIsLoading(false);
      return;
    }

    const fetchSessions = async () => {
      try {
        const q = query(
          collection(db, 'sessions'),
          where('userId', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        const fetched: Session[] = [];
        snapshot.forEach(doc => {
          fetched.push({ id: doc.id, ...doc.data() } as Session);
        });
        setSessions(fetched);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'sessions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F9F7F2]">
        <div className="w-8 h-8 border-4 border-[#5A6B5B] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#F9F7F2] p-8 text-center">
        <Brain size={48} className="text-[#A0AE9F] mb-4" />
        <h2 className="text-2xl font-serif text-[#3D4B3E] mb-2">데이터 분석</h2>
        <p className="text-[#7C756B]">로그인하시면 선생님의 스트레스 요인 분석 데이터를 보실 수 있습니다.</p>
      </div>
    );
  }

  // Process data
  const categoryCount: Record<string, number> = {
    '민원': 0, '행정업무': 0, '학생지도': 0, '수업': 0, '관계갈등': 0, '기타': 0
  };

  let analyzedCount = 0;
  sessions.forEach(session => {
    if (session.category) {
      categoryCount[session.category] = (categoryCount[session.category] || 0) + 1;
      analyzedCount++;
    }
  });

  const chartDataAll = Object.entries(categoryCount)
    .filter(([_, count]) => count > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const topCategory = chartDataAll.length > 0 ? chartDataAll[0].name : null;

  const chartData = filterCategory === '전체'
    ? chartDataAll
    : chartDataAll.filter(d => d.name === filterCategory);

  return (
    <div className="flex flex-col h-full bg-[#F9F7F2] text-[#4A443F] flex-1 overflow-y-auto w-full px-4 md:px-12 py-8">
      <header className="mb-10">
        <h1 className="text-3xl font-serif text-[#3D4B3E] mb-2 font-bold tracking-tight">스트레스 요인 분석</h1>
        <p className="text-[#7C756B]">그동안 나누었던 {analyzedCount}번의 상담 기록을 바탕으로 분석한 결과입니다.</p>
      </header>

      {chartDataAll.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white border border-[#E8E1D5] rounded-[32px] shadow-sm">
          <Sparkles size={40} className="text-[#D8DFDA] mb-4" />
          <p className="text-[#7C756B]">아직 충분한 상담 기록이 없습니다.<br/>따뜻한 교무실에서 더 많은 이야기를 나누어보세요.</p>
        </div>
      ) : (
        <div className="space-y-8 max-w-4xl">
          {/* Top insight card */}
          <div className="bg-[#5A6B5B] text-white p-8 rounded-[32px] shadow-md flex items-center justify-between overflow-hidden relative border border-[#4A5B4B]">
            <div className="absolute right-0 top-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl"></div>
            <div className="relative z-10 w-full">
              <div className="flex items-center space-x-2 text-[#E8E1D5] mb-2">
                 <TrendingUp size={18} />
                 <span className="font-medium text-sm">주요 스트레스 요인</span>
              </div>
              <h2 className="text-2xl font-serif leading-relaxed">
                최근 선생님의 가장 큰 고민은 <br/>
                <span className="text-[#F3EFE9] font-bold text-3xl border-b-2 border-white/30 pb-1">'{topCategory}'</span> 관련된 부분입니다.
              </h2>
              <p className="mt-4 text-[#A8B7AB] text-sm">
                해당 영역에 대한 부담을 덜어내기 위해 우선순위를 재조정하거나 주변의 도움을 요청하는 것을 고려해보세요.
              </p>
            </div>
          </div>

          {/* Filter Categories */}
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map(cat => (
               <button
                 key={cat}
                 onClick={() => setFilterCategory(cat)}
                 className={`px-4 py-2 rounded-full text-sm transition-colors border shadow-sm ${
                   filterCategory === cat 
                     ? 'bg-[#5A6B5B] text-white border-[#5A6B5B]' 
                     : 'bg-white text-[#7C756B] border-[#E8E1D5] hover:border-[#B68E65]'
                 }`}
               >
                 {cat}
               </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Pie Chart Card */}
            <div className="bg-white p-6 rounded-[32px] border border-[#E8E1D5] shadow-sm">
              <h3 className="font-serif text-[#3D4B3E] text-xl mb-6">스트레스 분포율</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || '#D8DFDA'} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#4A443F', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="flex flex-wrap gap-4 justify-center mt-4 text-sm">
                {chartData.map((entry, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[entry.name] || '#D8DFDA' }}></div>
                    <span className="text-[#7C756B]">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bar Chart Card */}
            <div className="bg-white p-6 rounded-[32px] border border-[#E8E1D5] shadow-sm">
              <h3 className="font-serif text-[#3D4B3E] text-xl mb-6">분류별 상담 횟수</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0EBE1" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#A0AE9F', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#A0AE9F', fontSize: 12 }} allowDecimals={false} />
                    <Tooltip 
                       cursor={{ fill: '#F3EFE9' }}
                       contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || '#D8DFDA'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
