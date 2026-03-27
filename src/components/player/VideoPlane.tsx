/**
 * Renders the video as a textured plane with a custom rounded-rectangle shader.
 *
 * Uses a Signed Distance Function (SDF) in the fragment shader to clip the
 * video texture into a rounded rectangle. The rounding radius and padding
 * are driven by Zustand store values, read directly via getState() each frame
 * to avoid React re-renders.
 *
 * The video element is created off-DOM by useVideoElement and passed in as a prop.
 * THREE.VideoTexture automatically updates from the video element each frame.
 */

import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useVideoControlsStore } from "../../stores/videoControlsStore";

interface VideoPlaneProps {
  videoElement: HTMLVideoElement;
}

// ---- GLSL Shaders ----

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Fragment shader that samples a video texture and clips it to a rounded rectangle.
 *
 * Uniforms:
 *   uTexture    — the video texture
 *   uResolution — virtual pixel dimensions of the plane (for SDF math)
 *   uRadius     — corner radius in virtual pixels
 *
 * The roundedBoxSDF function returns the signed distance from a point to the
 * nearest edge of a rounded rectangle. Negative = inside, positive = outside.
 * We use smoothstep on the distance for anti-aliased edges, then discard
 * fragments outside the shape.
 */
const FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform float uRadius;
  varying vec2 vUv;

  float roundedBoxSDF(vec2 center, vec2 size, float radius) {
    vec2 q = abs(center) - size + radius;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  }

  void main() {
    vec4 texColor = texture2D(uTexture, vUv);
    vec2 pixelPos = vUv * uResolution;
    vec2 center = pixelPos - uResolution * 0.5;
    vec2 halfSize = uResolution * 0.5;
    float dist = roundedBoxSDF(center, halfSize, uRadius);
    float alpha = 1.0 - smoothstep(-1.5, 0.5, dist);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(texColor.rgb, texColor.a * alpha);
  }
`;

export function VideoPlane({ videoElement }: VideoPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [ready, setReady] = useState(false);

  // Wait for the video to have decoded frame data before creating the texture
  useEffect(() => {
    const checkReady = () => {
      if (videoElement.readyState >= 2) setReady(true);
    };
    checkReady();
    videoElement.addEventListener("loadeddata", checkReady);
    videoElement.addEventListener("canplay", checkReady);
    return () => {
      videoElement.removeEventListener("loadeddata", checkReady);
      videoElement.removeEventListener("canplay", checkReady);
    };
  }, [videoElement]);

  const videoTexture = useMemo(() => {
    if (!ready) return null;
    const tex = new THREE.VideoTexture(videoElement);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.format = THREE.RGBAFormat;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [videoElement, ready]);

  const shaderMaterial = useMemo(() => {
    if (!videoTexture) return null;
    return new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: videoTexture },
        uResolution: { value: new THREE.Vector2(800, 450) },
        uRadius: { value: 0.0 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
    });
  }, [videoTexture]);

  // Update plane size and shader uniforms every frame based on slider values
  useFrame(({ viewport }) => {
    if (!meshRef.current || !shaderMaterial) return;

    const { padding, rounding } = useVideoControlsStore.getState();

    const videoWidth = videoElement.videoWidth || 1920;
    const videoHeight = videoElement.videoHeight || 1080;
    const videoAspect = videoWidth / videoHeight;

    // Padding: slider 0→10% inset, slider 32→30% inset on each side
    const paddingFraction = 0.10 + (padding / 32) * 0.20;
    const availW = viewport.width * (1 - paddingFraction * 2);
    const availH = viewport.height * (1 - paddingFraction * 2);

    // Fit video within available space while preserving aspect ratio
    let planeW: number, planeH: number;
    if (availW / availH > videoAspect) {
      planeH = availH;
      planeW = planeH * videoAspect;
    } else {
      planeW = availW;
      planeH = planeW / videoAspect;
    }

    meshRef.current.scale.set(planeW, planeH, 1);

    // Map plane size to a virtual pixel space for the SDF shader
    const SDF_RESOLUTION = 500;
    const pixelW = SDF_RESOLUTION * videoAspect;
    const pixelH = SDF_RESOLUTION;
    shaderMaterial.uniforms.uResolution.value.set(pixelW, pixelH);

    // Rounding: slider 0→no rounding, slider 32→15% of smaller dimension
    const maxRadius = Math.min(pixelW, pixelH) * 0.15;
    shaderMaterial.uniforms.uRadius.value = (rounding / 32) * maxRadius;
  });

  useEffect(() => {
    return () => {
      videoTexture?.dispose();
      shaderMaterial?.dispose();
    };
  }, [videoTexture, shaderMaterial]);

  if (!shaderMaterial) return null;

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[1, 1]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
}
