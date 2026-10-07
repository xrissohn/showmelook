import { Children, useEffect, useState, type ReactNode } from 'react';

function getColumns(galleries: boolean) {
  if (typeof window === 'undefined') return galleries ? 2 : 3;
  const desktop = window.matchMedia('(min-width: 1024px)').matches;
  const tablet = window.matchMedia('(min-width: 640px)').matches;
  return galleries ? (desktop ? 4 : tablet ? 3 : 2) : (desktop ? 6 : tablet ? 4 : 3);
}

/** Stable lanes: appending a page never redistributes existing cards. */
export function MasonryGallery({ children, galleries = false }: { children: ReactNode; galleries?: boolean }) {
  const [columns, setColumns] = useState(() => getColumns(galleries));
  useEffect(() => {
    const tablet = window.matchMedia('(min-width: 640px)');
    const desktop = window.matchMedia('(min-width: 1024px)');
    const update = () => setColumns(getColumns(galleries));
    update();
    tablet.addEventListener('change', update);
    desktop.addEventListener('change', update);
    return () => { tablet.removeEventListener('change', update); desktop.removeEventListener('change', update); };
  }, [galleries]);
  const items = Children.toArray(children);
  return (
    <div className="pinterest-grid" data-columns={columns} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: columns }, (_, column) => (
        <div className="pinterest-column" key={column}>
          {items.filter((_, index) => index % columns === column)}
        </div>
      ))}
    </div>
  );
}
