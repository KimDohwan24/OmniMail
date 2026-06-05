import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Shield, 
  Settings, 
  BarChart2, 
  LogIn, 
  LogOut, 
  Sun, 
  Moon, 
  Inbox,
  Lock,
  ShieldAlert
} from 'lucide-react';
import { useMailStore } from './store';
import { MailSidebar } from './features/mail-sidebar';
import { MailList, SlideOverViewer } from './features/mail-viewer';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
dayjs.locale('ko');

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import './App.css';

const statsData = [
  { name: '월', emails: 14 },
  { name: '화', emails: 28 },
  { name: '수', emails: 19 },
  { name: '목', emails: 34 },
  { name: '금', emails: 23 },
  { name: '토', emails: 8 },
  { name: '일', emails: 12 },
];

/**
 * App Component (OmniMail 통합 메인 진입점 - 도메인 감지 및 교차 검증 탑재)
 * 
 * [학습 포인트]
 * 1. 통합 도메인 추론 폼: 이메일을 타이핑하면 detectAccountType에 의해 실시간으로 
 *    구글/네이버 브랜드 테두리와 아이콘이 동적으로 페이드인 전환됩니다.
 * 2. 교차 검증 경고 피드백: mismatchError가 수신되면, 계정 믹스매치 방지를 위한 보안 알림을 출력합니다.
 * 3. 웜 크림 테마 & 1px Hairline: 독자적 디자인 규격을 흔들림 없이 유지합니다.
 */
const PROVIDERS = {
  naver: {
    name: 'Naver Mail',
    brandColor: '#03C75A',
    glowColor: 'rgba(3, 199, 90, 0.15)',
    bgGlow: 'shadow-[0_0_20px_rgba(3,199,90,0.12)]',
    accentBorder: 'border-[#03C75A]/30',
    loginUrl: 'https://nid.naver.com/nidlogin.login',
    avatarBg: 'bg-[#03C75A]',
    char: 'N'
  },
  gmail: {
    name: 'Gmail',
    brandColor: '#EA4335',
    glowColor: 'rgba(234, 67, 53, 0.15)',
    bgGlow: 'shadow-[0_0_20px_rgba(234,67,53,0.12)]',
    accentBorder: 'border-[#EA4335]/30',
    loginUrl: 'https://accounts.google.com/',
    avatarBg: 'bg-[#EA4335]',
    char: 'G'
  }
};

const containerVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const cardVariants = {
  initial: { y: 15, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { x: -40, opacity: 0, transition: { duration: 0.2 } }
};

function App() {
  const { 
    accounts, 
    emails,
    theme, 
    connectAccount, 
    disconnectAccount, 
    toggleTheme,
    selectedMail,
    setSelectedMail,
    fetchEmails,
    isSyncing,
    mismatchError,
    isHydrated,
    hydrateSyncState,
    connectionError,
    detectedSessions,
    detectSessions,
    hasHostPermissions,
    sessionDebugLogs
  } = useMailStore();

  const handleRequestPermissions = () => {
    if (typeof chrome !== 'undefined' && chrome.permissions && chrome.permissions.request) {
      chrome.permissions.request({
        origins: [
          "*://*.naver.com/*",
          "*://*.google.com/*"
        ]
      }, (granted) => {
        if (granted) {
          useMailStore.getState().checkHostPermissions().then(() => {
            useMailStore.getState().detectSessions();
          });
        }
      });
    }
  };

  const [copied, setCopied] = useState(false);
  const [showDebugLogs, setShowDebugLogs] = useState(false);

  const handleCopyLogs = () => {
    const logText = sessionDebugLogs.join('\n');
    navigator.clipboard.writeText(logText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const [activeTab, setActiveTab] = useState('overview');

  const [isInline, setIsInline] = useState(false);

  const isExtensionEnv = typeof chrome !== 'undefined' && 
                         chrome.runtime && 
                         chrome.runtime.id && 
                         window.location.protocol === 'chrome-extension:';

  // 앱 구동 시 최초 1회 메일 동기화 실행 및 화면 크기/포커스 감지 리스너 등록
  useEffect(() => {
    const init = async () => {
      // 로컬 스토리지로부터 연동 상태 복구 후 동기화 수행
      await hydrateSyncState();
      fetchEmails(true);
    };
    init();

    // 1024px(lg) 이상일 때 인라인 3단 레이아웃 활성화
    const handleResize = () => {
      setIsInline(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // 창 포커스 진입 시 백그라운드 쿨다운 기반 동기화 구동 및 세션 리프레시
    const handleFocus = () => {
      fetchEmails(false);
      detectSessions();
    };
    window.addEventListener('focus', handleFocus);

    // Esc 키 입력 시 상세 메일 뷰 닫기 (PM 가이드라인에 따른 사용성 강화)
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedMail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fetchEmails, setSelectedMail, hydrateSyncState, detectSessions]);

  if (!isHydrated) {
    return (
      <div className="flex h-screen w-screen overflow-hidden font-sans text-cursor-body bg-cursor-canvas justify-center items-center">
        {/* 글래스모피즘 스켈레톤 쉬머 */}
        <div className="w-full max-w-4xl p-6 flex flex-col gap-6 animate-pulse">
          <div className="h-8 bg-cursor-surface-strong/30 rounded-lg w-1/4 backdrop-blur-md" />
          <div className="flex gap-6 h-[400px]">
            <div className="w-64 bg-cursor-surface-strong/20 rounded-xl backdrop-blur-md flex flex-col p-4 gap-4">
              <div className="h-6 bg-cursor-surface-strong/30 rounded w-3/4 animate-pulse" />
              <div className="h-6 bg-cursor-surface-strong/30 rounded w-1/2 animate-pulse" />
              <div className="h-6 bg-cursor-surface-strong/30 rounded w-5/6 animate-pulse" />
            </div>
            <div className="flex-1 bg-cursor-surface-strong/10 rounded-xl backdrop-blur-md p-6 flex flex-col gap-4">
              <div className="h-8 bg-cursor-surface-strong/30 rounded animate-pulse" />
              <div className="h-24 bg-cursor-surface-strong/20 rounded animate-pulse" />
              <div className="h-24 bg-cursor-surface-strong/20 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans text-cursor-body bg-cursor-canvas relative">
      
      {/* ---------------- 0단: 통신 차단 글래스모피즘 오버레이 ---------------- */}
      <AnimatePresence>
        {connectionError && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-zinc-950/60"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="p-8 max-w-md w-full rounded-2xl border border-cursor-hairline bg-cursor-surface-card flex flex-col items-center gap-5 text-center select-none shadow-2xl"
            >
              <div className="w-14 h-14 rounded-full bg-cursor-semantic-error/10 flex items-center justify-center text-cursor-semantic-error animate-pulse">
                <ShieldAlert size={28} />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="font-semibold text-sm text-cursor-ink">
                  OmniMail 서비스 일시 연결 지연
                </h3>
                <p className="text-xs text-cursor-muted leading-relaxed">
                  브라우저 환경 변화 또는 업데이트로 인해 서비스 엔진과의 연결이 잠시 지연되고 있습니다.
                  페이지를 새로고침하면 자동으로 안전하게 재연결됩니다.
                </p>
                <div className="text-[10px] text-cursor-muted/80 bg-cursor-canvas-soft border border-cursor-hairline p-2.5 rounded font-mono leading-relaxed mt-1 text-left">
                  1단계: 아래 버튼을 눌러 페이지를 새로고침합니다.<br />
                  2단계: 새로고침 후에도 연결이 안 될 경우, 브라우저 우측 상단 확장 프로그램 아이콘(퍼즐 모양) 클릭 후 OmniMail을 꺼짐 상태로 변경했다가 다시 켜주세요.
                </div>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2 bg-cursor-primary hover:bg-cursor-primary-active text-white rounded text-xs font-semibold shadow transition-all cursor-pointer"
              >
                대시보드 페이지 새로고침
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* ---------------- 1단: Slim Left Control Bar (64px) ---------------- */}
      <aside className="w-16 flex flex-col items-center py-6 justify-between border-r border-cursor-hairline bg-cursor-surface-strong/40 shrink-0">
          <div className="flex flex-col items-center gap-6">
            <div className="w-10 h-10 rounded-xl bg-cursor-primary flex items-center justify-center">
              <Mail className="text-white" size={20} />
            </div>
            
            <div className="h-px w-8 bg-cursor-hairline" />

            <button 
              onClick={() => setActiveTab('overview')}
              className={`p-3 rounded-xl transition-all duration-200 cursor-pointer ${
                activeTab === 'overview' 
                  ? 'bg-cursor-surface-strong text-cursor-primary' 
                  : 'text-cursor-muted hover:text-cursor-ink hover:bg-cursor-canvas'
              }`}
            >
              <Inbox size={20} />
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`p-3 rounded-xl transition-all duration-200 cursor-pointer ${
                activeTab === 'analytics' 
                  ? 'bg-cursor-surface-strong text-cursor-primary' 
                  : 'text-cursor-muted hover:text-cursor-ink hover:bg-cursor-canvas'
              }`}
            >
              <BarChart2 size={20} />
            </button>
          </div>

          <div className="flex flex-col items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-3 rounded-xl text-cursor-muted hover:text-cursor-ink hover:bg-cursor-canvas transition-all duration-200 cursor-pointer"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="p-3 rounded-xl text-cursor-muted hover:text-cursor-ink hover:bg-cursor-canvas transition-all cursor-pointer">
              <Settings size={20} />
            </button>
          </div>
        </aside>

        {/* ---------------- 2단: MailSidebar (256px) ---------------- */}
        <MailSidebar />

        {/* ---------------- 3단: Main Content Area ---------------- */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* 헤더 바 */}
          <header className="h-16 px-6 flex items-center justify-between border-b border-cursor-hairline bg-cursor-canvas">
            <div className="flex flex-col">
              <h1 className="text-sm font-semibold tracking-wide text-cursor-ink">
                OmniMail 통합 메일 대시보드
              </h1>
              <span className="text-[10px] text-cursor-muted">
                {dayjs().format('YYYY년 MM월 DD일 dddd')}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cursor-surface-strong/50 border border-cursor-hairline text-xs font-medium text-cursor-ink font-sans">
                <span className={`w-2 h-2 rounded-full animate-pulse transition-colors duration-300 ${
                  isSyncing ? 'bg-[#dfa88f]' : 'bg-[#1f8a65]'
                }`} />
                {isSyncing ? '실시간 동기화 진행 중...' : '실시간 백그라운드 동기화 브로커 구동 중'}
              </div>
            </div>
          </header>

          {/* 탭 분기 렌더링 */}
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' ? (
                // ---------------- OVERVIEW TAB ----------------
                <motion.div 
                  key="overview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full w-full flex overflow-hidden relative"
                >
                  {/* 메일 리스트 영역 (선택 여부에 따라 너비 동적 가변 & 튕김 방지 트랜지션 적용) */}
                  <div className={`h-full flex flex-col transition-all duration-300 ease-in-out ${
                    isInline && selectedMail ? 'w-[400px] xl:w-[480px] shrink-0 border-r border-cursor-hairline-strong' : 'flex-1'
                  }`}>
                    <MailList />
                  </div>

                  {/* 우측 슬롯: 대화면(isInline)에서 메일 선택 상태에 따라 '상세 뷰어'와 '계정 설정'을 크로스페이드 스위칭 */}
                  <AnimatePresence mode="wait">
                    {isInline && selectedMail ? (
                      /* 3단 인라인 상세 뷰어 (대화면에서 메일 선택 시 우측 계정관리를 대체하여 노출) */
                      <SlideOverViewer 
                        key="viewer"
                        email={selectedMail}
                        onClose={() => setSelectedMail(null)}
                        isInline={true}
                      />
                    ) : (
                      /* 우측 사이드바: 계정 관리 및 교차 검증 안내 */
                      <motion.div 
                        key="accounts"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                        className="w-80 border-l border-cursor-hairline bg-cursor-canvas-soft p-5 flex flex-col gap-6 overflow-y-auto shrink-0 select-none"
                      >
                        
                        {/* [보안 조치] 계정 교차 검증 경고 배너 표시 */}
                        {mismatchError && (
                          <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="p-4 rounded-xl border border-cursor-semantic-error/40 bg-cursor-semantic-error/5 text-xs text-cursor-semantic-error flex flex-col gap-2 keep-all"
                          >
                            {mismatchError.type === 'session_expired' ? (
                              <>
                                <div className="flex items-center gap-2 font-semibold">
                                  <ShieldAlert size={16} />
                                  <span>로그인 세션 만료</span>
                                </div>
                                <p className="leading-relaxed text-[11px] text-cursor-body">
                                  {mismatchError.message}
                                </p>
                                <a 
                                  href={mismatchError.accountId === 'naver' ? 'https://mail.naver.com/' : 'https://mail.google.com/'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 px-3 py-1.5 bg-cursor-semantic-error/20 hover:bg-cursor-semantic-error/30 text-[10px] font-semibold text-center rounded transition-all cursor-pointer text-cursor-semantic-error hover:no-underline"
                                >
                                  {mismatchError.accountId === 'naver' ? '네이버 로그인 페이지 이동' : '구글 로그인 페이지 이동'}
                                </a>
                              </>
                            ) : (
                              <div className="flex items-center gap-2 font-semibold">
                                <ShieldAlert size={16} />
                                <span>계정 정보 불일치</span>
                              </div>
                            )}
                          </motion.div>
                        )}
                        
                        {/* 호스트 권한 경고/요청 배너 (Amber Soft Banner) */}
                        <AnimatePresence mode="wait">
                          {!hasHostPermissions && (
                            <motion.div
                              variants={{
                                initial: { opacity: 0, scale: 0.95, height: 0, overflow: 'hidden' },
                                animate: { 
                                  opacity: 1, 
                                  scale: 1, 
                                  height: 'auto', 
                                  transition: { height: { duration: 0.2 }, opacity: { duration: 0.15 } }
                                },
                                exit: { 
                                  opacity: 0, 
                                  height: 0, 
                                  paddingTop: 0, 
                                  paddingBottom: 0,
                                  marginTop: 0,
                                  marginBottom: 0,
                                  overflow: "hidden",
                                  transition: { 
                                    height: { duration: 0.25 }, 
                                    opacity: { duration: 0.15 } 
                                  }
                                }
                              }}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              className="p-3 bg-amber-500/10 text-amber-300 border border-amber-500/20 backdrop-blur-md rounded-xl flex flex-col gap-2.5 mb-4"
                            >
                              <div className="flex items-start gap-2.5">
                                <div className="p-1 bg-amber-500/10 text-amber-400 rounded-lg shrink-0 mt-0.5">
                                  <ShieldAlert size={16} />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <h4 className="text-xs font-bold text-amber-200">
                                    세션 감지 권한 필요
                                  </h4>
                                  <p className="text-[10px] text-amber-300/80 leading-relaxed">
                                    실시간 이메일 세션 감지를 위해 브라우저 연동 권한 승인이 필요합니다.
                                  </p>
                                </div>
                              </div>
                              
                              <button
                                onClick={handleRequestPermissions}
                                className="w-full py-1.5 bg-amber-500 text-neutral-950 text-[10px] font-bold rounded-lg transition-all hover:bg-amber-400 cursor-pointer shadow-sm hover:shadow"
                              >
                                세션 권한 승인하기
                              </button>
                              
                              <p className="text-[9px] text-amber-400/60 leading-normal text-center">
                                ※ 보안 안내: OmniMail은 비밀번호를 저장하지 않으며, 백그라운드 세션 감지 목적으로만 이 권한을 사용합니다.
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        <div className="flex flex-col gap-5">
                          <div className="flex justify-between items-center mb-1">
                            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-cursor-muted">
                              연동 계정 설정
                            </h2>
                            {isSyncing && (
                              <span className="text-[9px] text-cursor-primary animate-pulse font-mono font-semibold">
                                세션 스캔 중...
                              </span>
                            )}
                          </div>

                          {/* 4대 메일사 세션 원클릭 연동 리스트 (세로 한 줄 정렬) */}
                          <motion.div 
                            variants={containerVariants}
                            initial="initial"
                            animate="animate"
                            className="flex flex-col gap-3"
                          >
                            <AnimatePresence mode="popLayout">
                              {(() => {
                                const visibleAccounts = accounts.filter(acc => {
                                  const hasSession = detectedSessions && detectedSessions[acc.id];
                                  const isErrorAccount = mismatchError && mismatchError.accountId === acc.id;
                                  return acc.connected || hasSession || isErrorAccount;
                                });

                                if (visibleAccounts.length === 0) {
                                  return (
                                    <motion.div 
                                      key="empty-sessions"
                                      variants={cardVariants}
                                      className="p-6 rounded-2xl border border-dashed border-white/5 bg-cursor-surface-card/10 flex flex-col items-center justify-center text-center gap-4 py-8 select-none"
                                    >
                                      <div className="p-3 bg-cursor-primary/10 text-cursor-primary rounded-2xl animate-pulse">
                                        <Lock size={20} />
                                      </div>
                                      <div className="flex flex-col gap-1 max-w-[280px]">
                                        <h4 className="text-xs font-bold text-cursor-ink">감지된 메일 세션이 없습니다</h4>
                                        <p className="text-[10px] text-cursor-muted leading-relaxed">
                                          브라우저에서 Naver 또는 Google에 로그인하면 실시간으로 감지되어 연동 리스트에 나타납니다.
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2 mt-2">
                                        <a 
                                          href="https://nid.naver.com/nidlogin.login"
                                          target="_blank"
                                          rel="noreferrer"
                                          className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-500 text-[10px] font-bold rounded-lg transition-all hover:no-underline"
                                        >
                                          네이버 로그인
                                        </a>
                                        <a 
                                          href="https://accounts.google.com/"
                                          target="_blank"
                                          rel="noreferrer"
                                          className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-500 text-[10px] font-bold rounded-lg transition-all hover:no-underline"
                                        >
                                          구글 로그인
                                        </a>
                                      </div>
                                    </motion.div>
                                  );
                                }

                                return visibleAccounts.map(acc => {
                                  const pInfo = PROVIDERS[acc.id] || PROVIDERS.naver;
                                  const hasSession = detectedSessions && detectedSessions[acc.id];
                                  
                                  return (
                                    <motion.div 
                                      key={acc.id}
                                      variants={cardVariants}
                                      layout
                                      className={`p-3 px-4 rounded-xl border backdrop-blur-xl transition-all duration-300 bg-cursor-surface-card/45 flex items-center justify-between gap-4 ${
                                        acc.connected 
                                          ? 'bg-emerald-500/[0.02]' 
                                          : hasSession 
                                            ? 'bg-cursor-surface-card/60' 
                                            : 'opacity-65 bg-cursor-surface-card/20 hover:opacity-85'
                                      }`}
                                      style={{
                                        borderColor: acc.connected 
                                          ? 'rgba(16, 185, 129, 0.4)' 
                                          : hasSession 
                                            ? `${pInfo.brandColor}4D` 
                                            : 'rgba(255, 255, 255, 0.06)',
                                        boxShadow: acc.connected 
                                          ? '0 0 15px rgba(16, 185, 129, 0.08)' 
                                          : hasSession 
                                            ? `0 0 15px ${pInfo.glowColor}` 
                                            : 'none'
                                      }}
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-8 h-8 rounded-xl ${pInfo.avatarBg} flex items-center justify-center text-white font-black text-sm shadow-sm shrink-0`}>
                                          {pInfo.char}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <h4 className="font-bold text-xs text-cursor-ink">{pInfo.name}</h4>
                                            {!acc.connected && hasSession && (
                                              <span className="text-[8px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 font-bold tracking-wider shrink-0 uppercase animate-pulse rounded">
                                                Detected
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[10px] text-cursor-muted mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap font-mono max-w-[150px] sm:max-w-[250px]" title={acc.connected ? acc.email : (hasSession ? detectedSessions[acc.id] : '')}>
                                            {acc.connected 
                                              ? acc.email 
                                              : hasSession 
                                                ? detectedSessions[acc.id]
                                                : '세션 감지되지 않음'}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-3.5 shrink-0">
                                        <span className="text-[9px] text-cursor-muted font-medium hidden sm:inline">
                                          {acc.connected 
                                            ? '연동 완료' 
                                            : hasSession 
                                              ? '연동 가능' 
                                              : '로그인 필요'}
                                        </span>
                                        
                                        <div className="flex items-center gap-1.5">
                                          {acc.connected ? (
                                            <button 
                                              onClick={() => disconnectAccount(acc.id)}
                                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-all text-[10px] font-semibold cursor-pointer"
                                              title="연동 해제"
                                            >
                                              <LogOut size={10} />
                                              <span>해제</span>
                                            </button>
                                          ) : hasSession ? (
                                            <button 
                                              onClick={async () => {
                                                await connectAccount(acc.id, detectedSessions[acc.id]);
                                                setTimeout(() => {
                                                  fetchEmails(true);
                                                }, 150);
                                              }}
                                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all text-[10px] font-semibold cursor-pointer shadow-[0_2px_8px_rgba(16,185,129,0.2)]"
                                              title="원클릭 연동 시작"
                                            >
                                              <LogIn size={10} />
                                              <span>즉시 연동</span>
                                            </button>
                                          ) : (
                                            <a 
                                              href={pInfo.loginUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cursor-surface-strong hover:bg-cursor-surface-strong/80 text-cursor-ink transition-all text-[10px] font-semibold hover:no-underline"
                                              title="브라우저에서 로그인하기"
                                            >
                                              <Lock size={9} />
                                              <span>로그인</span>
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </motion.div>
                                  );
                                });
                              })()}
                            </AnimatePresence>
                          </motion.div>

                          {/* 🔧 연동 진단 로그 아코디언 */}
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => setShowDebugLogs(!showDebugLogs)}
                              className="flex items-center justify-between px-3 py-2 rounded-lg border border-cursor-hairline bg-cursor-surface-card hover:bg-cursor-surface-strong/30 transition-all text-[10px] font-semibold text-cursor-muted cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-1.5">
                                <span>🔧</span>
                                <span>실시간 세션 연동 진단 로그</span>
                              </div>
                              <span className="text-[9px] transition-transform duration-200" style={{ transform: showDebugLogs ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                ▶
                              </span>
                            </button>
                            
                            <AnimatePresence>
                              {showDebugLogs && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                  animate={{ height: 'auto', opacity: 1, marginTop: 4 }}
                                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                                  className="overflow-hidden flex flex-col gap-2"
                                >
                                  <div className="relative p-3 bg-black/85 border border-white/5 rounded-xl flex flex-col gap-1.5 font-mono text-[10px] leading-relaxed text-[#A0A0A2] max-h-[160px] overflow-y-auto select-text">
                                    <button
                                      onClick={handleCopyLogs}
                                      className="absolute top-2 right-2 p-1 bg-white/5 hover:bg-white/10 text-white rounded transition-all cursor-pointer text-[9px] font-sans font-bold flex items-center gap-1 border border-white/5 select-none"
                                    >
                                      {copied ? 'Copied!' : '복사'}
                                    </button>
                                    
                                    {sessionDebugLogs.length === 0 ? (
                                      <div className="text-cursor-muted italic text-center py-2 select-none">
                                        스캔된 디버그 로그가 없습니다.
                                      </div>
                                    ) : (
                                      sessionDebugLogs.map((log, idx) => (
                                        <div 
                                          key={idx} 
                                          className={log.includes('Error') || log.includes('실패') ? 'text-red-400' : log.includes('성공') || log.includes('완료') ? 'text-emerald-400' : ''}
                                        >
                                          {log}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* 보안 카드 */}
                          <div className="p-4 rounded-xl border border-cursor-hairline bg-cursor-surface-card flex items-start gap-3">
                            <div className="p-2 bg-cursor-primary/10 text-cursor-primary rounded-lg shrink-0">
                              <Shield size={16} />
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-cursor-ink">쿠키 보안 샌드박스</h4>
                              <p className="text-[10px] text-cursor-muted mt-1 leading-relaxed">
                                비밀번호를 절대 저장하지 않고, 샌드박스 내부 메모리에서만 로그인 쿠키를 이용해 요청한 뒤 안전하게 폐기합니다.
                              </p>
                            </div>
                          </div>

                          {/* 개발 환경 오해 방지 안내 카드 */}
                          {!isExtensionEnv && (
                            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col gap-2 text-xs text-amber-600 dark:text-amber-400 keep-all select-none">
                              <div className="flex items-center gap-2 font-semibold">
                                <ShieldAlert size={16} />
                                <span>로컬 개발 서버 환경 경고</span>
                              </div>
                              <p className="leading-relaxed text-[10px] text-cursor-muted">
                                현재 페이지는 로컬 웹서버(localhost)입니다. <strong>실제 브라우저 쿠키 연동</strong> 및 실시간 세션 감지는 크롬 확장 프로그램 내부 주소(chrome-extension://)에서만 작동합니다.
                              </p>
                              <div className="text-[9px] bg-cursor-canvas-soft border border-cursor-hairline p-2 rounded leading-relaxed text-cursor-muted font-mono mt-0.5">
                                1. 빌드 수행: <code className="text-cursor-ink">npm run build</code><br />
                                2. 크롬 메뉴 &gt; 확장 프로그램 관리 진입<br />
                                3. <strong>'압축해제된 확장 프로그램을 로드'</strong> 클릭 후 <code className="text-cursor-ink">dist</code> 폴더 선택<br />
                                4. 로드된 확장 앱의 대시보드를 열어 테스트해 주세요!
                              </div>
                            </div>
                          )}
                        </div>

                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : (
                // ---------------- ANALYTICS TAB ----------------
                <motion.div 
                  key="analytics"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full w-full overflow-y-auto p-6"
                >
                  <div className="max-w-3xl mx-auto flex flex-col gap-6">
                    
                    <div>
                      <h2 className="text-lg font-semibold text-cursor-ink leading-snug">이메일 수신 데이터 통계</h2>
                      <p className="text-xs text-cursor-muted">브라우저 로컬 데이터 기준 주간 유입 추이 분석</p>
                    </div>

                    {/* 차트 */}
                    <div className="p-6 rounded-xl border border-cursor-hairline bg-cursor-surface-card flex flex-col gap-4">
                      <div>
                        <h3 className="text-xs font-semibold text-cursor-ink">요일별 이메일 수신량</h3>
                        <p className="text-[10px] text-cursor-muted">최근 일주일 동안의 수입 이메일 흐름 개요</p>
                      </div>
                      
                      <div className="h-56 w-full mt-2 font-mono">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={statsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorEmails" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f54e00" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#f54e00" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="name" stroke="#807d72" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="#807d72" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#f7f7f4', borderColor: '#e6e5e0', borderRadius: '8px', color: '#26251e', fontSize: '11px' }} />
                            <Area type="monotone" dataKey="emails" stroke="#f54e00" strokeWidth={1.5} fillOpacity={1} fill="url(#colorEmails)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-cursor-hairline bg-cursor-surface-card">
                        <span className="text-[10px] font-semibold text-cursor-muted uppercase">총 수신량</span>
                        <p className="text-xl font-semibold text-cursor-ink mt-1 font-mono">
                          {emails.length} <span className="text-xs font-normal text-cursor-muted">통</span>
                        </p>
                      </div>
                      <div className="p-4 rounded-xl border border-cursor-hairline bg-cursor-surface-card">
                        <span className="text-[10px] font-semibold text-cursor-muted uppercase">중요 자동 분류 메일</span>
                        <p className="text-xl font-semibold text-cursor-primary mt-1 font-mono">
                          {
                            emails.filter(m => {
                              const cat = useMailStore.getState().accounts.find(a => a.id === m.accountId)?.connected;
                              return cat && useMailStore.getState().emails.filter(em => em.id === m.id).length > 0;
                            }).length
                          } <span className="text-xs font-normal text-cursor-muted">통</span>
                        </p>
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </main>

        {/* ---------------- 4단: SlideOverViewer (슬라이드 오버 본문 뷰어 - 모바일/태블릿용) ---------------- */}
        <AnimatePresence>
          {!isInline && selectedMail && (
            <SlideOverViewer 
              email={selectedMail}
              onClose={() => setSelectedMail(null)}
              isInline={false}
            />
          )}
        </AnimatePresence>

      </div>
  );
}

export default App;
