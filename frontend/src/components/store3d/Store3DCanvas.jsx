// Shared <Canvas> wrapper: camera, lights, floor, OrbitControls, WebGL guard.
import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

export default function Store3DCanvas({
  children,
  camera = { position: [0, 4, 12], fov: 50 },
  target = [0, 1, 0],
  minDistance = 4,
  maxDistance = 40,
}) {
  const [supported] = useState(webglAvailable);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  if (!supported) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6 text-center text-sm text-[#1A1A1A]/50">
        3D isn’t supported on this device or browser. Please switch back to the 2D view.
      </div>
    );
  }

  return (
    <Canvas
      dpr={[1, isMobile ? 1.5 : 2]}
      camera={camera}
      gl={{ antialias: !isMobile, powerPreference: 'high-performance' }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#EFEFE8']} />
      <ambientLight intensity={0.95} />
      <directionalLight position={[6, 12, 8]} intensity={1.1} />
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.05, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#E3E3DA" />
      </mesh>
      <Suspense fallback={null}>{children}</Suspense>
      <OrbitControls
        makeDefault
        enableDamping
        enablePan
        target={target}
        minDistance={minDistance}
        maxDistance={maxDistance}
        maxPolarAngle={Math.PI / 2.05}
      />
    </Canvas>
  );
}
