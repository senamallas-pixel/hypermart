// Marketplace-level 3D scene: shops as storefront booths laid out on a grid.
// Lazy default export — statically importing three keeps it in the async chunk.
import Store3DCanvas from './Store3DCanvas';
import ShopBooth from './ShopBooth';
import Overlay, { MoreNote } from './Overlay';

const MAX = 40;
const SPACING = 4.6;

export default function Shops3DView({ shops = [], onSelectShop }) {
  const list = shops.slice(0, MAX);
  const cols = Math.max(1, Math.ceil(Math.sqrt(list.length)));
  const rows = Math.max(1, Math.ceil(list.length / cols));
  const depthCenter = -((rows - 1) * SPACING) / 2;

  return (
    <div className="relative w-full h-[70vh] rounded-3xl overflow-hidden border border-[#1A1A1A]/8 bg-[#EFEFE8]">
      <Store3DCanvas
        camera={{ position: [0, 7, 13], fov: 50 }}
        target={[0, 1, depthCenter]}
        minDistance={4}
        maxDistance={60}
      >
        {list.map((s, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = (col - (cols - 1) / 2) * SPACING;
          const z = -row * SPACING;
          return <ShopBooth key={s.id} shop={s} position={[x, 0, z]} onClick={onSelectShop} />;
        })}
      </Store3DCanvas>
      <Overlay extra={<MoreNote n={shops.length - list.length} />} />
    </div>
  );
}
