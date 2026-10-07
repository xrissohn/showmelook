import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { LazyImage } from './LazyImage';

const ORIGINAL = 'https://abc.supabase.co/storage/v1/object/public/generated-looks/u/1.png';
const THUMB = 'https://abc.supabase.co/storage/v1/render/image/public/generated-looks/u/1.png?width=480&quality=70';

let triggerIntersect: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  triggerIntersect = null;
  class IO {
    constructor(private cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
      triggerIntersect = () => this.cb([{ isIntersecting: true }]);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', IO);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const img = (c: HTMLElement) => c.querySelector('img') as HTMLImageElement | null;

describe('LazyImage', () => {
  it('does not load until it is near the viewport, then loads the thumbnail', () => {
    const { container } = render(<LazyImage src={ORIGINAL} alt="x" width={480} />);
    expect(img(container)).toBeNull();
    act(() => triggerIntersect?.());
    expect(img(container)?.getAttribute('src')).toBe(THUMB);
  });

  it('priority images load right away', () => {
    const { container } = render(<LazyImage src={ORIGINAL} alt="x" width={480} priority />);
    expect(img(container)?.getAttribute('src')).toBe(THUMB);
  });

  it('falls back to the original when the thumbnail fails, and shows the placeholder only after retries are used up', () => {
    const { container } = render(<LazyImage src={ORIGINAL} alt="x" width={480} priority />);
    fireEvent.error(img(container)!); // thumbnail failed → original, immediately
    act(() => { vi.advanceTimersByTime(0); });
    expect(img(container)?.getAttribute('src')).toBe(ORIGINAL);
    fireEvent.error(img(container)!); // original failed → retry after a short wait
    act(() => { vi.advanceTimersByTime(700); });
    expect(img(container)?.getAttribute('src')).toBe(ORIGINAL);
    fireEvent.error(img(container)!); // second retry
    act(() => { vi.advanceTimersByTime(1400); });
    expect(img(container)).not.toBeNull();
    fireEvent.error(img(container)!); // nothing left → fallback icon
    expect(img(container)).toBeNull();
  });

  it('does not rewrite data URLs and shows the image once it loads', () => {
    const data = 'data:image/png;base64,AAAA';
    const { container } = render(<LazyImage src={data} alt="x" width={480} priority />);
    expect(img(container)?.getAttribute('src')).toBe(data);
    fireEvent.load(img(container)!);
    expect(img(container)?.className).toContain('opacity-100');
  });

  it('starts over when the src changes', () => {
    const { container, rerender } = render(<LazyImage src={ORIGINAL} alt="x" priority />);
    fireEvent.error(img(container)!);
    act(() => { vi.advanceTimersByTime(700); });
    rerender(<LazyImage src="https://abc.supabase.co/storage/v1/object/public/generated-looks/u/2.png" alt="x" priority />);
    expect(img(container)?.getAttribute('src')).toContain('/2.png');
  });
});
