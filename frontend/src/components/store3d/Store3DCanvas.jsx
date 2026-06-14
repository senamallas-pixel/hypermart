// Shared <Canvas> wrapper: camera, lights, soft shadows, floor, OrbitControls.
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
  floorY = -1.05,
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
      shadows={!isMobile}
      dpr={[1, isMobile ? 1.5 : 2]}
      camera={camera}
      gl={{ antialias: !isMobile, powerPreference: 'high-performance' }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#EFEDE6']} />
      <fog attach="fog" args={['#EFEDE6', 28, 60]} />
      <hemisphereLight args={['#ffffff', '#d8d2c2', 0.55]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[7, 14, 9]}
        intensity={1.05}
        castShadow={!isMobile}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
      />
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#E0DCCF" />
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
