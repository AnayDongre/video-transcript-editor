/**
 * Renders the background image as a full-canvas plane in the Three.js scene.
 * Positioned at z=-2 so the video plane (z=0) renders in front of it.
 */

import { useRef } from "react";
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface BackgroundPlaneProps {
  src: string;
}

export function BackgroundPlane({ src }: BackgroundPlaneProps) {
  const texture = useTexture(src);
  const meshRef = useRef<THREE.Mesh>(null);
  const lastSize = useRef({ w: 0, h: 0 });

  useFrame(({ viewport }) => {
    if (!meshRef.current) return;

    // Skip scale update if viewport hasn't changed (perf optimization)
    if (lastSize.current.w === viewport.width && lastSize.current.h === viewport.height) return;
    lastSize.current = { w: viewport.width, h: viewport.height };

    meshRef.current.scale.set(viewport.width, viewport.height, 1);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -2]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}
