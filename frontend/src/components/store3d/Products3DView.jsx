// Shop-interior 3D scene: products as packaged cards standing on a shelving unit.
// Lazy default export — statically importing three keeps it in the async chunk.
import Store3DCanvas from './Store3DCanvas';
import ShelfUnit from './ShelfUnit';
import ProductPanel, { CARD_H } from './ProductPanel';
import Overlay, { MoreNote } from './Overlay';

const PER_ROW = 5;
const MAX = 50;
const PANEL_GAP = 1.55;
const SHELF_GAP = 2.0;
const FLOOR_Y = -1.05;
const BOARD_TOP = 0.06; // half of the 0.12 board thickness

export default function Products3DView({ products = [], onAddToCart }) {
  const list = products.slice(0, MAX);
  const rows = Math.max(1, Math.ceil(list.length / PER_ROW));
  const topBoardY = (rows - 1) * SHELF_GAP;
  const width = PER_ROW * PANEL_GAP;
  const cy = topBoardY / 2 + 0.4; // vertical centre to frame

  return (
    <div className="relative w-full h-[70vh] rounded-3xl overflow-hidden border border-[#1A1A1A]/8">
      <Store3DCanvas
        camera={{ position: [0, cy + 1.2, 9], fov: 50 }}
        target={[0, cy, 0]}
        minDistance={3}
        maxDistance={26}
        floorY={FLOOR_Y}
      >
        <ShelfUnit rows={rows} width={width} shelfGap={SHELF_GAP} floorY={FLOOR_Y} />
        {list.map((p, i) => {
          const col = i % PER_ROW;
          const row = Math.floor(i / PER_ROW);              // 0 = top shelf
          const boardY = topBoardY - row * SHELF_GAP;
          const x = (col - (PER_ROW - 1) / 2) * PANEL_GAP;
          const y = boardY + BOARD_TOP + CARD_H / 2;          // base sits on the board
          return <ProductPanel key={p.id} product={p} position={[x, y, 0]} onAdd={onAddToCart} />;
        })}
      </Store3DCanvas>
      <Overlay extra={<MoreNote n={products.length - list.length} />} />
    </div>
  );
}
