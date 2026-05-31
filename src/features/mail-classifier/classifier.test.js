import { describe, it, expect } from 'vitest';
import { classifyEmail } from './classifier';

describe('이메일 자동 분류기(classifier) 테스트', () => {
  const keywords = ['결제', '공지', '프로젝트'];
  const domains = ['company.com', 'github.com'];

  it('지정된 중요 도메인에서 온 메일은 important로 분류된다', () => {
    const email = {
      senderEmail: 'alert@github.com',
      subject: 'Repository update details',
      bodySnippet: 'A new push has been made to your main branch'
    };
    expect(classifyEmail(email, keywords, domains)).toBe('important');
  });

  it('제목이나 본문에 중요 키워드가 있으면 important로 분류된다', () => {
    const email = {
      senderEmail: 'user@naver.com',
      subject: '5월 이용요금 결제 완료 안내',
      bodySnippet: '안전하게 이체 완료되었습니다.'
    };
    expect(classifyEmail(email, keywords, domains)).toBe('important');
  });

  it('매칭되는 중요 도메인이나 키워드가 없으면 regular로 분류된다', () => {
    const email = {
      senderEmail: 'friend@daum.net',
      subject: '이번 주 등산 일정 물어봐!',
      bodySnippet: '주말 등산 약속 시간 조율'
    };
    expect(classifyEmail(email, keywords, domains)).toBe('regular');
  });
});
