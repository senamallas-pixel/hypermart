// Shop-interior 3D scene: a shop's products as image panels on stacked shelves.
// Lazy default export — statically importing three keeps it in the async chunk.
import Store3DCanvas from './Store3DCanvas';
import ProductPanel from './ProductPanel';
import Shelf from './Shelf';
import Overlay, { MoreNote } from './Overlay';

const PER_ROW = 5;
const MAX = 60;
const PANEL_GAP = 1.95;
const ROW_GAP = 2.7;

export default function Products3DView({ products = [], onAddToCart }) {
  const list = products.slice(0, MAX);
  const rows = Math.max(1, Math.ceil(list.length / PER_ROW));
  const baseY = (rows - 1) * ROW_GAP; // top shelf
  const width = PER_ROW * PANEL_GAP;

  return (
    <div className="relative w-full h-[70vh] rounded-3xl overflow-hidden border border-[#1A1A1A]/8 bg-[#EFEFE8]">
      <Store3DCanvas
        camera={{ position: [0, baseY / 2 + 1.5, 9.5], fov: 50 }}
        target={[0, baseY / 2, 0]}
        minDistance={3}
        maxDistance={30}
      >
        {Array.from({ length: rows }).map((_, r) => (
          <Shelf key={`shelf-${r}`} position={[0, baseY - r * ROW_GAP, 0]} width={width + 0.8} />
        ))}
        {list.map((p, i) => {
          const col = i % PER_ROW;
          const row = Math.floor(i / PER_ROW);
          const x = (col - (PER_ROW - 1) / 2) * PANEL_GAP;
          const y = baseY - row * ROW_GAP;
          return <ProductPanel key={p.id} product={p} position={[x, y, 0]} onAdd={onAddToCart} />;
        })}
      </Store3DCanvas>
      <Overlay extra={<MoreNote n={products.length - list.length} />} />
    </div>
  );
}
