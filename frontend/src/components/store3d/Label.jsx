// drei <Text> loads its font async (suspends). Wrapping each label in its own
// Suspense keeps font-loading from blanking the whole 3D scene — meshes render
// immediately and text pops in when ready (and is simply absent if the font fails).
import { Suspense } from 'react';
import { Text } from '@react-three/drei';

export default function Label(props) {
  return (
    <Suspense fallback={null}>
      <Text {...props} />
    </Suspense>
  );
}
