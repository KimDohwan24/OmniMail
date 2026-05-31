// 이메일 자동 분류 모듈 (기초 버전)

/**
 * 이메일을 중요(important)와 일반(regular) 카테고리로 분류합니다.
 * @param {object} email - 이메일 정보 객체 { subject, senderEmail, bodySnippet }
 * @param {string[]} keywords - 중요 키워드 배열
 * @param {string[]} domains - 중요 도메인 배열
 * @returns {string} 'important' | 'regular'
 */
export function classifyEmail(email, keywords = [], domains = []) {
  if (!email) return 'regular';
  
  const senderEmail = (email.senderEmail || '').toLowerCase();
  const subject = (email.subject || '').toLowerCase();
  const bodySnippet = (email.bodySnippet || '').toLowerCase();

  // 1. 도메인 일치 여부 확인
  const isImportantDomain = domains.some(dom => 
    senderEmail.endsWith(`@${dom}`) || senderEmail === dom
  );
  if (isImportantDomain) return 'important';

  // 2. 키워드 일치 여부 확인
  const isImportantKeyword = keywords.some(kw => 
    subject.includes(kw.toLowerCase()) || bodySnippet.includes(kw.toLowerCase())
  );
  if (isImportantKeyword) return 'important';

  return 'regular';
}
