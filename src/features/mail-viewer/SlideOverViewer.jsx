import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';
import { X, Calendar, User, Mail } from 'lucide-react';
import dayjs from 'dayjs';

/**
 * SlideOverViewer Component
 * 
 * [학습 포인트]
 * 1. 2차 정밀 보안 살균: dangerouslySetInnerHTML를 통해 메일 본문을 HTML로 렌더링하기 직전에
 *    DOMPurify.sanitize를 수행하여 XSS 공격 스크립트를 완벽히 제거합니다. (Defense in Depth 최종 관문)
 * 2. Framer Motion Slide-Over: x축을 기준으로 100% (오른쪽 바깥)에서 0% (완전 진입)로 부드럽게 밀려 들어옵니다.
 * 3. 에디토리얼 테마: warm cream(#fafaf7) 캔버스와 1px hairline strong 테두리를 매칭했습니다.
 */
// DOMPurify Hook to force target="_blank" and rel="noopener noreferrer" for all anchor tags.
// Register once at module load to prevent duplicate hooks.
if (typeof window !== 'undefined') {
  DOMPurify.addHook('afterSanitizeAttributes', function (node) {
    if (node.tagName && node.tagName.toLowerCase() === 'a') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

/**
 * SlideOverViewer Component
 */
export function SlideOverViewer({ email, onClose, isInline = false }) {
  if (!email) return null;

  // HTML 살균 처리 집행 (CORS 우회 후 렌더링 시 XSS 및 CSS 주입 차단 가드 결합)
  const cleanHtml = DOMPurify.sanitize(email.bodySnippet, {
    ADD_ATTR: ['target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^&:/?#]*(?:[/?#]|$))/i,
    FORBID_TAGS: ['style']
  });

  // 애니메이션 속성 및 Tailwind class 분기 설정
  const motionProps = isInline
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.2 }
      }
    : {
        initial: { x: '100%' },
        animate: { x: 0 },
        exit: { x: '100%' },
        transition: { type: 'spring', damping: 25, stiffness: 220 }
      };

  const containerClasses = isInline
    ? "relative h-full flex-1 border-l border-cursor-hairline-strong bg-cursor-canvas-soft flex flex-col overflow-hidden"
    : "absolute top-0 right-0 h-full w-[450px] sm:w-[500px] border-l border-cursor-hairline-strong bg-cursor-canvas shadow-xl flex flex-col z-40 overflow-hidden";

  return (
    <motion.div
      {...motionProps}
      className={containerClasses}
    >
      {/* 1. 헤더 영역 */}
      <div className="border-b border-cursor-hairline bg-cursor-canvas-soft w-full shrink-0">
        <div className="max-w-[800px] mx-auto w-full px-6 py-4 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-cursor-muted">
            이메일 상세 보기
          </span>
          <button
            onClick={onClose}
            className="p-2 text-cursor-muted hover:text-cursor-ink rounded-lg hover:bg-cursor-canvas transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 2. 바디 영역 */}
      <div className="flex-1 overflow-y-auto p-8 w-full">
        <div className="max-w-[800px] mx-auto w-full flex flex-col gap-6">
          
          {/* 메일 제목 */}
          <h2 className="text-lg font-semibold tracking-tight text-cursor-ink leading-snug break-all">
            {email.subject}
          </h2>

          {/* 발신자 및 날짜 정보 카드 */}
          <div className="p-4 rounded-xl border border-cursor-hairline bg-cursor-canvas flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs text-cursor-body">
              <User size={14} className="text-cursor-muted" />
              <span className="font-semibold text-cursor-ink">{email.senderName}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-cursor-body font-mono">
              <Mail size={14} className="text-cursor-muted" />
              <span className="text-cursor-muted-soft break-all">{email.senderEmail}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-cursor-body font-mono">
              <Calendar size={14} className="text-cursor-muted" />
              <span className="text-cursor-muted-soft">
                {dayjs(email.receivedAt).format('YYYY년 MM월 DD일 HH:mm:ss')}
              </span>
            </div>
          </div>

          {/* 본문 렌더링 (XSS 보안 처리 완료) */}
          <div className="prose prose-sm text-cursor-body leading-relaxed break-all font-sans">
            <div 
              dangerouslySetInnerHTML={{ __html: cleanHtml }}
              className="p-1"
            />
          </div>

        </div>
      </div>

    </motion.div>
  );
}
