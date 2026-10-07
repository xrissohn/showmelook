import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const invoke = vi.fn();
const maybeSingle = vi.fn();
let mockUser: { id: string } | null = { id: 'u1' };
const toast = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }) }) }),
  },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser }) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'ko' }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

import { LookFeedback } from './LookFeedback';

const LOOK = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  invoke.mockReset();
  toast.mockReset();
  maybeSingle.mockReset().mockResolvedValue({ data: null });
  mockUser = { id: 'u1' };
  invoke.mockResolvedValue({ data: { success: true }, error: null });
});

describe('LookFeedback (좋아요 / 보통 / 별로예요 + 의견)', () => {
  it('로그인하지 않으면 보이지 않는다', () => {
    mockUser = null;
    const { container } = render(<LookFeedback lookId={LOOK} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('세 가지 평가 버튼이 있다', () => {
    render(<LookFeedback lookId={LOOK} />);
    expect(screen.getByRole('radio', { name: /좋아요/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /보통/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /별로예요/ })).toBeInTheDocument();
  });

  it('평가를 누르면 바로 저장하고 의견 입력칸이 나온다', async () => {
    render(<LookFeedback lookId={LOOK} appliedGender="male" />);
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /좋아요/ }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(invoke).toHaveBeenCalledWith('submit-look-feedback', { body: { lookId: LOOK, rating: 1, comment: undefined, appliedGender: 'male' } });
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /좋아요/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('의견을 적어 보내면 평점과 함께 전달된다', async () => {
    render(<LookFeedback lookId={LOOK} />);
    fireEvent.click(screen.getByRole('radio', { name: /별로예요/ }));
    const box = await screen.findByRole('textbox');
    fireEvent.change(box, { target: { value: '  색이 사진이랑 달라요  ' } });
    fireEvent.click(screen.getByRole('button', { name: /의견 보내기/ }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    expect(invoke).toHaveBeenLastCalledWith('submit-look-feedback', { body: { lookId: LOOK, rating: -1, comment: '색이 사진이랑 달라요', appliedGender: undefined } });
    expect(await screen.findByRole('button', { name: /보냈어요/ })).toBeDisabled();
  });

  it('저장에 실패하면 평가를 되돌리고 알려 준다', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('x') });
    render(<LookFeedback lookId={LOOK} />);
    fireEvent.click(screen.getByRole('radio', { name: /보통/ }));
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(screen.getByRole('radio', { name: /보통/ })).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('이미 남긴 피드백이 있으면 불러와서 보여 준다', async () => {
    maybeSingle.mockResolvedValue({ data: { rating: -1, comment: '핏이 아쉬워요' } });
    render(<LookFeedback lookId={LOOK} />);
    expect(await screen.findByDisplayValue('핏이 아쉬워요')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /별로예요/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('검열 결과는 사용자에게 보여 주지 않는다 (성공 응답만 표시)', async () => {
    render(<LookFeedback lookId={LOOK} />);
    fireEvent.click(screen.getByRole('radio', { name: /좋아요/ }));
    const box = await screen.findByRole('textbox');
    fireEvent.change(box, { target: { value: '대통령 룩처럼' } });
    fireEvent.click(screen.getByRole('button', { name: /의견 보내기/ }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('고마워요') }));
    expect(screen.queryByText(/검열|보류|flagged|관리자/)).toBeNull();
  });
});
