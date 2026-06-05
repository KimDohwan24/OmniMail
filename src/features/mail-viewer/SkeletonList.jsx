/**
 * SkeletonList Component
 * 
 * [학습 포인트]
 * 1. Layout Shift(레이아웃 흔들림) 방지: 비동기로 데이터를 로딩할 때 화면 높이가 갑자기 바뀌거나 깜빡거리는 현상을 막아줍니다.
 * 2. 디자인 통일성: 메일 카드와 완전히 동일한 크기(1px hairline border)의 빈 가상 요소를 웜 크림색 배경으로 렌더링합니다.
 */
export function SkeletonList() {
  // 3개의 가짜 스켈레톤 카드를 보여줍니다.
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {[1, 2, 3].map((idx) => (
        <div 
          key={idx} 
          className="p-4 rounded-xl border border-cursor-hairline bg-cursor-canvas-soft flex flex-col gap-2.5"
        >
          <div className="flex justify-between items-center">
            <div className="h-4 bg-cursor-surface-strong rounded w-24" />
            <div className="h-3 bg-cursor-surface-strong rounded w-16" />
          </div>
          <div className="h-5 bg-cursor-surface-strong rounded w-3/4" />
          <div className="h-3 bg-cursor-surface-strong rounded w-full" />
        </div>
      ))}
    </div>
  );
}
