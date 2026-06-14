// One shop rendered as a 3D storefront booth (logo sign + name + rating).
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import TexturedPlane from './TexturedPlane';

export default function ShopBooth({ shop, position, onClick }) {
  const grp = useRef();
  const [hover, setHover] = useState(false);
  const open = shop.is_open === undefined ? shop.status === 'approved' : !!shop.is_open;

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
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[2.6, 2, 1.4]} />
        <meshStandardMaterial color={open ? '#4A7C59' : '#9CA3AF'} />
      </mesh>
      {/* awning */}
      <mesh position={[0, 2.05, 0.2]}>
        <boxGeometry args={[2.8, 0.2, 1.7]} />
        <meshStandardMaterial color={open ? '#3d6b4a' : '#7d828a'} />
      </mesh>
      {/* logo sign on the front face (box front ≈ z 0.7) */}
      <group position={[0, 1.15, 0.72]}>
        <TexturedPlane url={shop.logo} width={2} height={1.2} color="#3d6b4a" label={shop.name} />
      </group>
      {/* name + rating above */}
      <Text position={[0, 2.55, 0]} fontSize={0.26} maxWidth={2.8} textAlign="center" color="#1A1A1A" anchorX="center" anchorY="middle">
        {shop.name}
      </Text>
      <Text position={[0, 2.28, 0]} fontSize={0.18} color="#5A5A40" anchorX="center" anchorY="middle">
        {`★ ${shop.rating || '4.5'}  ·  ${open ? 'Open' : 'Closed'}`}
      </Text>
    </group>
  );
}
