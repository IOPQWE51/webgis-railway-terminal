import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
    Play,
    Pause,
    X,
    Maximize2,
    Minimize2,
    Sun,
    Camera,
    RotateCcw,
    PlaneTakeoff,
    Globe,
} from 'lucide-react';
import {
    latLonToCartesian,
    computeSubsolarPoint,
    sampleFlightArc3D,
    computeFlightTelemetry,
    formatUtcClock,
} from '../utils/flightGlobeMath';

const EARTH_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormalWorld;
  varying vec3 vPosWorld;
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vPosWorld = worldPos.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const EARTH_FRAGMENT_SHADER = `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform vec3 uSunDir;
  uniform float uTexturesReady;
  varying vec2 vUv;
  varying vec3 vNormalWorld;
  varying vec3 vPosWorld;

  void main() {
    vec3 N = normalize(vNormalWorld);
    vec3 L = normalize(uSunDir);
    vec3 V = normalize(cameraPosition - vPosWorld);

    float ndl = dot(N, L);
    // 平滑昼夜晨昏过渡带
    float dayMix = smoothstep(-0.14, 0.18, ndl);
    // 晨昏线橙红暖带
    float twilight = exp(-pow(ndl * 6.5, 2.0)) * 0.42;

    vec3 dayTex = texture2D(uDayMap, vUv).rgb;
    vec3 nightTex = texture2D(uNightMap, vUv).rgb;

    // 贴图未就绪前用柔和球面海蓝兜底
    vec3 fallbackDay = mix(vec3(0.08, 0.24, 0.46), vec3(0.18, 0.44, 0.34), smoothstep(0.35, 0.65, sin(vUv.x * 18.0) * cos(vUv.y * 10.0) * 0.5 + 0.5));
    vec3 fallbackNight = vec3(0.02, 0.05, 0.12);
    dayTex = mix(fallbackDay, dayTex, uTexturesReady);
    nightTex = mix(fallbackNight, nightTex, uTexturesReady);

    // 白昼漫反射 + 海洋高光微反光
    float diffuse = 0.26 + 0.88 * max(ndl, 0.0);
    vec3 H = normalize(L + V);
    float oceanMask = clamp((dayTex.b - dayTex.r) * 2.4, 0.0, 1.0);
    float spec = pow(max(dot(N, H), 0.0), 34.0) * 0.26 * oceanMask * smoothstep(0.0, 0.25, ndl);
    vec3 dayColor = dayTex * diffuse + vec3(0.85, 0.93, 1.0) * spec;

    // 夜间城市灯火增亮 + 深靛夜底
    vec3 nightColor = nightTex * 1.45 + vec3(0.015, 0.03, 0.075);

    vec3 baseColor = mix(nightColor, dayColor, dayMix);
    baseColor += vec3(0.98, 0.46, 0.18) * twilight;

    // 边缘大气散射蓝晕
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.2);
    vec3 rimColor = mix(vec3(0.12, 0.32, 0.72), vec3(0.36, 0.76, 1.0), dayMix);
    baseColor += rimColor * rim * 0.55;

    gl_FragColor = vec4(baseColor, 1.0);
  }
`;

const ATMOS_VERTEX_SHADER = `
  varying vec3 vNormalWorld;
  varying vec3 vPosWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosWorld = wp.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const ATMOS_FRAGMENT_SHADER = `
  uniform vec3 uSunDir;
  varying vec3 vNormalWorld;
  varying vec3 vPosWorld;
  void main() {
    vec3 N = normalize(vNormalWorld);
    vec3 V = normalize(cameraPosition - vPosWorld);
    float fresnel = pow(clamp(1.0 - abs(dot(N, V)), 0.0, 1.0), 2.8);
    float sunSide = smoothstep(-0.25, 0.45, dot(N, normalize(uSunDir)));
    vec3 col = mix(vec3(0.14, 0.34, 0.78), vec3(0.45, 0.82, 1.0), sunSide);
    gl_FragColor = vec4(col, fresnel * (0.28 + 0.32 * sunSide));
  }
`;

/**
 * 构建带金属反光、双发引擎、翼梢小翼与红/绿航行灯/尾灯的写实宽体客机（本地零依赖兜底；同时支持自动升级为 public/models/airliner.glb）
 * 局部坐标系约定：+Z 为机头前进方向，+Y 为机背向上，+X 为右侧机翼
 */
function buildProceduralAirliner() {
    const root = new THREE.Group();

    const fuselageMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        metalness: 0.62,
        roughness: 0.24,
    });
    const wingMat = new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        metalness: 0.68,
        roughness: 0.28,
    });
    const accentMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        metalness: 0.38,
        roughness: 0.32,
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.78,
        roughness: 0.25,
    });

    // 机身主筒
    const bodyGeo = new THREE.CylinderGeometry(0.011, 0.010, 0.11, 20);
    bodyGeo.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, fuselageMat);
    root.add(body);

    // 机头整流锥
    const noseGeo = new THREE.SphereGeometry(0.011, 18, 14);
    noseGeo.scale(1, 0.92, 2.2);
    const nose = new THREE.Mesh(noseGeo, fuselageMat);
    nose.position.set(0, -0.0005, 0.055);
    root.add(nose);

    // 驾驶舱风挡深色玻璃
    const cockpitGeo = new THREE.SphereGeometry(0.0085, 14, 10);
    cockpitGeo.scale(0.95, 0.62, 1.35);
    const cockpit = new THREE.Mesh(cockpitGeo, darkMetalMat);
    cockpit.position.set(0, 0.0052, 0.056);
    root.add(cockpit);

    // 机尾锥
    const tailConeGeo = new THREE.ConeGeometry(0.010, 0.044, 16);
    tailConeGeo.rotateX(-Math.PI / 2);
    const tailCone = new THREE.Mesh(tailConeGeo, fuselageMat);
    tailCone.position.set(0, 0.001, -0.077);
    root.add(tailCone);

    // 机身腰线涂装
    const stripeGeo = new THREE.CylinderGeometry(0.0112, 0.0102, 0.088, 16, 1, true);
    stripeGeo.rotateX(Math.PI / 2);
    const stripe = new THREE.Mesh(stripeGeo, accentMat);
    stripe.scale.set(1, 0.22, 1);
    stripe.position.set(0, 0.0015, -0.004);
    root.add(stripe);

    // 左右后掠主翼 + 翼梢小翼
    const makeWing = (side) => {
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0.020);
        wingShape.lineTo(side * 0.088, -0.022);
        wingShape.lineTo(side * 0.088, -0.032);
        wingShape.lineTo(0, -0.014);
        wingShape.closePath();

        const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
            depth: 0.0024,
            bevelEnabled: true,
            bevelSize: 0.0008,
            bevelThickness: 0.0008,
            bevelSegments: 2,
        });
        wingGeo.rotateX(Math.PI / 2);
        const wing = new THREE.Mesh(wingGeo, wingMat);
        wing.position.set(0, -0.002, 0.006);
        root.add(wing);

        // 翼梢小翼
        const wingletGeo = new THREE.BoxGeometry(0.002, 0.012, 0.010);
        const winglet = new THREE.Mesh(wingletGeo, accentMat);
        winglet.position.set(side * 0.088, 0.003, -0.022);
        winglet.rotation.z = -side * 0.28;
        root.add(winglet);

        // 翼下双发涡扇发动机
        const engGeo = new THREE.CylinderGeometry(0.0062, 0.0054, 0.026, 16);
        engGeo.rotateX(Math.PI / 2);
        const eng = new THREE.Mesh(engGeo, wingMat);
        eng.position.set(side * 0.032, -0.009, 0.008);
        root.add(eng);

        const intakeGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.004, 14);
        intakeGeo.rotateX(Math.PI / 2);
        const intake = new THREE.Mesh(intakeGeo, darkMetalMat);
        intake.position.set(side * 0.032, -0.009, 0.020);
        root.add(intake);
    };
    makeWing(1);
    makeWing(-1);

    // 水平尾翼
    const hStabShape = new THREE.Shape();
    hStabShape.moveTo(0, 0.012);
    hStabShape.lineTo(0.034, -0.008);
    hStabShape.lineTo(0.034, -0.015);
    hStabShape.lineTo(0, -0.006);
    hStabShape.lineTo(-0.034, -0.015);
    hStabShape.lineTo(-0.034, -0.008);
    hStabShape.closePath();
    const hStabGeo = new THREE.ExtrudeGeometry(hStabShape, { depth: 0.0018, bevelEnabled: false });
    hStabGeo.rotateX(Math.PI / 2);
    const hStab = new THREE.Mesh(hStabGeo, wingMat);
    hStab.position.set(0, 0.002, -0.072);
    root.add(hStab);

    // 垂直尾翼
    const vStabShape = new THREE.Shape();
    vStabShape.moveTo(0, 0);
    vStabShape.lineTo(-0.024, 0.032);
    vStabShape.lineTo(-0.036, 0.032);
    vStabShape.lineTo(-0.026, 0);
    vStabShape.closePath();
    const vStabGeo = new THREE.ExtrudeGeometry(vStabShape, { depth: 0.0022, bevelEnabled: false });
    vStabGeo.rotateY(Math.PI / 2);
    const vStab = new THREE.Mesh(vStabGeo, accentMat);
    vStab.position.set(-0.0011, 0.006, -0.052);
    root.add(vStab);

    // 航空航行灯：左红、右绿、尾部频闪白灯
    const navLights = {};
    const makeNavLamp = (colorHex, pos, radius = 0.0034) => {
        const mat = new THREE.MeshBasicMaterial({ color: colorHex });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 10), mat);
        mesh.position.set(pos[0], pos[1], pos[2]);
        root.add(mesh);
        return { mesh, mat };
    };
    navLights.portRed = makeNavLamp(0xff3344, [-0.089, 0.002, -0.022], 0.0036);
    navLights.starboardGreen = makeNavLamp(0x22ff66, [0.089, 0.002, -0.022], 0.0036);
    navLights.tailStrobe = makeNavLamp(0xffffff, [0, 0.038, -0.084], 0.0038);
    navLights.bellyBeacon = makeNavLamp(0xff2222, [0, -0.012, -0.008], 0.0028);

    root.userData.navLights = navLights;
    return root;
}

const FlightGlobe3D = ({ route, onClose }) => {
    const mountRef = useRef(null);
    const fromLabelRef = useRef(null);
    const toLabelRef = useRef(null);

    const [isExpanded, setIsExpanded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [speed, setSpeed] = useState(1);
    const [followCamera, setFollowCamera] = useState(false);
    const [progress, setProgress] = useState(0.08);
    const [utcHours, setUtcHours] = useState(() => {
        const now = new Date();
        return now.getUTCHours() + now.getUTCMinutes() / 60;
    });
    const [modelSource, setModelSource] = useState('PBR 写实客机');
    const [webglError, setWebglError] = useState('');

    // Refs synced for the 60fps animation loop without tearing down the WebGL scene
    const isPlayingRef = useRef(isPlaying);
    const speedRef = useRef(speed);
    const followCameraRef = useRef(followCamera);
    const progressRef = useRef(progress);
    const utcHoursRef = useRef(utcHours);

    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { speedRef.current = speed; }, [speed]);
    useEffect(() => { followCameraRef.current = followCamera; }, [followCamera]);
    useEffect(() => { utcHoursRef.current = utcHours; }, [utcHours]);

    const from = route?.from;
    const to = route?.to;
    const distanceKm = route?.stats?.distanceKm || 1500;
    const durationLabel = route?.stats?.durationLabel || '';

    const arcSamples = useMemo(
        () => (from && to ? sampleFlightArc3D(from, to, { segments: 120, earthRadius: 1 }) : []),
        [from, to]
    );

    const telemetry = useMemo(() => {
        if (arcSamples.length < 2) return null;
        const idx = Math.min(arcSamples.length - 1, Math.max(0, Math.round(progress * (arcSamples.length - 1))));
        const s = arcSamples[idx];
        const sun = computeSubsolarPoint(new Date(), utcHours);
        return computeFlightTelemetry(progress, distanceKm, { x: s.ux, y: s.uy, z: s.uz }, sun.direction);
    }, [arcSamples, progress, distanceKm, utcHours]);

    // Escape 快速关闭
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    // Three.js 主场景初始化与动画循环
    useEffect(() => {
        const container = mountRef.current;
        if (!container || !from || !to || arcSamples.length < 2) return undefined;

        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        } catch {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- WebGL 初始化失败一次性降级提示
            setWebglError('当前浏览器环境暂不支持 WebGL 3D 渲染。');
            return undefined;
        }

        const disposables = [];
        const track = (obj) => { disposables.push(obj); return obj; };

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(container.clientWidth || 560, container.clientHeight || 360);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x030712);

        const camera = new THREE.PerspectiveCamera(
            42,
            (container.clientWidth || 560) / (container.clientHeight || 360),
            0.02,
            100
        );

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.enablePan = false;
        controls.minDistance = 1.32;
        controls.maxDistance = 4.5;

        // 镜头初始对准航线中点上方
        const midSample = arcSamples[Math.floor(arcSamples.length / 2)];
        const midVec = new THREE.Vector3(midSample.ux, midSample.uy, midSample.uz).normalize();
        const camDist = distanceKm > 7000 ? 2.85 : distanceKm > 3000 ? 2.45 : 2.05;
        camera.position.copy(midVec.clone().multiplyScalar(camDist));
        camera.lookAt(0, 0, 0);

        // 宇宙星空背景
        const starCount = 1200;
        const starPos = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i += 1) {
            const r = 18 + Math.random() * 24;
            const u = Math.random();
            const v = Math.random();
            const theta = 2 * Math.PI * u;
            const phi = Math.acos(2 * v - 1);
            starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            starPos[i * 3 + 1] = r * Math.cos(phi);
            starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        }
        const starGeo = track(new THREE.BufferGeometry());
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        const starMat = track(new THREE.PointsMaterial({ color: 0xcbd5e1, size: 0.09, transparent: true, opacity: 0.72 }));
        scene.add(new THREE.Points(starGeo, starMat));

        // 太阳直射光 + 太空环境反光（让客机金属机身呈现真实明暗与高光）
        const sunLight = new THREE.DirectionalLight(0xfff7ed, 2.4);
        scene.add(sunLight);
        const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
        rimLight.position.set(-4, -2, -3);
        scene.add(rimLight);
        scene.add(new THREE.AmbientLight(0x94a3b8, 0.75));

        // 1×1 占位纹理，等待本地 2K NASA 贴图就绪
        const placeholderTex = track(new THREE.DataTexture(new Uint8Array([15, 38, 72, 255]), 1, 1));
        placeholderTex.needsUpdate = true;

        const initSun = computeSubsolarPoint(new Date(), utcHoursRef.current);
        const earthUniforms = {
            uDayMap: { value: placeholderTex },
            uNightMap: { value: placeholderTex },
            uSunDir: { value: new THREE.Vector3(initSun.direction.x, initSun.direction.y, initSun.direction.z) },
            uTexturesReady: { value: 0.0 },
        };

        const earthGeo = track(new THREE.SphereGeometry(1, 64, 48));
        const earthMat = track(new THREE.ShaderMaterial({
            uniforms: earthUniforms,
            vertexShader: EARTH_VERTEX_SHADER,
            fragmentShader: EARTH_FRAGMENT_SHADER,
        }));
        const earthMesh = new THREE.Mesh(earthGeo, earthMat);
        scene.add(earthMesh);

        // 加载本地 public/textures/earth-day.jpg & earth-night.jpg
        const texLoader = new THREE.TextureLoader();
        let loadedCount = 0;
        const onTexLoaded = () => {
            loadedCount += 1;
            if (loadedCount >= 2) {
                earthUniforms.uTexturesReady.value = 1.0;
            }
        };
        texLoader.load('/textures/earth-day.jpg', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 4;
            track(tex);
            earthUniforms.uDayMap.value = tex;
            onTexLoaded();
        });
        texLoader.load('/textures/earth-night.jpg', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 4;
            track(tex);
            earthUniforms.uNightMap.value = tex;
            onTexLoaded();
        });

        // 外层大气蓝晕
        const atmosGeo = track(new THREE.SphereGeometry(1.032, 48, 36));
        const atmosMat = track(new THREE.ShaderMaterial({
            uniforms: { uSunDir: earthUniforms.uSunDir },
            vertexShader: ATMOS_VERTEX_SHADER,
            fragmentShader: ATMOS_FRAGMENT_SHADER,
            side: THREE.BackSide,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        }));
        scene.add(new THREE.Mesh(atmosGeo, atmosMat));

        // 3D 大圆航线管道
        const curvePoints = arcSamples.map((p) => new THREE.Vector3(p.x, p.y, p.z));
        const flightCurve = new THREE.CatmullRomCurve3(curvePoints);

        const baseTubeGeo = track(new THREE.TubeGeometry(flightCurve, 128, 0.0042, 8, false));
        const baseTubeMat = track(new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.42,
        }));
        scene.add(new THREE.Mesh(baseTubeGeo, baseTubeMat));

        const glowTubeGeo = track(new THREE.TubeGeometry(flightCurve, 128, 0.0078, 8, false));
        const glowTubeMat = track(new THREE.MeshBasicMaterial({
            color: 0x7dd3fc,
            transparent: true,
            opacity: 0.16,
        }));
        scene.add(new THREE.Mesh(glowTubeGeo, glowTubeMat));

        // 起降机场地面信标点
        const fromPos = latLonToCartesian(from.lat, from.lon, 1.005);
        const toPos = latLonToCartesian(to.lat, to.lon, 1.005);
        const fromVec = new THREE.Vector3(fromPos.x, fromPos.y, fromPos.z);
        const toVec = new THREE.Vector3(toPos.x, toPos.y, toPos.z);

        const makeHubBeacon = (vec, colorHex) => {
            const dotGeo = track(new THREE.SphereGeometry(0.015, 16, 16));
            const dotMat = track(new THREE.MeshBasicMaterial({ color: colorHex }));
            const dot = new THREE.Mesh(dotGeo, dotMat);
            dot.position.copy(vec);
            scene.add(dot);

            const ringGeo = track(new THREE.RingGeometry(0.018, 0.028, 24));
            const ringMat = track(new THREE.MeshBasicMaterial({
                color: colorHex,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.85,
            }));
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.copy(vec.clone().multiplyScalar(1.001));
            ring.lookAt(vec.clone().multiplyScalar(2));
            scene.add(ring);
            return ring;
        };
        const fromRing = makeHubBeacon(fromVec, 0x38bdf8);
        const toRing = makeHubBeacon(toVec, 0xf59e0b);

        // 客机容器（默认即刻挂 PBR 程序化客机；若 public/models/airliner.glb 存在则静默无缝替换）
        const aircraftPivot = new THREE.Group();
        const proceduralPlane = buildProceduralAirliner();
        aircraftPivot.add(proceduralPlane);
        scene.add(aircraftPivot);

        let disposed = false;
        // 静默探测本地自定义 .glb 模型（若未来放进 public/models/airliner.glb 会自动启用）
        fetch('/models/airliner.glb', { method: 'HEAD' })
            .then((res) => {
                const ct = res.headers.get('content-type') || '';
                if (!res.ok || ct.includes('text/html') || disposed) return;
                const gltfLoader = new GLTFLoader();
                gltfLoader.load('/models/airliner.glb', (gltf) => {
                    if (disposed || !gltf?.scene) return;
                    const glbModel = gltf.scene;
                    const box = new THREE.Box3().setFromObject(glbModel);
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z) || 1;
                    glbModel.scale.setScalar(0.18 / maxDim);
                    aircraftPivot.remove(proceduralPlane);
                    aircraftPivot.add(glbModel);
                    setModelSource('GLB 3D 客机');
                });
            })
            .catch(() => { /* 无自定义 .glb 时静默使用 PBR 客机 */ });

        // 尺寸自适应
        const resize = () => {
            if (!container) return;
            const w = container.clientWidth || 560;
            const h = container.clientHeight || 360;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
        ro?.observe(container);

        // 将 3D 机场坐标投影为 2D 浮层标签（在球背时自动淡出）
        const projectLabel = (el, worldVec) => {
            if (!el) return;
            const camDir = camera.position.clone().sub(worldVec).normalize();
            const outward = worldVec.clone().normalize();
            const visible = outward.dot(camDir) > 0.05;
            if (!visible) {
                el.style.opacity = '0';
                return;
            }
            const projected = worldVec.clone().project(camera);
            const x = (projected.x * 0.5 + 0.5) * (container.clientWidth || 560);
            const y = (-projected.y * 0.5 + 0.5) * (container.clientHeight || 360);
            el.style.opacity = '1';
            el.style.transform = `translate(-50%, -135%) translate(${x}px, ${y}px)`;
        };

        // 实时帧循环
        const upVec = new THREE.Vector3();
        const forwardVec = new THREE.Vector3();
        const rightVec = new THREE.Vector3();
        const basisMatrix = new THREE.Matrix4();
        const pitchQuat = new THREE.Quaternion();
        const chasePos = new THREE.Vector3();

        let lastTime = performance.now();
        let uiSyncAccum = 0;
        let rafId = 0;

        const animate = (now) => {
            rafId = requestAnimationFrame(animate);
            const dt = Math.min(0.05, (now - lastTime) / 1000);
            lastTime = now;

            // 推进飞行进度
            if (isPlayingRef.current) {
                const cycleSeconds = 18;
                let nextT = progressRef.current + (dt / cycleSeconds) * speedRef.current;
                if (nextT > 1) nextT = 0;
                progressRef.current = nextT;
                uiSyncAccum += dt;
                if (uiSyncAccum >= 0.08) {
                    uiSyncAccum = 0;
                    setProgress(nextT);
                }
            }

            // 更新太阳位置与昼夜晨昏线
            const sun = computeSubsolarPoint(new Date(), utcHoursRef.current);
            earthUniforms.uSunDir.value.set(sun.direction.x, sun.direction.y, sun.direction.z).normalize();
            sunLight.position.copy(earthUniforms.uSunDir.value).multiplyScalar(6);

            // 更新飞机位置与切线姿态 + 爬升/进近俯仰角
            const t = Math.max(0.002, Math.min(0.998, progressRef.current));
            const pos = flightCurve.getPointAt(t);
            const ahead = flightCurve.getPointAt(Math.min(0.9995, t + 0.005));

            aircraftPivot.position.copy(pos);
            upVec.copy(pos).normalize();
            forwardVec.copy(ahead).sub(pos).normalize();
            // Gram-Schmidt 正交化保证机翼与地表平行
            rightVec.crossVectors(upVec, forwardVec).normalize();
            forwardVec.crossVectors(rightVec, upVec).normalize();
            basisMatrix.makeBasis(rightVec, upVec, forwardVec);
            aircraftPivot.quaternion.setFromRotationMatrix(basisMatrix);

            const tel = computeFlightTelemetry(t, distanceKm, upVec, sun.direction);
            // 局部 X 轴（右翼方向）俯仰：负角抬头爬升，正角低头进近
            pitchQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -tel.pitchRad);
            aircraftPivot.quaternion.multiply(pitchQuat);

            // 客机随镜距自适应缩放，远景醒目、近景精致
            const distToCam = camera.position.distanceTo(pos);
            aircraftPivot.scale.setScalar(Math.max(0.55, Math.min(1.45, distToCam * 0.48)));

            // 航行灯频闪脉冲
            const nav = proceduralPlane.userData?.navLights;
            if (nav) {
                const pulse = Math.sin(now * 0.008) > 0.72 ? 1.55 : 0.45;
                nav.tailStrobe.mesh.scale.setScalar(pulse);
                const beaconPulse = Math.sin(now * 0.005 + 1.2) > 0.6 ? 1.45 : 0.55;
                nav.bellyBeacon.mesh.scale.setScalar(beaconPulse);
            }

            // 机场脉动圆环
            const ringScale = 1 + 0.18 * Math.sin(now * 0.004);
            fromRing.scale.setScalar(ringScale);
            toRing.scale.setScalar(1 + 0.18 * Math.sin(now * 0.004 + Math.PI));

            // 跟随客机相机模式
            if (followCameraRef.current) {
                chasePos
                    .copy(pos)
                    .addScaledVector(forwardVec, -0.34)
                    .addScaledVector(upVec, 0.24)
                    .addScaledVector(rightVec, 0.14);
                camera.position.lerp(chasePos, Math.min(1, dt * 3.2));
                controls.target.lerp(pos, Math.min(1, dt * 4.5));
            } else {
                controls.target.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 5));
            }

            controls.update();
            renderer.render(scene, camera);

            projectLabel(fromLabelRef.current, fromVec);
            projectLabel(toLabelRef.current, toVec);
        };

        rafId = requestAnimationFrame(animate);

        return () => {
            disposed = true;
            cancelAnimationFrame(rafId);
            ro?.disconnect();
            controls.dispose();
            scene.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose?.();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
                    else obj.material.dispose?.();
                }
            });
            disposables.forEach((d) => d?.dispose?.());
            renderer.dispose();
            container.innerHTML = '';
        };
    }, [from, to, arcSamples, distanceKm]);

    if (!from || !to) return null;

    const handleScrub = (nextVal) => {
        progressRef.current = nextVal;
        setProgress(nextVal);
    };

    const handleResetUtcNow = () => {
        const now = new Date();
        setUtcHours(now.getUTCHours() + now.getUTCMinutes() / 60);
    };

    return createPortal(
        <div
            className={
                isExpanded
                    ? 'fixed inset-0 z-[9998] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200'
                    : 'fixed bottom-4 right-4 z-[9998] w-[min(94vw,560px)] animate-in slide-in-from-bottom duration-200'
            }
            role="dialog"
            aria-label="3D 地球航线画中画"
        >
            <div
                className={`bg-slate-950/95 text-slate-100 border border-sky-500/35 shadow-[0_24px_64px_rgba(2,6,23,0.72)] overflow-hidden flex flex-col ${
                    isExpanded ? 'w-full max-w-5xl h-[min(88vh,740px)] rounded-3xl' : 'w-full rounded-3xl'
                }`}
            >
                {/* 顶栏：航线标题 + 模型标签 + 放大/关闭 */}
                <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-7 h-7 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0">
                            <Globe className="w-4 h-4 text-sky-400" />
                        </span>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-white truncate">
                                <span>{from.code} {from.city}</span>
                                <PlaneTakeoff className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                <span>{to.code} {to.city}</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2 truncate">
                                <span>{distanceKm.toLocaleString()} km</span>
                                {durationLabel && <span>· {durationLabel}</span>}
                                <span className="text-sky-400">· {modelSource}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={() => setFollowCamera((v) => !v)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                                followCamera
                                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                                    : 'bg-slate-800/80 text-slate-200 border-slate-700 hover:border-sky-400/50'
                            }`}
                            title="切换跟随客机视角或自由拖拽旋转地球"
                        >
                            <Camera className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{followCamera ? '跟随客机' : '自由视角'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsExpanded((v) => !v)}
                            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                            title={isExpanded ? '缩小为画中画浮窗' : '放大为沉浸大窗'}
                            aria-label={isExpanded ? '缩小为画中画浮窗' : '放大为沉浸大窗'}
                        >
                            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/25 hover:text-rose-300 text-slate-300 border border-slate-700 transition-colors"
                            title="关闭 3D 航线画中画 (Esc)"
                            aria-label="关闭 3D 航线画中画"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* 3D WebGL 画布区 */}
                <div className={`relative w-full bg-slate-950 overflow-hidden ${isExpanded ? 'flex-1 min-h-0' : 'h-[310px] sm:h-[340px]'}`}>
                    {webglError ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 text-xs gap-2 p-6 text-center">
                            <Globe className="w-8 h-8 text-sky-400 opacity-60" />
                            <p>{webglError}</p>
                        </div>
                    ) : (
                        <>
                            <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

                            {/* 3D 投影起降机场胶囊标签 */}
                            <div
                                ref={fromLabelRef}
                                className="pointer-events-none absolute top-0 left-0 px-2 py-0.5 rounded-lg bg-slate-950/90 border border-sky-400/70 text-[10px] font-bold text-white whitespace-nowrap shadow-lg transition-opacity duration-150"
                                style={{ opacity: 0 }}
                            >
                                🛫 {from.code} {from.city}
                            </div>
                            <div
                                ref={toLabelRef}
                                className="pointer-events-none absolute top-0 left-0 px-2 py-0.5 rounded-lg bg-slate-950/90 border border-amber-400/75 text-[10px] font-bold text-white whitespace-nowrap shadow-lg transition-opacity duration-150"
                                style={{ opacity: 0 }}
                            >
                                🛬 {to.code} {to.city}
                            </div>

                            {/* 左上实时遥测胶囊 */}
                            {telemetry && (
                                <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap items-center gap-1.5 max-w-[85%]">
                                    <span className="px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-700/80 text-[11px] font-bold text-sky-300">
                                        {telemetry.phase}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-700/80 text-[11px] font-mono text-slate-200">
                                        {telemetry.altitudeFt.toLocaleString()} ft
                                    </span>
                                    <span className="px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-700/80 text-[11px] font-bold text-amber-200">
                                        {telemetry.lightingZone}
                                    </span>
                                </div>
                            )}

                            {/* 右下操作提示 */}
                            <div className="pointer-events-none absolute bottom-2.5 right-3 text-[10px] text-slate-400 bg-slate-950/70 px-2 py-0.5 rounded-full">
                                拖拽旋转地球 · 滚轮缩放
                            </div>
                        </>
                    )}
                </div>

                {/* 底部飞行进度 + 昼夜晨昏线控制台 */}
                <div className="px-4 py-3 bg-slate-900/95 border-t border-slate-800 space-y-2.5">
                    {/* 第一行：播放控制 + 航程进度条 */}
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => setIsPlaying((p) => !p)}
                            className="w-8 h-8 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 flex items-center justify-center shrink-0 transition-colors"
                            aria-label={isPlaying ? '暂停飞行' : '继续飞行'}
                        >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                            {[1, 2, 5].map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setSpeed(s)}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition-colors ${
                                        speed === s
                                            ? 'bg-sky-500/20 text-sky-300 border-sky-400/60'
                                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                                    }`}
                                >
                                    {s}×
                                </button>
                            ))}
                        </div>

                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.002}
                            value={progress}
                            onChange={(e) => handleScrub(Number(e.target.value))}
                            aria-label="飞行进度"
                            className="flex-1 accent-sky-400 cursor-pointer"
                        />

                        {telemetry && (
                            <span className="text-[11px] font-mono text-slate-300 shrink-0 min-w-[92px] text-right">
                                {telemetry.progressPct}% · 剩 {telemetry.distanceRemainKm.toLocaleString()}km
                            </span>
                        )}
                    </div>

                    {/* 第二行：昼夜晨昏线 UTC 时刻拨盘 */}
                    <div className="flex items-center gap-2.5 text-[11px] text-slate-300 pt-1 border-t border-slate-800/80">
                        <span className="inline-flex items-center gap-1 font-bold text-amber-300 shrink-0">
                            <Sun className="w-3.5 h-3.5" /> 昼夜晨昏线
                        </span>
                        <input
                            type="range"
                            min={0}
                            max={23.95}
                            step={0.25}
                            value={utcHours}
                            onChange={(e) => setUtcHours(Number(e.target.value))}
                            aria-label="调整 UTC 时刻观察昼夜晨昏线"
                            className="flex-1 accent-amber-400 cursor-pointer"
                        />
                        <span className="font-mono text-amber-200 shrink-0 min-w-[68px] text-right">
                            {formatUtcClock(utcHours)}
                        </span>
                        <button
                            type="button"
                            onClick={handleResetUtcNow}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 border border-slate-700 shrink-0"
                            title="回到当前实时 UTC 昼夜"
                        >
                            <RotateCcw className="w-3 h-3" /> 实时
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default FlightGlobe3D;
