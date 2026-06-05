/**
 * 이메일 도메인 분석 유틸리티 (detectAccountType.js)
 * 
 * [학습 포인트]
 * 1. 의존성 분리: 이 함수를 background.js에서 사용하는 syncService.js에서 분리하여
 *    프론트엔드 전용 유틸로 관리합니다. 이를 통해 Vite 빌드 시 공통 모듈 코드 스플릿이 일어나는 것을 차단합니다.
 * 2. Exact Match & 미완성 입력 방어 설계가 동일하게 유지됩니다.
 */

/**
 * 입력된 이메일 주소의 도메인을 분석하여 계정 서비스 유형을 판별합니다.
 * @param {string} email 
 * @returns {'gmail' | 'naver' | 'unsupported' | null} 판별된 서비스 코드
 */
export function detectAccountType(email) {
  if (!email) return null;
  const trimmed = email.trim();
  
  if (!trimmed.includes('@')) return null;
  
  const parts = trimmed.split('@');
  if (parts.length !== 2) return 'unsupported';
  
  const localPart = parts[0];
  const domainPart = parts[1].toLowerCase();
  
  if (!localPart || !domainPart) return null;
  
  if (domainPart === 'gmail.com') return 'gmail';
  if (domainPart === 'naver.com') return 'naver';
  
  if (!domainPart.includes('.')) return null;
  
  return 'unsupported';
}
