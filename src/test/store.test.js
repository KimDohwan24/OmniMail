import { describe, it, expect, beforeEach } from 'vitest';
import { useMailStore } from '../store';

describe('Zustand store - Theme state tests', () => {
  beforeEach(() => {
    // 테스트 전에 html(documentElement) 클래스 및 로컬스토리지 초기화
    document.documentElement.className = '';
    localStorage.clear();
  });

  it('기본 테마는 dark로 설정되어 있어야 한다', () => {
    const state = useMailStore.getState();
    expect(state.theme).toBe('dark');
  });

  it('toggleTheme을 호출하면 theme 상태가 반전되어야 한다 (dark -> light -> dark)', () => {
    const { toggleTheme } = useMailStore.getState();
    
    // 테마 상태를 명시적으로 'dark'로 초기 세팅(필요시) 후 테스트
    if (useMailStore.getState().theme !== 'dark') {
      toggleTheme();
    }
    
    // dark -> light
    toggleTheme();
    expect(useMailStore.getState().theme).toBe('light');

    // light -> dark
    toggleTheme();
    expect(useMailStore.getState().theme).toBe('dark');
  });

  it('theme 상태에 따라 document.documentElement의 classList가 동기화되어야 한다', () => {
    const { toggleTheme } = useMailStore.getState();
    
    // 테마가 'light'일 때 html에는 'light' 클래스가 있고 'dark' 클래스는 없어야 함
    if (useMailStore.getState().theme === 'dark') {
      toggleTheme(); // -> light
    }
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // 테마가 'dark'일 때 html에는 'dark' 클래스가 있고 'light' 클래스는 없어야 함
    toggleTheme(); // -> dark
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('테마 상태가 localStorage에 저장 및 로드되어야 한다', () => {
    const { toggleTheme } = useMailStore.getState();
    
    // 테마 토글 시 로컬스토리지 값 확인
    if (useMailStore.getState().theme === 'dark') {
      toggleTheme(); // -> light
    }
    expect(localStorage.getItem('omnimail-theme')).toBe('light');
    
    toggleTheme(); // -> dark
    expect(localStorage.getItem('omnimail-theme')).toBe('dark');
  });
});

describe('Zustand store - Mail account integration tests', () => {
  it('기본 계정 식별자(gmail, naver)와 초기 연동 해제 상태가 올바르게 존재해야 한다', () => {
    const { accounts } = useMailStore.getState();
    
    expect(accounts).toHaveLength(2);
    
    const gmailAcc = accounts.find(acc => acc.id === 'gmail');
    expect(gmailAcc).toBeDefined();
    expect(gmailAcc.name).toBe('Gmail');
    expect(gmailAcc.connected).toBe(false);
    expect(gmailAcc.email).toBe('');

    const naverAcc = accounts.find(acc => acc.id === 'naver');
    expect(naverAcc).toBeDefined();
    expect(naverAcc.name).toBe('Naver Mail');
    expect(naverAcc.connected).toBe(false);
    expect(naverAcc.email).toBe('');
  });

  it('connectAccount를 호출하면 지정된 계정이 연동 상태로 전환되고 이메일 주소가 업데이트되어야 한다 (비동기 실시간 검증 성공)', async () => {
    const { connectAccount } = useMailStore.getState();
    
    // gmail 계정 연동 테스트 (Mock 환경에서는 test.user@gmail.com가 성공)
    await connectAccount('gmail', 'test.user@gmail.com');
    let state = useMailStore.getState();
    let gmailAcc = state.accounts.find(acc => acc.id === 'gmail');
    expect(gmailAcc.connected).toBe(true);
    expect(gmailAcc.email).toBe('test.user@gmail.com');
    expect(state.mismatchError).toBeNull();

    // naver 계정 연동 테스트 (Mock 환경에서는 test.user@naver.com가 성공)
    await connectAccount('naver', 'test.user@naver.com');
    state = useMailStore.getState();
    const naverAcc = state.accounts.find(acc => acc.id === 'naver');
    expect(naverAcc.connected).toBe(true);
    expect(naverAcc.email).toBe('test.user@naver.com');
    expect(state.mismatchError).toBeNull();
  });

  it('올바르지 않은 도메인의 이메일 주소로 connectAccount를 호출하면 mismatchError가 설정되고 연동되지 않아야 한다', async () => {
    const { connectAccount } = useMailStore.getState();
    
    // 지원하지 않는 도메인 연동 시도
    await connectAccount('naver', 'test.user@daum.net');
    let state = useMailStore.getState();
    let naverAcc = state.accounts.find(acc => acc.id === 'naver');
    expect(naverAcc.connected).toBe(false);
    expect(state.mismatchError).not.toBeNull();
    expect(state.mismatchError.type).toBe('invalid_domain');

    // 계정 종류 불일치 (Naver 탭에 Gmail 메일 입력)
    await connectAccount('naver', 'test.user@gmail.com');
    state = useMailStore.getState();
    naverAcc = state.accounts.find(acc => acc.id === 'naver');
    expect(naverAcc.connected).toBe(false);
    expect(state.mismatchError).not.toBeNull();
    expect(state.mismatchError.type).toBe('invalid_domain');
  });

  it('disconnectAccount를 호출하면 지정된 계정의 연동 상태가 해제되고 이메일 주소가 초기화되어야 한다', async () => {
    const { connectAccount, disconnectAccount } = useMailStore.getState();
    
    // 먼저 연동 후 해제 테스트
    await connectAccount('gmail', 'test.user@gmail.com');
    disconnectAccount('gmail');
    
    const state = useMailStore.getState();
    const gmailAcc = state.accounts.find(acc => acc.id === 'gmail');
    expect(gmailAcc.connected).toBe(false);
    expect(gmailAcc.email).toBe('');
  });

  it('초기 스토어의 isHydrated는 false여야 하고, hydrateSyncState 호출 시 true로 업데이트되어야 한다', async () => {
    const state = useMailStore.getState();
    expect(state.isHydrated).toBe(false);

    await state.hydrateSyncState();
    
    const nextState = useMailStore.getState();
    expect(nextState.isHydrated).toBe(true);
  });

  it('detectSessions를 호출하면 Mock 환경에서 detectedSessions에 모킹 세션 정보가 등록되어야 한다', async () => {
    const { detectSessions } = useMailStore.getState();
    await detectSessions();
    const state = useMailStore.getState();
    expect(state.detectedSessions.naver).toBe('test.user@naver.com');
    expect(state.detectedSessions.gmail).toBe('test.user@gmail.com');
  });

  it('hydrateSyncState를 호출하면 내부적으로 detectSessions를 실행하여 detectedSessions 상태를 초기화해야 한다', async () => {
    const { hydrateSyncState } = useMailStore.getState();
    useMailStore.setState({ detectedSessions: { naver: '', gmail: '' } });
    
    await hydrateSyncState();
    const nextState = useMailStore.getState();
    expect(nextState.detectedSessions.naver).toBe('test.user@naver.com');
    expect(nextState.detectedSessions.gmail).toBe('test.user@gmail.com');
  });
});
