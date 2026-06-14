// One product rendered as an image panel on a shelf; click to add to cart.
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import TexturedPlane from './TexturedPlane';

export default function ProductPanel({ product, position, onAdd }) {
  const grp = useRef();
  const [hover, setHover] = useState(false);
  const out = (product.stock ?? 1) <= 0;

  useFrame(() => {
    if (!grp.current) return;
    const s = hover && !out ? 1.09 : 1;
    grp.current.scale.x += (s - grp.current.scale.x) * 0.15;
    grp.current.scale.y = grp.current.scale.x;
    grp.current.scale.z = grp.current.scale.x;
  });

  return (
    <group
      ref={grp}
      position={position}
      onClick={(e) => { e.stopPropagation(); if (!out) onAdd?.(product); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = out ? 'not-allowed' : 'pointer'; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}
    >
      <TexturedPlane url={product.image} width={1.4} height={1.4} color="#5A5A40" label={product.name} />
      {out && (
        <>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[1.4, 1.4]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.45} />
          </mesh>
          <Text position={[0, 0, 0.02]} fontSize={0.18} color="#ffffff" anchorX="center" anchorY="middle">
            Out of stock
          </Text>
        </>
      )}
      <Text position={[0, -0.9, 0]} fontSize={0.15} maxWidth={1.4} textAlign="center" color="#1A1A1A" anchorX="center" anchorY="middle">
        {product.name}
      </Text>
      <Text position={[0, -1.14, 0]} fontSize={0.18} color="#4A7C59" anchorX="center" anchorY="middle">
        {`₹${product.price}`}
      </Text>
    </group>
  );
}
