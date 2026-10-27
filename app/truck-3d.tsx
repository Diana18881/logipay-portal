"use client";

import { useEffect, useRef, useState } from "react";

// Real-time 3D scene for the landing hero: a LOGIPAY semi-truck driving along a motorway at dusk.
// three.js is loaded only in the browser; until then (or without WebGL) the SVG scene stays visible.

function logoTexture(THREE: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 640;
  const ctx = canvas.getContext("2d")!;
  const bg = ctx.createLinearGradient(0, 0, 0, 640);
  bg.addColorStop(0, "#ffffff");
  bg.addColorStop(1, "#e8eff2");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 2048, 640);
  // brand stripe
  const stripe = ctx.createLinearGradient(0, 0, 2048, 0);
  stripe.addColorStop(0, "#16b8a3");
  stripe.addColorStop(1, "#1b8fc9");
  ctx.fillStyle = stripe;
  ctx.fillRect(0, 540, 2048, 46);
  // logo mark
  ctx.save();
  ctx.translate(250, 170);
  const mark = ctx.createLinearGradient(0, 0, 220, 220);
  mark.addColorStop(0, "#16b8a3");
  mark.addColorStop(1, "#1b8fc9");
  ctx.fillStyle = mark;
  ctx.beginPath();
  ctx.roundRect(0, 0, 220, 220, 54);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 22;
  ctx.lineCap = "round";
  for (const x of [62, 104, 146]) { ctx.beginPath(); ctx.moveTo(x, 162); ctx.lineTo(x + 22, 62); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = "#0b1a29";
  ctx.font = "800 190px Arial, Helvetica, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("LOGIPAY", 540, 290);
  ctx.fillStyle = "#4f6472";
  ctx.font = "600 64px Arial, Helvetica, sans-serif";
  ctx.fillText("Lohn · Touren · Fahrer-App", 548, 430);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function skyTexture(THREE: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const sky = ctx.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, "#050d1f");
  sky.addColorStop(0.32, "#14284a");
  sky.addColorStop(0.5, "#4a3f66");
  sky.addColorStop(0.6, "#b86a62");
  sky.addColorStop(0.68, "#f0a464");
  sky.addColorStop(1, "#f6c27e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 16, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

async function buildScene(container: HTMLDivElement, reducedMotion: boolean) {
  const THREE = await import("three");
  const { RoundedBoxGeometry } = await import("three/examples/jsm/geometries/RoundedBoxGeometry.js");
  const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = skyTexture(THREE);
  scene.fog = new THREE.Fog(0x7d5466, 30, 110);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);

  // Light: warm sunset key light + cool sky fill
  scene.add(new THREE.HemisphereLight(0xb8d8ff, 0x2a2018, 0.9));
  const sun = new THREE.DirectionalLight(0xffc48a, 2.6);
  sun.position.set(-18, 14, 10);
  sun.castShadow = true;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 10, bottom: -10, near: 1, far: 70 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x6fd8ff, 1.2);
  rim.position.set(14, 8, -14);
  scene.add(rim);

  // Ground and road
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), new THREE.MeshStandardMaterial({ color: 0x1c2a24, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(400, 9), new THREE.MeshStandardMaterial({ color: 0x2c3236, roughness: 0.82, metalness: 0.05 }));
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  scene.add(road);
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xf2f2ea, roughness: 0.6 });
  for (const z of [-4.2, 4.2]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(400, 0.16), edgeMaterial);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(0, 0.005, z);
    scene.add(edge);
  }
  // moving centre dashes
  const dashes: import("three").Mesh[] = [];
  const dashGeometry = new THREE.PlaneGeometry(3, 0.16);
  for (let i = 0; i < 40; i++) {
    const dash = new THREE.Mesh(dashGeometry, edgeMaterial);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(-60 + i * 6, 0.006, -1.2);
    scene.add(dash);
    dashes.push(dash);
  }
  // guard rail posts and street lights moving past
  const props: import("three").Object3D[] = [];
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa7ae, metalness: 0.7, roughness: 0.35 });
  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc46b, emissiveIntensity: 2.2 });
  for (let i = 0; i < 14; i++) {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 6, 8), postMaterial);
    pole.position.y = 3;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.6), postMaterial);
    arm.position.set(0, 5.95, 0.75);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), lampMaterial);
    lamp.position.set(0, 5.88, 1.45);
    group.add(pole, arm, lamp);
    group.position.set(-60 + i * 12, 0, -6.2);
    scene.add(group);
    props.push(group);
  }
  // distant trees for depth
  const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x1d3a2c, roughness: 1 });
  const trees: import("three").Mesh[] = [];
  for (let i = 0; i < 46; i++) {
    const tree = new THREE.Mesh(new THREE.ConeGeometry(0.9 + Math.random() * 0.8, 3 + Math.random() * 3, 7), treeMaterial);
    tree.position.set(-70 + i * 3.4, 2, -14 - Math.random() * 18);
    tree.castShadow = true;
    scene.add(tree);
    trees.push(tree);
  }

  // Truck
  const truck = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x0e7f74, metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15191c, roughness: 0.6, metalness: 0.3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc9d0d4, metalness: 1, roughness: 0.18 });
  const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x8e979c, metalness: 0.9, roughness: 0.28 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0c1720, metalness: 0.2, roughness: 0.05, transmission: 0, clearcoat: 1, reflectivity: 1 });
  const trailerSkin = new THREE.MeshStandardMaterial({ color: 0xf4f7f8, roughness: 0.45, metalness: 0.15 });
  const shadowCast = (mesh: import("three").Mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; };

  // trailer (back of the truck is at -x)
  const trailer = shadowCast(new THREE.Mesh(new RoundedBoxGeometry(9.2, 2.9, 2.5, 4, 0.08), trailerSkin));
  trailer.position.set(-2.6, 2.75, 0);
  truck.add(trailer);
  const logo = logoTexture(THREE);
  for (const side of [1.252, -1.252]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 2.7), new THREE.MeshStandardMaterial({ map: logo, roughness: 0.4, metalness: 0.1 }));
    panel.position.set(-2.6, 2.75, side);
    if (side < 0) panel.rotation.y = Math.PI;
    truck.add(panel);
  }
  const trailerBase = shadowCast(new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.35, 2.3), dark));
  trailerBase.position.set(-2.6, 1.15, 0);
  truck.add(trailerBase);
  for (const z of [1.1, -1.1]) {
    const skirt = shadowCast(new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.55, 0.05), dark));
    skirt.position.set(-1.2, 0.85, z);
    truck.add(skirt);
  }
  // rear lights
  for (const z of [-0.95, 0.95]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.4), new THREE.MeshStandardMaterial({ color: 0xff3b2f, emissive: 0xff2a1a, emissiveIntensity: 2 }));
    light.position.set(-7.22, 1.25, z);
    truck.add(light);
  }

  // tractor chassis
  const chassis = shadowCast(new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.4, 1.5), dark));
  chassis.position.set(3.0, 0.85, 0);
  truck.add(chassis);
  // cab
  const cab = shadowCast(new THREE.Mesh(new RoundedBoxGeometry(2.5, 2.7, 2.5, 6, 0.28), paint));
  cab.position.set(4.95, 2.45, 0);
  truck.add(cab);
  const roof = shadowCast(new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.55, 2.4, 6, 0.24), paint));
  roof.position.set(4.7, 4.0, 0);
  truck.add(roof);
  const windshield = new THREE.Mesh(new RoundedBoxGeometry(0.12, 1.15, 2.2, 3, 0.05), glass);
  windshield.position.set(6.2, 3.05, 0);
  windshield.rotation.z = -0.12;
  truck.add(windshield);
  for (const z of [1.255, -1.255]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.95), glass);
    side.position.set(5.45, 3.1, z);
    if (z < 0) side.rotation.y = Math.PI;
    truck.add(side);
    const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.45), chrome);
    mirrorArm.position.set(6.15, 3.05, z * 1.14);
    const mirror = shadowCast(new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.6, 0.25, 2, 0.04), dark));
    mirror.position.set(6.18, 3.0, z * 1.3);
    truck.add(mirrorArm, mirror);
    // fuel tank and steps
    const tank = shadowCast(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.4, 20), chrome));
    tank.rotation.z = Math.PI / 2;
    tank.position.set(3.4, 0.95, z * 0.95);
    truck.add(tank);
    // exhaust stack
    const stack = shadowCast(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 14), chrome));
    stack.position.set(3.65, 2.9, z * 0.95);
    truck.add(stack);
  }
  // grille, bumper, headlights
  const grille = new THREE.Mesh(new RoundedBoxGeometry(0.1, 1.0, 1.7, 2, 0.04), chrome);
  grille.position.set(6.22, 1.75, 0);
  truck.add(grille);
  const bumper = shadowCast(new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.42, 2.5, 3, 0.1), dark));
  bumper.position.set(6.2, 0.9, 0);
  truck.add(bumper);
  const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 3 });
  for (const z of [-0.95, 0.95]) {
    const head = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.22, 0.48, 2, 0.04), headMaterial);
    head.position.set(6.42, 1.28, z);
    truck.add(head);
    const beam = new THREE.SpotLight(0xfff0c8, 40, 30, 0.42, 0.6, 1.6);
    beam.position.set(6.5, 1.3, z);
    beam.target.position.set(18, 0, z * 1.4);
    truck.add(beam, beam.target);
  }

  // wheels
  const wheels: import("three").Group[] = [];
  const tireGeometry = new THREE.CylinderGeometry(0.55, 0.55, 0.42, 32);
  const rimGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.44, 20);
  const hubGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.46, 12);
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.9 });
  const boltMaterial = new THREE.MeshStandardMaterial({ color: 0x5c6870, metalness: 0.8, roughness: 0.3 });
  for (const x of [5.3, 2.4, 1.3, -4.6, -5.7, -6.6]) {
    for (const z of [-1.08, 1.08]) {
      const wheel = new THREE.Group();
      const tire = shadowCast(new THREE.Mesh(tireGeometry, rubber));
      const rim = new THREE.Mesh(rimGeometry, rimMaterial);
      const hub = new THREE.Mesh(hubGeometry, boltMaterial);
      wheel.add(tire, rim, hub);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.55, z);
      truck.add(wheel);
      wheels.push(wheel);
    }
  }
  truck.position.set(0, 0, 1.6);
  scene.add(truck);

  // Sizing: frame the truck for wide and narrow screens
  const resize = () => {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = camera.aspect < 0.9 ? 44 : camera.aspect < 1.4 ? 36 : 30;
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  let visible = true;
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
  io.observe(container);

  const clock = new THREE.Clock();
  let frame = 0;
  let distance = 0;
  const speed = 16; // m/s scenery speed
  const render = () => {
    const delta = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (!reducedMotion) {
      distance += delta * speed;
      for (const dash of dashes) { dash.position.x -= delta * speed; if (dash.position.x < -60) dash.position.x += 240; }
      for (const prop of props) { prop.position.x -= delta * speed; if (prop.position.x < -60) prop.position.x += 168; }
      for (const tree of trees) { tree.position.x -= delta * speed * 0.35; if (tree.position.x < -70) tree.position.x += 156; }
      for (const wheel of wheels) wheel.rotation.y -= (delta * speed) / 0.55;
      truck.position.y = Math.sin(t * 9) * 0.012;
      truck.rotation.x = Math.sin(t * 1.3) * 0.004;
    }
    // slow cinematic orbit around the truck
    const narrow = camera.aspect < 0.9;
    const angle = reducedMotion ? 0.7 : 0.7 + Math.sin(t * 0.12) * 0.28;
    const radius = narrow ? 30 : 24;
    camera.position.set(Math.sin(angle) * radius, (narrow ? 5.5 : 4.2) + Math.sin(t * 0.2) * 0.4, 1.6 + Math.cos(angle) * radius);
    // look past the truck so it sits on the right (wide) or in the lower half (narrow)
    camera.lookAt(narrow ? 0 : -12, narrow ? 9.5 : 2.6, narrow ? 1.6 : -3);
    renderer.render(scene, camera);
  };
  const loop = () => {
    frame = requestAnimationFrame(loop);
    if (!visible || document.hidden) { clock.getDelta(); return; }
    render();
  };
  if (reducedMotion) render(); else loop();

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    io.disconnect();
    renderer.dispose();
    pmrem.dispose();
    scene.traverse((object) => {
      const mesh = object as import("three").Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as import("three").Material | import("three").Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose()); else material?.dispose?.();
    });
    renderer.domElement.remove();
  };
}

export function Truck3D() {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    buildScene(container, reduced).then((dispose) => {
      if (cancelled) dispose(); else { cleanup = dispose; setReady(true); }
    }).catch(() => undefined);
    return () => { cancelled = true; cleanup?.(); };
  }, []);
  return <div ref={ref} className={`truck3d ${ready ? "truck3d-ready" : ""}`} aria-hidden="true" />;
}
