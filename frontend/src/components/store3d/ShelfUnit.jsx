// A connected gondola/shelving unit: side panels, back panel, and N wood boards.
// Board r sits at world y = r * shelfGap (r = 0 is the bottom board).
export default function ShelfUnit({ rows = 1, width = 10, shelfGap = 1.95, depth = 1.1, floorY = -1.05 }) {
  const topY = (rows - 1) * shelfGap + shelfGap * 0.55; // a little headroom above top board
  const sideH = topY - floorY;
  const sideCY = (topY + floorY) / 2;
  const outerW = width + 0.5;

  return (
    <group>
      {/* back panel */}
      <mesh position={[0, sideCY, -depth / 2]} receiveShadow>
        <boxGeometry args={[outerW, sideH, 0.08]} />
        <meshStandardMaterial color="#d9d0bd" />
      </mesh>
      {/* side panels (down to the floor so the unit reads as grounded) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (outerW / 2), sideCY, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.14, sideH, depth]} />
          <meshStandardMaterial color="#9b7b54" />
        </mesh>
      ))}
      {/* horizontal boards */}
      {Array.from({ length: rows }).map((_, r) => (
        <mesh key={r} position={[0, r * shelfGap, 0]} castShadow receiveShadow>
          <boxGeometry args={[outerW, 0.12, depth]} />
          <meshStandardMaterial color="#b5905f" />
        </mesh>
      ))}
    </group>
  );
}
