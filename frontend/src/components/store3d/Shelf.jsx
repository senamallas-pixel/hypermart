// A presentational shelf board to sit product panels on.
export default function Shelf({ position = [0, 0, 0], width = 10 }) {
  return (
    <group position={position}>
      <mesh position={[0, -0.95, 0]}>
        <boxGeometry args={[width, 0.14, 1.4]} />
        <meshStandardMaterial color="#9b7b54" />
      </mesh>
      {/* back panel */}
      <mesh position={[0, 0, -0.7]}>
        <boxGeometry args={[width, 2.4, 0.08]} />
        <meshStandardMaterial color="#cfc7b6" />
      </mesh>
    </group>
  );
}
