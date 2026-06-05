import { useState, useEffect } from 'react';
import { useMailStore } from '../../store';
import { classifyEmail } from '../mail-classifier/classifier';
import { SkeletonList } from './SkeletonList';
import { RefreshCw, Inbox, CircleAlert } from 'lucide-react';
import dayjs from 'dayjs';

/**
 * MailList Component
 * 
 * [학습 포인트]
 * 1. AI 타임라인 시뮬레이터: 실제 비동기 동기화 주기(800ms) 동안 useEffect와 타이머를 이용해
 *    Thinking -> Read -> Grep -> Done 단계를 실시간으로 거치는 파스텔 컬러칩 인디케이터를 구동합니다.
 * 2. 동적 분류 필터링: 선택된 계정과 채널에 맞춰 classifyEmail 함수로 메일을 즉석 분류하여 출력합니다.
 * 3. 웜 크림 에스테틱: 1px hairline 테두리와 호버 모션(Hover Scale/Border Color)을 결합했습니다.
 */
export function MailList() {
  const {
    emails,
    isSyncing,
    selectedAccountId,
    selectedChannel,
    setSelectedMail,
    fetchEmails,
    keywords,
    domains
  } = useMailStore();

  // AI 타임라인 상태 ('idle' | 'thinking' | 'read' | 'grep' | 'done')
  const [syncStage, setSyncStage] = useState('idle');

  // 동기화 진행 상태 감지 및 AI 타임라인 컬러칩 제어
  useEffect(() => {
    if (isSyncing) {
      const timerThinking = setTimeout(() => setSyncStage('thinking'), 0);
      
      const timerRead = setTimeout(() => setSyncStage('read'), 250);
      const timerGrep = setTimeout(() => setSyncStage('grep'), 550);
      
      return () => {
        clearTimeout(timerThinking);
        clearTimeout(timerRead);
        clearTimeout(timerGrep);
      };
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSyncStage(prev => {
        if (prev !== 'idle' && prev !== 'done') {
          return 'done';
        }
        return prev;
      });
      
      const timerIdle = setTimeout(() => {
        setSyncStage(prev => prev === 'done' ? 'idle' : prev);
      }, 1500);
      return () => clearTimeout(timerIdle);
    }
  }, [isSyncing]);

  // 필터링 적용된 메일 리스트 획득
  const filteredEmails = emails.filter(mail => {
    if (mail.accountId !== selectedAccountId) return false;
    if (selectedChannel === 'important' || selectedChannel === 'regular') {
      const category = classifyEmail(mail, keywords, domains);
      return category === selectedChannel;
    }
    // 커스텀 키워드인 경우: 메일 제목이나 본문에서 단어 매칭
    const query = selectedChannel.toLowerCase();
    const subjectMatch = mail.subject?.toLowerCase().includes(query);
    const bodyMatch = mail.bodySnippet?.toLowerCase().includes(query);
    return subjectMatch || bodyMatch;
  });

  // 날짜 상대 표기 헬퍼 함수
  const formatTime = (isoString) => {
    const mailDate = dayjs(isoString);
    const now = dayjs();
    
    if (now.diff(mailDate, 'day') === 0) {
      return mailDate.format('HH:mm');
    }
    if (now.diff(mailDate, 'day') === 1) {
      return '어제';
    }
    return mailDate.format('M월 D일');
  };

  // AI 타임라인 알약(Pill) 스타일 매핑
  const renderTimelinePill = () => {
    switch (syncStage) {
      case 'thinking':
        return (
          <span className="px-3 py-1 text-[10px] font-semibold tracking-wider rounded-full bg-cursor-timeline-thinking text-cursor-ink uppercase animate-pulse">
            ● Thinking...
          </span>
        );
      case 'read':
        return (
          <span className="px-3 py-1 text-[10px] font-semibold tracking-wider rounded-full bg-cursor-timeline-read text-cursor-ink uppercase">
            ● Reading Feed
          </span>
        );
      case 'grep':
        return (
          <span className="px-3 py-1 text-[10px] font-semibold tracking-wider rounded-full bg-cursor-timeline-grep text-cursor-ink uppercase">
            ● Grepping Body
          </span>
        );
      case 'done':
        return (
          <span className="px-3 py-1 text-[10px] font-semibold tracking-wider rounded-full bg-cursor-timeline-done text-white uppercase transition-all duration-300">
            ✓ Sync Done
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-cursor-canvas overflow-hidden">
      
      {/* 1. 리스트 상단 컨트롤바 */}
      <div className="p-4 border-b border-cursor-hairline bg-cursor-canvas-soft flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-cursor-ink">
            {selectedAccountId === 'naver' ? 'Naver Mail' : 'Gmail'} 
            <span className="text-cursor-primary ml-1.5 font-normal">#{selectedChannel}</span>
          </h2>
          {renderTimelinePill()}
        </div>

        <button
          onClick={fetchEmails}
          disabled={isSyncing}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cursor-hairline bg-cursor-surface-card text-xs text-cursor-body hover:text-cursor-ink hover:bg-cursor-canvas-soft transition-all font-medium ${
            isSyncing ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
          <span>새로고침</span>
        </button>
      </div>

      {/* 2. 메일 리스트 영역 */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {isSyncing && filteredEmails.length === 0 ? (
          <SkeletonList />
        ) : filteredEmails.length === 0 ? (
          // Empty State
          <div className="py-12 px-4 text-center rounded-xl border border-cursor-hairline bg-cursor-surface-card flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cursor-canvas-soft flex items-center justify-center text-cursor-muted">
              <Inbox size={20} />
            </div>
            <div className="keep-all">
              <p className="text-xs font-semibold text-cursor-ink">수신된 메일이 없습니다</p>
              <p className="text-[10px] text-cursor-muted mt-1 max-w-xs leading-relaxed">
                해당 카테고리에 분류된 이메일이 아직 없습니다. 새로고침 버튼을 누르거나, 상위 폴더 로그인 상태를 점검해 보세요.
              </p>
            </div>
          </div>
        ) : (
          // Email Cards
          filteredEmails.map((mail) => (
            <div
              key={mail.id}
              onClick={() => setSelectedMail(mail)}
              className="p-4 rounded-xl border border-cursor-hairline bg-cursor-surface-card hover:bg-cursor-canvas-soft/40 hover:border-cursor-hairline-strong transition-all duration-200 cursor-pointer flex flex-col gap-2 group relative overflow-hidden"
            >
              {/* 발신자 및 시간 */}
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-cursor-ink group-hover:text-cursor-primary transition-all">
                  {mail.senderName}
                </span>
                <span className="text-[10px] text-cursor-muted font-mono">
                  {formatTime(mail.receivedAt)}
                </span>
              </div>

              {/* 메일 제목 */}
              <h3 className="text-sm font-medium text-cursor-ink line-clamp-1">
                {mail.subject}
              </h3>

              {/* 본문 초록 */}
              <p className="text-xs text-cursor-body line-clamp-2 leading-relaxed break-all">
                {mail.bodySnippet}
              </p>

              {/* Gmail 수량 한계 가이드 인디케이터 (Gmail의 경우) */}
              {mail.accountId === 'gmail' && (
                <div className="absolute bottom-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="text-[8px] text-cursor-muted font-mono flex items-center gap-0.5">
                    <CircleAlert size={8} /> Gmail 20개 피드
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

    </div>
  );
}
