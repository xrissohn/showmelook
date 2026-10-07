import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { MasonryGallery } from './MasonryGallery';

it('keeps existing card nodes in their lanes when another page is appended', () => {
  const cards = (count: number) => Array.from({ length: count }, (_, id) => <button key={id}>Look {id}</button>);
  const view = render(<MasonryGallery>{cards(12)}</MasonryGallery>);
  const original = Array.from(view.container.querySelectorAll('button')).map(node => ({ node, lane: node.parentElement, position: Array.from(node.parentElement!.children).indexOf(node) }));
  view.rerender(<MasonryGallery>{cards(18)}</MasonryGallery>);
  expect(view.container.querySelectorAll('button')).toHaveLength(18);
  for (const { node, lane, position } of original) {
    expect(node.parentElement).toBe(lane);
    expect(lane!.children[position]).toBe(node);
  }
});

it('mounts desktop cards once with the correct lane count immediately', () => {
  const original = window.matchMedia;
  const media = vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ ...original(query), matches: true }));
  let mounts = 0;
  function Card({ id }: { id: number }) {
    useEffect(() => { mounts++; }, []);
    return <button>Look {id}</button>;
  }
  try {
    const view = render(<MasonryGallery>{Array.from({ length: 6 }, (_, id) => <Card key={id} id={id} />)}</MasonryGallery>);
    expect(view.container.querySelectorAll('.pinterest-column')).toHaveLength(6);
    expect(mounts).toBe(6);
  } finally { media.mockRestore(); }
});
