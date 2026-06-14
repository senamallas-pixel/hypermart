// A textured plane that loads a remote image as a WebGL texture, with a
// graceful colored+label fallback when the image is missing or fails CORS/404.
import { Suspense, Component } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import Label from './Label';
import { fixImageUrl } from '../../utils/fixImageUrl';

function Fallback({ width, height, color, label }) {
  return (
    <group>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {label ? (
        <Label
          position={[0, 0, 0.02]}
          fontSize={Math.min(width, height) * 0.13}
          maxWidth={width * 0.88}
          textAlign="center"
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Label>
      ) : null}
    </group>
  );
}

function Img({ url, width, height }) {
  const tex = useTexture(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

// Hooks can't catch render/suspense errors — a class boundary can.
class TextureBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow — fallback already rendered */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function TexturedPlane({ url, width = 1, height = 1, color = '#5A5A40', label = '' }) {
  const src = fixImageUrl(url);
  const fallback = <Fallback width={width} height={height} color={color} label={label} />;
  if (!src) return fallback;
  return (
    <TextureBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Img url={src} width={width} height={height} />
      </Suspense>
    </TextureBoundary>
  );
}
