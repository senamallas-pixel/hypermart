// One shop rendered as a 3D storefront booth (logo sign + name + rating).
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import Label from './Label';
import TexturedPlane from './TexturedPlane';
import { isShopOpenNow } from '../../utils/shopOpen';

export default function ShopBooth({ shop, position, onClick }) {
  const grp = useRef();
  const [hover, setHover] = useState(false);
  const open = isShopOpenNow(shop);

  useFrame(() => {
    if (!grp.current) return;
    const s = hover ? 1.06 : 1;
    grp.current.scale.x += (s - grp.current.scale.x) * 0.15;
    grp.current.scale.y = grp.current.scale.x;
    grp.current.scale.z = grp.current.scale.x;
  });

  return (
    <group
      ref={grp}
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick?.(shop); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}
    >
      {/* booth body */}
      <mesh position={[0, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 2, 1.4]} />
        <meshStandardMaterial color={open ? '#4A7C59' : '#9CA3AF'} />
      </mesh>
      {/* awning */}
      <mesh position={[0, 2.05, 0.2]} castShadow>
        <boxGeometry args={[2.8, 0.2, 1.7]} />
        <meshStandardMaterial color={open ? '#3d6b4a' : '#7d828a'} />
      </mesh>
      {/* logo sign on the front face (box front ≈ z 0.7) */}
      <group position={[0, 1.0, 0.72]}>
        <TexturedPlane url={shop.logo} width={2} height={1.05} color="#3d6b4a" label={shop.name} />
      </group>
      {/* name board mounted on the storefront (a real sign, so it never floats over other booths) */}
      <group position={[0, 1.78, 0.74]}>
        <mesh castShadow>
          <boxGeometry args={[2.5, 0.5, 0.08]} />
          <meshStandardMaterial color="#f4f1e8" />
        </mesh>
        <Label position={[0, 0.06, 0.06]} fontSize={0.2} maxWidth={2.35} textAlign="center" color="#1A1A1A" anchorX="center" anchorY="middle">
          {shop.name}
        </Label>
        <Label position={[0, -0.16, 0.06]} fontSize={0.13} color={open ? '#3d6b4a' : '#9CA3AF'} anchorX="center" anchorY="middle">
          {`★ ${shop.rating || '4.5'}  ·  ${open ? 'Open now' : 'Closed'}`}
        </Label>
      </group>
    </group>
  );
}
