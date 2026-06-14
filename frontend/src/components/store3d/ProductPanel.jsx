// A product as a packaged card standing on the shelf, with a price tag on the
// shelf lip. The group origin is the card centre; the parent positions it so the
// card base rests on the board.
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import Label from './Label';
import TexturedPlane from './TexturedPlane';

export const CARD_W = 1.2;
export const CARD_H = 1.35;
const CARD_D = 0.12;

export default function ProductPanel({ product, position, onAdd }) {
  const grp = useRef();
  const [hover, setHover] = useState(false);
  const out = (product.stock ?? 1) <= 0;

  useFrame(() => {
    if (!grp.current) return;
    const s = hover && !out ? 1.06 : 1;
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
      {/* package body (a standing card/box) */}
      <mesh castShadow>
        <boxGeometry args={[CARD_W, CARD_H, CARD_D]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* product photo on the front face */}
      <group position={[0, 0.1, CARD_D / 2 + 0.011]}>
        <TexturedPlane url={product.image} width={CARD_W * 0.9} height={CARD_H * 0.72} color="#5A5A40" label={product.name} />
      </group>
      {/* product name printed on the lower strip of the package */}
      <Label
        position={[0, -CARD_H / 2 + 0.16, CARD_D / 2 + 0.02]}
        fontSize={0.1}
        maxWidth={CARD_W * 0.92}
        textAlign="center"
        color="#1A1A1A"
        anchorX="center"
        anchorY="middle"
      >
        {product.name}
      </Label>

      {/* price tag clipped to the shelf lip, in front of the board */}
      <group position={[0, -CARD_H / 2 - 0.22, 0.55]}>
        <mesh>
          <planeGeometry args={[0.74, 0.3]} />
          <meshBasicMaterial color={out ? '#f3d6d6' : '#fff7d6'} />
        </mesh>
        <Label position={[0, 0, 0.01]} fontSize={0.16} color={out ? '#b91c1c' : '#3d6b4a'} anchorX="center" anchorY="middle">
          {out ? 'Sold out' : `₹${product.price}`}
        </Label>
      </group>

      {out && (
        <>
          <mesh position={[0, 0, CARD_D / 2 + 0.012]}>
            <planeGeometry args={[CARD_W, CARD_H]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.4} />
          </mesh>
          <Label position={[0, 0, CARD_D / 2 + 0.02]} fontSize={0.16} color="#ffffff" anchorX="center" anchorY="middle">
            Out of stock
          </Label>
        </>
      )}
    </group>
  );
}
