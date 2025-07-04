import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface EggModelProps {
  quaternion: [number, number, number, number];
}

export default function EggModel({ quaternion }: EggModelProps) {
  const { scene } = useGLTF("/egg.glb");
  const modelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (modelRef.current) {
      modelRef.current.quaternion.set(...quaternion);
    }
  });

  // Center the model so it rotates around its middle
  scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      (child as THREE.Mesh).geometry.center();
    }
  });

  return <primitive ref={modelRef} object={scene} scale={1.5} />;
}
