import { t } from '../data/language'
import { portfolioDemo } from '../data/portfolioDemo'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export type RoomObject = 'lamp' | 'window' | 'bookcase' | 'wardrobe' | 'desk'

type RoomSceneProps = {
  materialized: boolean
  lightOn: boolean
  woolf: boolean
  windowOpen: boolean
  wardrobeOpen: boolean
  journalOpen: boolean
  onActivate: (object: RoomObject) => void
}

type SceneState = Omit<RoomSceneProps, 'onActivate'>

type AnimatedMaterial = {
  material: THREE.MeshStandardMaterial
  color: THREE.Color
  paper: THREE.Color
}

const DURATION = 12
const texturePaths = [
  import.meta.env.BASE_URL + 'assets/collage/c_gothic.webp',
  import.meta.env.BASE_URL + 'assets/collage/s_plate.webp',
  import.meta.env.BASE_URL + 'assets/collage/s_teapot.webp',
  import.meta.env.BASE_URL + 'assets/collage/c_gallery.webp',
  import.meta.env.BASE_URL + 'assets/collage/s_arch.webp',
  import.meta.env.BASE_URL + 'assets/collage/crest.webp',
  import.meta.env.BASE_URL + 'assets/collage/s_plate.webp',
]

declare global {
  interface Window {
    __SCENE_READY__?: boolean
    __SCENE_ERROR__?: string
    __CAPTURE_MODE__?: boolean
    __SCENE_STATS__?: { drawCalls: number; triangles: number; geometries: number; textures: number }
    __seek?: (time: number) => void
    __capture?: (time: number) => string
    __restore?: () => void
  }
}

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function canvasTexture(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable')
  draw(context)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function makeRugTexture() {
  const texture = canvasTexture(512, 512, (context) => {
    context.fillStyle = '#777b69'
    context.fillRect(0, 0, 512, 512)
    context.strokeStyle = 'rgba(226,215,207,.48)'
    context.lineWidth = 3
    for (let y = -64; y < 576; y += 64) {
      for (let x = -64; x < 576; x += 64) {
        context.beginPath()
        context.moveTo(x + 32, y)
        context.lineTo(x + 64, y + 32)
        context.lineTo(x + 32, y + 64)
        context.lineTo(x, y + 32)
        context.closePath()
        context.stroke()
        context.fillStyle = 'rgba(83,62,89,.38)'
        context.beginPath()
        context.arc(x + 32, y + 32, 5, 0, Math.PI * 2)
        context.fill()
      }
    }
    context.strokeStyle = 'rgba(53,45,49,.4)'
    context.lineWidth = 10
    context.strokeRect(12, 12, 488, 488)
  })
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 1)
  return texture
}

function makeBookTexture() {
  return canvasTexture(512, 640, (context) => {
    context.fillStyle = '#ded8c8'
    context.fillRect(0, 0, 512, 640)
    context.strokeStyle = '#75687b'
    context.lineWidth = 3
    context.strokeRect(35, 35, 442, 570)
    context.textAlign = 'center'
    context.fillStyle = '#4f4059'
    context.font = '34px Georgia'
    context.fillText('A ROOM', 256, 185)
    context.fillText('OF ONE’S', 256, 236)
    context.fillText('OWN', 256, 287)
    context.font = 'italic 22px Georgia'
    context.fillText('Virginia Woolf', 256, 355)
    context.beginPath()
    context.moveTo(170, 405)
    context.bezierCurveTo(225, 360, 280, 455, 345, 390)
    context.stroke()
  })
}

function makeAsciiTexture(character: string) {
  return canvasTexture(64, 64, (context) => {
    context.clearRect(0, 0, 64, 64)
    context.fillStyle = '#e4eee2'
    context.font = '44px monospace'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(character, 32, 34)
  })
}

function setShadow(object: THREE.Object3D, cast = true, receive = true) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = cast
      child.receiveShadow = receive
    }
  })
}

export default function RoomScene(props: RoomSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  const stateRenderRef = useRef<(() => void) | null>(null)
  const [error, setError] = useState<string | null>(null)
  propsRef.current = props

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
    } catch {
      setError(t("当前浏览器未能启动三维场景，仍可直接进入工作台。"))
      window.__SCENE_ERROR__ = 'WebGL renderer could not be created'
      window.__SCENE_READY__ = true
      return
    }

    const capture = new URLSearchParams(window.location.search).get('capture') === '1'
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.__CAPTURE_MODE__ = capture
    window.__SCENE_READY__ = false
    delete window.__SCENE_ERROR__

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.className = 'room-canvas'
    renderer.domElement.setAttribute('aria-label', t("可拖动环顾、点击物件的三维文学房间"))
    renderer.domElement.setAttribute('role', 'img')
    host.prepend(renderer.domElement)

    const scene = new THREE.Scene()
    const backgroundColor = new THREE.Color('#c9c1c6')
    const sceneFog = new THREE.FogExp2('#bdb5bc', 0.018)
    scene.background = backgroundColor
    scene.fog = sceneFog
    const camera = new THREE.PerspectiveCamera(39, host.clientWidth / host.clientHeight, 0.1, 80)
    const defaultCamera = new THREE.Vector3(8.2, 6.25, 15.4)
    const defaultTarget = new THREE.Vector3(0, 2.65, -0.45)
    const deskCamera = new THREE.Vector3(3.8, 4.4, 8.5)
    const deskTarget = new THREE.Vector3(0.25, 1.65, 0.55)
    camera.position.copy(defaultCamera)
    camera.lookAt(defaultTarget)

    const random = seededRandom(1929)
    const room = new THREE.Group()
    scene.add(room)
    const animatedMaterials: AnimatedMaterial[] = []
    const interactiveMeshes: THREE.Object3D[] = []

    const registerMaterial = <T extends THREE.MeshStandardMaterial>(material: T, color: string) => {
      const finalColor = new THREE.Color(color)
      const hsl = finalColor.getHSL({ h: 0, s: 0, l: 0 })
      const paper = new THREE.Color().setHSL(hsl.h * 0.35, hsl.s * 0.17, Math.min(0.83, hsl.l * 1.13 + 0.04))
      material.color.copy(paper)
      animatedMaterials.push({ material, color: finalColor, paper })
      return material
    }
    const standard = (color: string, options: Partial<THREE.MeshStandardMaterialParameters> = {}, animate = true) => {
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...options })
      return animate ? registerMaterial(material, color) : material
    }
    const physical = (color: string, options: Partial<THREE.MeshPhysicalMaterialParameters> = {}, animate = true) => {
      const material = new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, ...options })
      return animate ? registerMaterial(material, color) : material
    }

    const wall = standard('#c4b5b5', { roughness: 0.95, transparent: true })
    const sideWall = standard('#b6b6a8', { roughness: 0.95, transparent: true })
    const moulding = standard('#d9cec3', { roughness: 0.75 })
    const darkWood = standard('#58454a', { roughness: 0.55 })
    const wood = standard('#8c6c61', { roughness: 0.52 })
    const lightWood = standard('#ad8d79', { roughness: 0.62 })
    const sage = standard('#7d8979', { roughness: 0.8 })
    const purple = standard('#756079', { roughness: 0.75 })
    const velvet = physical('#74637b', { roughness: 0.82, sheen: 0.85, sheenColor: new THREE.Color('#b8a5be'), sheenRoughness: 0.8 })
    const satin = physical('#b6a0c0', { roughness: 0.28, metalness: 0.03, sheen: 1, sheenColor: new THREE.Color('#eadcf0'), sheenRoughness: 0.32, clearcoat: 0.25 })
    const pearl = physical('#e2ddd4', { roughness: 0.16, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.13, iridescence: 0.32, iridescenceIOR: 1.3 })
    const metal = physical('#9b9285', { metalness: 0.88, roughness: 0.24, clearcoat: 0.5 })
    const darkMetal = physical('#57545a', { metalness: 0.92, roughness: 0.23 })
    const glass = physical('#c7d9ce', { transmission: 0.87, transparent: true, opacity: 0.78, thickness: 0.32, ior: 1.46, roughness: 0.12, clearcoat: 1 }, false)
    const acrylic = physical('#b8a9cb', { transmission: 0.68, transparent: true, opacity: 0.72, thickness: 0.5, roughness: 0.16, iridescence: 0.65 }, false)
    const ceramic = physical('#d9d2c3', { roughness: 0.2, clearcoat: 0.9, clearcoatRoughness: 0.15 })
    const paper = standard('#e5ddcf', { roughness: 0.92 })

    const addBox = (parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], material: THREE.Material, radius = 0) => {
      const geometry = radius > 0
        ? new RoundedBoxGeometry(size[0], size[1], size[2], 3, radius)
        : new THREE.BoxGeometry(...size)
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(...position)
      mesh.castShadow = true
      mesh.receiveShadow = true
      parent.add(mesh)
      return mesh
    }
    const addCylinder = (parent: THREE.Object3D, radii: [number, number], height: number, position: [number, number, number], material: THREE.Material, segments = 32) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radii[0], radii[1], height, segments), material)
      mesh.position.set(...position)
      mesh.castShadow = true
      mesh.receiveShadow = true
      parent.add(mesh)
      return mesh
    }
    const addSphere = (parent: THREE.Object3D, radius: number, position: [number, number, number], material: THREE.Material, scale?: [number, number, number]) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), material)
      mesh.position.set(...position)
      if (scale) mesh.scale.set(...scale)
      mesh.castShadow = true
      parent.add(mesh)
      return mesh
    }
    const registerInteractive = (group: THREE.Object3D, id: RoomObject) => {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.userData.roomObject = id
          interactiveMeshes.push(child)
        }
      })
    }

    // Architectural shell: a deliberate open section rather than an obstructing fourth wall.
    addBox(room, [12.4, 0.18, 8.2], [0, -0.1, -0.15], darkWood)
    for (let index = 0; index < 18; index += 1) {
      const plank = addBox(room, [0.68, 0.075, 7.95], [-5.8 + index * 0.685, 0.018, -0.15], index % 3 === 0 ? lightWood : wood, 0.012)
      plank.material = index % 4 === 0 ? lightWood : wood
    }
    // Four wall sections leave a real opening for the landscape instead of a painted window.
    addBox(room, [1.1, 6.5, 0.18], [-5.63, 3.2, -4.05], wall)
    addBox(room, [8.78, 6.5, 0.18], [1.79, 3.2, -4.05], wall)
    addBox(room, [2.56, 1.86, 0.18], [-3.85, 0.88, -4.05], wall)
    addBox(room, [2.56, 1.16, 0.18], [-3.85, 5.87, -4.05], wall)
    addBox(room, [0.18, 6.5, 8.1], [-6.08, 3.2, -0.1], sideWall)
    addBox(room, [12.3, 1.18, 0.12], [0, 0.65, -3.91], sage)
    addBox(room, [0.12, 1.18, 8], [-5.94, 0.65, -0.1], sage)
    for (const y of [0.14, 1.2, 6.2]) addBox(room, [12.32, 0.11, 0.22], [0, y, -3.85], moulding, 0.025)
    for (const y of [0.14, 1.2, 6.2]) addBox(room, [0.22, 0.11, 8], [-5.87, y, -0.1], moulding, 0.025)
    for (let x = -5.6; x <= 5.7; x += 1.4) addBox(room, [0.055, 0.85, 0.04], [x, 0.65, -3.82], moulding)
    for (let x = -5.3; x <= 5.4; x += 2.15) {
      addBox(room, [1.75, 0.035, 0.045], [x, 5.85, -3.88], moulding)
      addBox(room, [0.035, 1.08, 0.045], [x - 0.86, 5.32, -3.88], moulding)
      addBox(room, [0.035, 1.08, 0.045], [x + 0.86, 5.32, -3.88], moulding)
    }

    const rugMaterial = standard('#ffffff', { map: makeRugTexture(), roughness: 1 })
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 4.3), rugMaterial)
    rug.rotation.x = -Math.PI / 2
    rug.position.set(0.25, 0.072, 0.65)
    rug.receiveShadow = true
    room.add(rug)

    const hemisphere = new THREE.HemisphereLight('#e7e3d7', '#645765', 1.55)
    scene.add(hemisphere)
    const keyLight = new THREE.DirectionalLight('#f5e7d3', 2.15)
    keyLight.position.set(-2, 8, 7)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(2048, 2048)
    keyLight.shadow.camera.left = -9
    keyLight.shadow.camera.right = 9
    keyLight.shadow.camera.top = 9
    keyLight.shadow.camera.bottom = -9
    keyLight.shadow.bias = -0.00035
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight('#b5c5b1', 0.9)
    fillLight.position.set(-6, 4, -1)
    scene.add(fillLight)
    const windowLight = new THREE.SpotLight('#c5ddd6', 0, 18, Math.PI / 4.5, 0.75, 1.2)
    windowLight.position.set(-3.85, 4.1, -2.75)
    windowLight.target.position.set(-0.5, 0.2, 2)
    scene.add(windowLight, windowLight.target)

    // Window, real hinged casement and fabric.
    const windowGroup = new THREE.Group()
    windowGroup.position.set(-3.85, 3.55, -3.76)
    room.add(windowGroup)
    for (const x of [-1.22, 1.22]) addBox(windowGroup, [0.12, 3.55, 0.24], [x, 0, 0], darkWood, 0.025)
    for (const y of [-1.72, 1.72]) addBox(windowGroup, [2.48, 0.12, 0.24], [0, y, 0], darkWood, 0.025)
    addBox(windowGroup, [2.72, 0.14, 0.55], [0, -1.78, 0.12], lightWood, 0.025)
    // Keep the view clear: branches now come from the actual trees outside, not geometry across the glass.
    for (const x of [-1.16, 0, 1.16]) addBox(windowGroup, [0.085, 3.42, 0.15], [x, 0, 0.23], moulding)
    for (const y of [-1.66, 0, 1.66]) addBox(windowGroup, [2.4, 0.085, 0.15], [0, y, 0.23], moulding)
    const casement = new THREE.Group()
    casement.position.set(0.04, 0, 0.35)
    windowGroup.add(casement)
    addBox(casement, [1.09, 3.25, 0.065], [0.55, 0, 0], glass)
    for (const x of [0.025, 1.08]) addBox(casement, [0.055, 3.28, 0.11], [x, 0, 0.015], moulding)
    for (const y of [-1.61, 0, 1.61]) addBox(casement, [1.1, 0.055, 0.11], [0.55, y, 0.015], moulding)
    addSphere(casement, 0.055, [0.16, -0.12, 0.12], darkMetal)
    const curtainRod = addCylinder(windowGroup, [0.055, 0.055], 3.65, [0, 1.97, 0.5], darkMetal)
    curtainRod.rotation.z = Math.PI / 2
    addSphere(windowGroup, 0.12, [-1.94, 1.97, 0.5], metal)
    addSphere(windowGroup, 0.12, [1.94, 1.97, 0.5], metal)
    const makeCurtain = (side: number) => {
      const geometry = new THREE.PlaneGeometry(1.03, 3.85, 16, 24)
      const positions = geometry.attributes.position
      for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index)
        const y = positions.getY(index)
        const normalized = (y + 1.925) / 3.85
        positions.setZ(index, Math.sin((x + 0.5) * 22) * 0.075 + Math.sin(normalized * Math.PI) * 0.09)
        positions.setX(index, x * (0.65 + normalized * 0.35) + Math.sin(normalized * 5) * 0.055)
      }
      geometry.computeVertexNormals()
      const curtain = new THREE.Mesh(geometry, velvet)
      curtain.position.set(side * 1.4, -0.03, 0.56)
      curtain.rotation.z = side * -0.035
      curtain.castShadow = true
      windowGroup.add(curtain)
    }
    makeCurtain(-1)
    makeCurtain(1)
    const makeBow = (parent: THREE.Object3D, position: [number, number, number], scale = 1) => {
      const bow = new THREE.Group()
      for (const side of [-1, 1]) {
        const loop = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.065, 12, 40, Math.PI * 1.6), satin)
        loop.scale.set(1.35, 0.74, 0.55)
        loop.position.x = side * 0.2
        loop.rotation.z = side * 0.65
        bow.add(loop)
        const tail = addBox(bow, [0.13, 0.55, 0.035], [side * 0.12, -0.32, -0.03], satin, 0.025)
        tail.rotation.z = side * 0.23
      }
      addSphere(bow, 0.11, [0, 0, 0.04], satin, [1, 0.8, 0.6])
      bow.position.set(...position)
      bow.scale.setScalar(scale)
      parent.add(bow)
      return bow
    }
    makeBow(windowGroup, [1.4, -0.25, 0.72], 0.9)
    registerInteractive(windowGroup, 'window')

    // A real landscape surrounds the cutaway room and remains visible through the wall opening.
    const garden = new THREE.Group()
    scene.add(garden)
    const skyTexture = canvasTexture(32, 512, (context) => {
      const gradient = context.createLinearGradient(0, 0, 0, 512)
      gradient.addColorStop(0, '#aabcb9')
      gradient.addColorStop(0.48, '#d4d3c8')
      gradient.addColorStop(1, '#e4d5cd')
      context.fillStyle = gradient
      context.fillRect(0, 0, 32, 512)
    })
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(44, 32, 20),
      new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, fog: false }),
    )
    sky.position.y = 4
    scene.add(sky)
    const meadowMaterial = standard('#87947c', { roughness: 1 }, false)
    const meadow = new THREE.Mesh(new THREE.CircleGeometry(29, 96), meadowMaterial)
    meadow.rotation.x = -Math.PI / 2
    meadow.position.y = -0.23
    meadow.receiveShadow = true
    garden.add(meadow)

    const hillColors = ['#89978b', '#9ca794', '#74877d', '#b0ad9d']
    const hillData: Array<[number, number, number, number, number, number]> = [
      [-13, -2.4, -21, 13, 5.2, 8], [4, -2.8, -25, 16, 6.2, 9],
      [20, -2.5, -12, 12, 5.5, 9], [-23, -2.8, 2, 12, 5.8, 11],
      [4, -3.1, 24, 16, 5.8, 10],
    ]
    hillData.forEach((data, index) => {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), standard(hillColors[index % hillColors.length], { roughness: 1 }, false))
      hill.position.set(data[0], data[1], data[2])
      hill.scale.set(data[3], data[4], data[5])
      garden.add(hill)
    })

    const cloudMaterial = new THREE.MeshBasicMaterial({ color: '#e7e2da', transparent: true, opacity: 0.54, fog: false })
    const cloudPositions: Array<[number, number, number]> = [[-11, 10, -24], [8, 12, -27], [22, 9, 2], [-22, 11, 10]]
    for (const [cloudX, cloudY, cloudZ] of cloudPositions) {
      const cloud = new THREE.Group()
      for (let index = 0; index < 5; index += 1) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), cloudMaterial)
        puff.position.set((index - 2) * 1.25, Math.sin(index * 1.7) * 0.45, 0)
        puff.scale.set(1.8, 0.75 + (index % 2) * 0.35, 0.85)
        cloud.add(puff)
      }
      cloud.position.set(cloudX, cloudY, cloudZ)
      garden.add(cloud)
    }

    const treeCount = 28
    const treeTrunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.14, 1, 7), standard('#65594e', { roughness: 1 }, false), treeCount)
    const treeCrowns = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), standard('#657c68', { roughness: 1 }, false), treeCount)
    const landscapeDummy = new THREE.Object3D()
    for (let index = 0; index < treeCount; index += 1) {
      const angle = (index / treeCount) * Math.PI * 2 + random() * 0.2
      const radius = 13 + random() * 11
      const height = 1.7 + random() * 2.4
      let x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      if (x > -8 && x < 0 && z < -4) x += 8 // Preserve the long view from the window to the hills.
      landscapeDummy.position.set(x, height * 0.28, z)
      landscapeDummy.scale.set(1, height * 0.56, 1)
      landscapeDummy.updateMatrix()
      treeTrunks.setMatrixAt(index, landscapeDummy.matrix)
      landscapeDummy.position.set(x, height * 0.72, z)
      landscapeDummy.scale.set(0.65 + height * 0.17, height * 0.43, 0.65 + height * 0.17)
      landscapeDummy.updateMatrix()
      treeCrowns.setMatrixAt(index, landscapeDummy.matrix)
      treeCrowns.setColorAt(index, new THREE.Color(['#657c68', '#7b8b70', '#596f64'][index % 3]))
    }
    treeTrunks.instanceMatrix.needsUpdate = true
    treeCrowns.instanceMatrix.needsUpdate = true
    if (treeCrowns.instanceColor) treeCrowns.instanceColor.needsUpdate = true
    garden.add(treeTrunks, treeCrowns)

    const stoneMaterial = standard('#b9b2a3', { roughness: 0.94 }, false)
    for (let index = 0; index < 11; index += 1) {
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.45 + random() * 0.18, 0.5, 0.08, 9), stoneMaterial)
      stone.position.set(-3.85 + Math.sin(index * 0.8) * 0.48, -0.15, -4.8 - index * 0.86)
      stone.rotation.y = random() * Math.PI
      stone.scale.z = 0.7 + random() * 0.25
      stone.receiveShadow = true
      garden.add(stone)
    }

    type Flower = { x: number; y: number; z: number; height: number; size: number; phase: number; delay: number; color: THREE.Color }
    const flowers: Flower[] = []
    const petalColors = ['#d9c9dc', '#eee1d7', '#b49abf', '#c6cfb5', '#d4b4c1']
    while (flowers.length < 360) {
      const nearHouse = flowers.length < 270
      const x = nearHouse ? -10 + random() * 20 : -17 + random() * 34
      const z = nearHouse ? -9 + random() * 18 : -16 + random() * 30
      if (x > -6.7 && x < 6.7 && z > -4.7 && z < 4.7) continue
      flowers.push({ x, y: -0.16, z, height: 0.28 + random() * 0.6, size: 0.85 + random() * 0.65, phase: random() * Math.PI * 2, delay: random(), color: new THREE.Color(petalColors[flowers.length % petalColors.length]) })
    }
    // Flowers climb the actual window reveal and spill onto the sill when the casement opens.
    for (let index = 0; index < 64; index += 1) {
      const side = index % 2 === 0 ? -1 : 1
      const onSill = index < 24
      flowers.push({
        x: onSill ? -4.95 + (index / 23) * 2.2 : -3.85 + side * (1.13 + random() * 0.15),
        y: onSill ? 1.85 : 1.85 + random() * 3.25,
        z: -3.22 + random() * 0.18,
        height: onSill ? 0.28 + random() * 0.3 : 0.12 + random() * 0.2,
        size: onSill ? 0.8 + random() * 0.3 : 0.6 + random() * 0.3,
        phase: random() * Math.PI * 2,
        delay: random() * 0.55,
        color: new THREE.Color(petalColors[index % petalColors.length]),
      })
    }
    const petalGeometry = new THREE.SphereGeometry(1, 8, 5)
    const flowerStem = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5), standard('#567055', { roughness: 0.9 }, false), flowers.length)
    const flowerPetals = new THREE.InstancedMesh(petalGeometry, standard('#ffffff', { roughness: 0.72 }, false), flowers.length * 5)
    const flowerCenters = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 5), standard('#c6aa72', { roughness: 0.65 }, false), flowers.length)
    const flowerLeaves = new THREE.InstancedMesh(petalGeometry, standard('#607b5c', { roughness: 0.9 }, false), flowers.length * 2)
    for (const mesh of [flowerStem, flowerPetals, flowerCenters, flowerLeaves]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      scene.add(mesh)
    }
    flowers.forEach((flower, flowerIndex) => {
      for (let petal = 0; petal < 5; petal += 1) flowerPetals.setColorAt(flowerIndex * 5 + petal, flower.color)
    })
    if (flowerPetals.instanceColor) flowerPetals.instanceColor.needsUpdate = true
    const flowerDummy = new THREE.Object3D()
    const updateFlowers = (time: number, bloom: number) => {
      const visible = bloom > 0.002
      flowerStem.visible = flowerPetals.visible = flowerCenters.visible = flowerLeaves.visible = visible
      if (!visible) return
      flowers.forEach((flower, flowerIndex) => {
        const progress = THREE.MathUtils.clamp(bloom * 1.35 - flower.delay * 0.35, 0, 1)
        const growth = 1 - Math.pow(1 - progress, 3)
        const sway = Math.sin(time * 0.8 + flower.phase) * 0.055 * growth
        const top = flower.y + flower.height * growth
        flowerDummy.position.set(flower.x + sway * 0.35, flower.y + flower.height * growth * 0.5, flower.z)
        flowerDummy.rotation.set(0, 0, -sway)
        flowerDummy.scale.set(0.016 * growth, Math.max(0.001, flower.height * growth), 0.016 * growth)
        flowerDummy.updateMatrix()
        flowerStem.setMatrixAt(flowerIndex, flowerDummy.matrix)
        for (let leaf = 0; leaf < 2; leaf += 1) {
          const angle = flower.phase + leaf * Math.PI
          flowerDummy.position.set(flower.x + Math.cos(angle) * 0.05 * growth, flower.y + flower.height * growth * (0.35 + leaf * 0.25), flower.z + Math.sin(angle) * 0.05 * growth)
          flowerDummy.rotation.set(0, -angle, leaf === 0 ? 0.55 : -0.55)
          flowerDummy.scale.set(0.1 * flower.size * growth, 0.025 * growth, 0.05 * flower.size * growth)
          flowerDummy.updateMatrix()
          flowerLeaves.setMatrixAt(flowerIndex * 2 + leaf, flowerDummy.matrix)
        }
        for (let petal = 0; petal < 5; petal += 1) {
          const angle = (petal / 5) * Math.PI * 2 + flower.phase
          const radius = 0.085 * flower.size * growth
          flowerDummy.position.set(flower.x + sway + Math.cos(angle) * radius, top + Math.sin(angle * 2) * 0.018, flower.z + Math.sin(angle) * radius)
          flowerDummy.rotation.set(0, -angle, 0.22)
          flowerDummy.scale.set(0.105 * flower.size * growth, 0.045 * flower.size * growth, 0.075 * flower.size * growth)
          flowerDummy.updateMatrix()
          flowerPetals.setMatrixAt(flowerIndex * 5 + petal, flowerDummy.matrix)
        }
        flowerDummy.position.set(flower.x + sway, top + 0.025, flower.z)
        flowerDummy.rotation.set(0, 0, 0)
        flowerDummy.scale.setScalar(0.065 * flower.size * growth)
        flowerDummy.updateMatrix()
        flowerCenters.setMatrixAt(flowerIndex, flowerDummy.matrix)
      })
      flowerStem.instanceMatrix.needsUpdate = true
      flowerPetals.instanceMatrix.needsUpdate = true
      flowerCenters.instanceMatrix.needsUpdate = true
      flowerLeaves.instanceMatrix.needsUpdate = true
    }
    updateFlowers(0, 0)

    const asciiGroup = new THREE.Group()
    room.add(asciiGroup)
    const asciiSprites: Array<{ sprite: THREE.Sprite; baseX: number; baseY: number; speed: number }> = []
    const asciiTextures = ['0', '1', '{', '}'].map(makeAsciiTexture)
    for (let index = 0; index < 22; index += 1) {
      const material = new THREE.SpriteMaterial({ map: asciiTextures[index % 4], transparent: true, opacity: 0.68, depthWrite: false })
      const sprite = new THREE.Sprite(material)
      const baseX = -4.85 + random() * 2
      const baseY = random() * 3.2 + 1.95
      sprite.position.set(baseX, baseY, -3.25 + random() * 0.4)
      sprite.scale.set(0.13, 0.13, 0.13)
      asciiGroup.add(sprite)
      asciiSprites.push({ sprite, baseX, baseY, speed: 0.25 + random() * 0.45 })
    }
    asciiGroup.visible = false

    // Framed collage and a small relief plate.
    const textureLoader = new THREE.TextureLoader()
    const texturePromises = texturePaths.map((path) => textureLoader.loadAsync(path).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
      return texture
    }))
    let textures: THREE.Texture[] = []
    const frame = new THREE.Group()
    frame.position.set(-0.55, 4.12, -3.77)
    room.add(frame)
    addBox(frame, [1.58, 2.05, 0.13], [0, 0, 0], darkWood)
    addBox(frame, [1.38, 1.85, 0.09], [0, 0, 0.09], moulding)
    const artMaterial = standard('#ffffff', { roughness: 0.86 }, false)
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 1.62), artMaterial)
    art.position.z = 0.15
    frame.add(art)
    for (const x of [-0.83, 0.83]) addBox(frame, [0.035, 2.14, 0.07], [x, 0, 0.03], metal)
    for (const y of [-1.07, 1.07]) addBox(frame, [1.7, 0.035, 0.07], [0, y, 0.03], metal)
    const plateMaterial = physical('#ffffff', { transparent: true, roughness: 0.25, clearcoat: 0.75 }, false)
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), plateMaterial)
    plate.position.set(1.3, 0.4, 0.14)
    frame.add(plate)

    // Bookcase with seeded book sizes and a readable Woolf volume.
    const bookcase = new THREE.Group()
    bookcase.position.set(2.42, 2.52, -3.42)
    room.add(bookcase)
    addBox(bookcase, [2.5, 5.0, 0.58], [0, 0, 0], darkWood, 0.035)
    addBox(bookcase, [2.21, 4.65, 0.13], [0, 0, 0.36], lightWood)
    for (const x of [-1.18, 1.18]) addBox(bookcase, [0.14, 4.92, 0.72], [x, 0, 0.34], wood, 0.025)
    for (const y of [-2.36, -1.48, -0.58, 0.32, 1.22, 2.36]) addBox(bookcase, [2.48, 0.13, 0.77], [0, y, 0.35], wood, 0.025)
    addBox(bookcase, [2.7, 0.18, 0.82], [0, 2.48, 0.34], lightWood, 0.04)
    addBox(bookcase, [2.7, 0.18, 0.82], [0, -2.48, 0.34], lightWood, 0.04)
    const bookColors = ['#6d7566', '#725c73', '#987768', '#4e6261', '#a28b72', '#574852']
    const bookMaterials = bookColors.map((color) => standard(color, { roughness: 0.78 }))
    for (let shelf = 0; shelf < 5; shelf += 1) {
      let x = -1.02
      let bookIndex = 0
      while (x < 0.92) {
        const width = 0.09 + random() * 0.09
        const height = 0.48 + random() * 0.23
        const book = addBox(bookcase, [width, height, 0.38 + random() * 0.08], [x + width / 2, -2.27 + shelf * 0.9 + height / 2, 0.72], bookMaterials[(shelf * 7 + bookIndex) % bookMaterials.length], 0.008)
        book.rotation.z = bookIndex % 7 === 0 ? -0.055 : 0
        x += width + 0.025
        bookIndex += 1
      }
    }
    const woolfBookMaterial = standard('#ffffff', { map: makeBookTexture(), roughness: 0.78 }, false)
    const woolfBook = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.68), woolfBookMaterial)
    woolfBook.position.set(0.65, -1.8, 0.98)
    woolfBook.rotation.z = 0.04
    bookcase.add(woolfBook)
    registerInteractive(bookcase, 'bookcase')

    // Material cabinet: two functional doors, translucent objects and pearls.
    const wardrobe = new THREE.Group()
    wardrobe.position.set(4.83, 2.36, -3.2)
    room.add(wardrobe)
    addBox(wardrobe, [1.82, 4.68, 0.86], [0, 0, 0], darkWood, 0.04)
    addBox(wardrobe, [1.54, 4.35, 0.1], [0, 0, 0.48], sage)
    for (const y of [-1.35, -0.15, 1.05]) addBox(wardrobe, [1.52, 0.09, 0.75], [0, y, 0.48], lightWood)
    const leftDoor = new THREE.Group()
    const rightDoor = new THREE.Group()
    leftDoor.position.set(-0.9, 0, 0.94)
    rightDoor.position.set(0.9, 0, 0.94)
    wardrobe.add(leftDoor, rightDoor)
    const makeDoor = (door: THREE.Group, side: number) => {
      const center = side * -0.43
      addBox(door, [0.86, 4.45, 0.11], [center, 0, 0], sage, 0.035)
      addBox(door, [0.59, 3.98, 0.04], [center, 0, 0.075], purple, 0.02)
      addBox(door, [0.45, 3.8, 0.035], [center, 0, 0.1], sage, 0.02)
      addSphere(door, 0.065, [side * -0.75, -0.05, 0.16], metal)
    }
    makeDoor(leftDoor, -1)
    makeDoor(rightDoor, 1)
    addBox(wardrobe, [2.02, 0.16, 1.0], [0, 2.34, 0.08], lightWood, 0.045)
    addBox(wardrobe, [2.02, 0.16, 1.0], [0, -2.34, 0.08], lightWood, 0.045)
    const vaseProfile = [
      new THREE.Vector2(0.0, 0), new THREE.Vector2(0.28, 0.02), new THREE.Vector2(0.35, 0.35),
      new THREE.Vector2(0.19, 0.75), new THREE.Vector2(0.13, 1.02), new THREE.Vector2(0.22, 1.08),
    ]
    const vase = new THREE.Mesh(new THREE.LatheGeometry(vaseProfile, 32), glass)
    vase.position.set(-0.32, -1.29, 0.61)
    vase.scale.setScalar(0.72)
    wardrobe.add(vase)
    for (let index = 0; index < 12; index += 1) {
      const angle = index * 0.58
      addSphere(wardrobe, 0.075, [Math.sin(angle) * 0.34, 0.18 + index * 0.065, 0.68 + Math.cos(angle) * 0.06], pearl)
    }
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), acrylic)
    star.position.set(0.22, 1.53, 0.67)
    star.scale.set(0.7, 1.25, 0.35)
    wardrobe.add(star)
    makeBow(wardrobe, [0, -0.72, 0.8], 1.15)
    registerInteractive(wardrobe, 'wardrobe')

    // Desk, drawers, curved legs and objects on the writing surface.
    const desk = new THREE.Group()
    desk.position.set(0.15, 0, 0.75)
    room.add(desk)
    addBox(desk, [4.75, 0.22, 1.85], [0, 1.72, 0], wood, 0.07)
    addBox(desk, [4.5, 0.5, 1.52], [0, 1.41, -0.02], darkWood, 0.035)
    for (const x of [-1.45, 0, 1.45]) {
      addBox(desk, [1.32, 0.38, 0.08], [x, 1.43, 0.79], lightWood, 0.025)
      addSphere(desk, 0.065, [x, 1.43, 0.9], metal)
    }
    const legProfile = [
      new THREE.Vector2(0.11, 0), new THREE.Vector2(0.16, 0.12), new THREE.Vector2(0.1, 0.5),
      new THREE.Vector2(0.17, 0.92), new THREE.Vector2(0.14, 1.25), new THREE.Vector2(0.18, 1.32),
    ]
    for (const x of [-2.05, 2.05]) {
      for (const z of [-0.64, 0.64]) {
        const leg = new THREE.Mesh(new THREE.LatheGeometry(legProfile, 16), darkWood)
        leg.position.set(x, 0.06, z)
        leg.castShadow = true
        desk.add(leg)
      }
    }
    addBox(desk, [1.9, 0.08, 1.12], [0.25, 1.88, 0.03], purple, 0.025).rotation.y = -0.08
    addBox(desk, [1.8, 0.07, 1.03], [0.25, 1.94, 0.03], paper, 0.015).rotation.y = -0.08
    const diaryLineMaterial = standard('#8f8390', { roughness: 1 })
    for (let index = 0; index < 5; index += 1) {
      const line = addBox(desk, [0.56, 0.006, 0.008], [-0.17, 1.982, -0.25 + index * 0.12], diaryLineMaterial)
      line.rotation.y = -0.08
    }
    const pen = addCylinder(desk, [0.035, 0.035], 1.05, [1.25, 1.94, 0.17], glass, 16)
    pen.rotation.z = Math.PI / 2
    pen.rotation.y = 0.23
    const nib = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 16), metal)
    nib.position.set(1.79, 1.94, 0.29)
    nib.rotation.z = -Math.PI / 2
    desk.add(nib)

    const lamp = new THREE.Group()
    lamp.position.set(-1.45, 1.85, -0.05)
    desk.add(lamp)
    addCylinder(lamp, [0.36, 0.43], 0.09, [0, 0.045, 0], metal)
    addCylinder(lamp, [0.07, 0.11], 1.18, [0, 0.66, 0], metal)
    addSphere(lamp, 0.15, [0, 1.13, 0], metal)
    const shadeMaterial = physical('#d9cbb2', { roughness: 0.7, side: THREE.DoubleSide, emissive: '#f1d8a4', emissiveIntensity: 0 })
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.69, 0.7, 40, 1, true), shadeMaterial)
    shade.position.set(0, 1.42, 0)
    shade.castShadow = true
    lamp.add(shade)
    addCylinder(lamp, [0.68, 0.68], 0.035, [0, 1.075, 0], moulding)
    const lampLight = new THREE.PointLight('#ffd9a0', 0, 8, 1.6)
    lampLight.position.set(0, 1.15, 0)
    // The directional key owns contact shadows; avoiding a six-face point shadow keeps orbiting responsive.
    lampLight.castShadow = false
    lamp.add(lampLight)
    for (let index = 0; index < 9; index += 1) addSphere(lamp, 0.042, [0.61, 1.07 - index * 0.09, 0.02], pearl)
    const pull = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), metal)
    pull.position.set(0.61, 0.24, 0.02)
    lamp.add(pull)
    registerInteractive(desk, 'desk')
    // Register the lamp last so its smaller hit area is not overwritten by the desk group.
    registerInteractive(lamp, 'lamp')

    const interactiveGroups = { window: windowGroup, lamp, bookcase, wardrobe, desk } satisfies Record<RoomObject, THREE.Group>
    const hoverStrength: Record<RoomObject, number> = { window: 0, lamp: 0, bookcase: 0, wardrobe: 0, desk: 0 }
    const hoverLights = new Map<RoomObject, THREE.PointLight>()
    const addHoverLight = (
      id: RoomObject,
      parent: THREE.Group,
      position: [number, number, number],
      color: string,
      distance: number,
      intensity: number,
    ) => {
      const light = new THREE.PointLight(color, 0, distance, 2)
      light.position.set(...position)
      light.castShadow = false
      light.userData.hoverIntensity = intensity
      parent.add(light)
      hoverLights.set(id, light)
    }
    // Local light rather than emissive materials keeps the rest of the room unchanged.
    addHoverLight('window', windowGroup, [0, 0.15, 1.1], '#d9eee9', 4, 5)
    addHoverLight('lamp', lamp, [0, 1.35, 0.2], '#f4dab0', 3.2, 4)
    addHoverLight('bookcase', bookcase, [0, 0.2, 1.25], '#f0d6b4', 4, 5)
    addHoverLight('wardrobe', wardrobe, [0, 0.25, 1.45], '#ddccea', 3.6, 4.5)
    addHoverLight('desk', desk, [0.2, 2.25, 0.8], '#f0d6b4', 3.8, 4.5)

    const cup = new THREE.Group()
    cup.position.set(1.85, 1.86, -0.42)
    desk.add(cup)
    addCylinder(cup, [0.32, 0.36], 0.045, [0, 0.02, 0], ceramic)
    const cupProfile = [new THREE.Vector2(0.13, 0), new THREE.Vector2(0.2, 0.08), new THREE.Vector2(0.23, 0.37), new THREE.Vector2(0.2, 0.4)]
    const cupMesh = new THREE.Mesh(new THREE.LatheGeometry(cupProfile, 32), ceramic)
    cupMesh.position.y = 0.05
    cup.add(cupMesh)
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.035, 10, 24, Math.PI * 1.6), ceramic)
    handle.position.set(0.21, 0.26, 0)
    handle.rotation.y = Math.PI / 2
    cup.add(handle)

    // Chair with upholstered back, placed off the diary sightline.
    const chair = new THREE.Group()
    chair.position.set(1.15, 0, 2.65)
    chair.rotation.y = -0.16
    room.add(chair)
    addBox(chair, [1.45, 0.18, 1.25], [0, 1.0, 0], darkWood, 0.055)
    addBox(chair, [1.32, 0.18, 1.13], [0, 1.13, 0], velvet, 0.09)
    addBox(chair, [1.42, 1.3, 0.17], [0, 1.92, 0.5], velvet, 0.16)
    for (const x of [-0.61, 0.61]) {
      for (const z of [-0.46, 0.46]) addCylinder(chair, [0.065, 0.09], 1.02, [x, 0.5, z], darkWood, 12)
      addCylinder(chair, [0.055, 0.055], 1.5, [x, 1.77, 0.5], darkWood, 12)
    }

    // Contemporary translucent specimens sit quietly in the historic room.
    const specimenMaterial = physical('#ffffff', { transparent: true, roughness: 0.22, transmission: 0.08 }, false)
    const specimen = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.68), specimenMaterial)
    specimen.position.set(-5.72, 2.1, 0.1)
    specimen.rotation.y = Math.PI / 2
    room.add(specimen)
    const specimenFrame = new THREE.Group()
    specimenFrame.position.copy(specimen.position)
    specimenFrame.rotation.copy(specimen.rotation)
    room.add(specimenFrame)
    for (const x of [-0.39, 0.39]) addBox(specimenFrame, [0.035, 0.82, 0.045], [x, 0, 0.02], acrylic)
    for (const y of [-0.39, 0.39]) addBox(specimenFrame, [0.82, 0.035, 0.045], [0, y, 0.02], acrylic)

    const dustGeometry = new THREE.BufferGeometry()
    const dustPositions = new Float32Array(90 * 3)
    const dustSeeds = new Float32Array(90 * 3)
    for (let index = 0; index < 90; index += 1) {
      dustSeeds[index * 3] = -5.4 + random() * 10.8
      dustSeeds[index * 3 + 1] = 0.3 + random() * 5.5
      dustSeeds[index * 3 + 2] = -3.4 + random() * 6.4
    }
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3))
    const dustMaterial = new THREE.PointsMaterial({ color: '#eee5d2', size: 0.025, transparent: true, opacity: 0.42, depthWrite: false })
    const dust = new THREE.Points(dustGeometry, dustMaterial)
    room.add(dust)

    const orbit = { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0, zoom: 1, targetZoom: 1 }
    const pointer = new THREE.Vector2()
    const raycaster = new THREE.Raycaster()
    let drag: { x: number; y: number; yaw: number; pitch: number; moved: boolean; pointerId: number } | null = null
    let currentState: SceneState = {
      materialized: propsRef.current.materialized,
      lightOn: propsRef.current.lightOn,
      woolf: propsRef.current.woolf,
      windowOpen: propsRef.current.windowOpen,
      wardrobeOpen: propsRef.current.wardrobeOpen,
      journalOpen: propsRef.current.journalOpen,
    }
    let sceneTime = 0
    let flowerBloom = 0
    let demoFocus: RoomObject | null = null
    let orbitStart: number | null = null
    let orbitStartYaw = 0
    let lastFrame = performance.now()
    let animationFrame = 0
    let manualTime: number | null = capture ? Number(new URLSearchParams(window.location.search).get('t') || 0) : null
    let ready = false
    let hoveredObject: RoomObject | null = null
    const cameraGoal = new THREE.Vector3()
    const targetGoal = new THREE.Vector3()
    const lookTarget = new THREE.Vector3()

    const render = (time: number, delta = 1 / 60, immediate = false) => {
      sceneTime = time
      const next = propsRef.current
      currentState = {
        materialized: next.materialized,
        lightOn: next.lightOn,
        woolf: next.woolf,
        windowOpen: next.windowOpen,
        wardrobeOpen: next.wardrobeOpen,
        journalOpen: next.journalOpen,
      }
      const blend = immediate || reducedMotion ? 1 : 1 - Math.exp(-delta * 5.2)
      const hoverBlend = immediate || reducedMotion ? 1 : 1 - Math.exp(-delta * 10)
      for (const id of Object.keys(interactiveGroups) as RoomObject[]) {
        hoverStrength[id] = THREE.MathUtils.lerp(hoverStrength[id], hoveredObject === id ? 1 : 0, hoverBlend)
        const breath = reducedMotion ? 0 : Math.sin(time * 1.65) * 0.003
        interactiveGroups[id].scale.setScalar(1 + hoverStrength[id] * (0.012 + breath))
        const light = hoverLights.get(id)
        if (light) light.intensity = hoverStrength[id] * Number(light.userData.hoverIntensity)
      }
      const materialization = currentState.materialized ? 1 : 0
      for (const entry of animatedMaterials) entry.material.color.lerp(materialization ? entry.color : entry.paper, blend)
      backgroundColor.lerp(new THREE.Color(currentState.woolf ? '#bcc5b8' : currentState.materialized ? '#c7bdc4' : '#c9c1c6'), blend)
      sceneFog.color.copy(backgroundColor)
      hemisphere.intensity = THREE.MathUtils.lerp(hemisphere.intensity, currentState.materialized ? 1.25 : 1.7, blend)
      keyLight.intensity = THREE.MathUtils.lerp(keyLight.intensity, currentState.lightOn ? 1.45 : 2.15, blend)
      lampLight.intensity = THREE.MathUtils.lerp(lampLight.intensity, currentState.lightOn ? 26 : 0, blend)
      shadeMaterial.emissiveIntensity = THREE.MathUtils.lerp(shadeMaterial.emissiveIntensity, currentState.lightOn ? 0.7 : 0, blend)
      windowLight.intensity = THREE.MathUtils.lerp(windowLight.intensity, currentState.windowOpen ? 20 : currentState.lightOn ? 5 : 0, blend)
      casement.rotation.y = THREE.MathUtils.lerp(casement.rotation.y, currentState.windowOpen ? -1.18 : 0, blend)
      flowerBloom = THREE.MathUtils.lerp(flowerBloom, currentState.windowOpen ? 1 : 0, immediate || reducedMotion ? 1 : 1 - Math.exp(-delta * (currentState.windowOpen ? 0.85 : 3)))
      updateFlowers(time, flowerBloom)
      const wardrobePeek = currentState.wardrobeOpen ? 0 : hoverStrength.wardrobe * 0.035
      leftDoor.rotation.y = THREE.MathUtils.lerp(leftDoor.rotation.y, currentState.wardrobeOpen ? -1.45 : -wardrobePeek, blend)
      rightDoor.rotation.y = THREE.MathUtils.lerp(rightDoor.rotation.y, currentState.wardrobeOpen ? 1.45 : wardrobePeek, blend)
      woolfBook.position.z = THREE.MathUtils.lerp(woolfBook.position.z, (currentState.woolf ? 1.22 : 0.98) + hoverStrength.bookcase * 0.08, blend)
      velvet.color.lerp(new THREE.Color(currentState.woolf ? '#71806e' : '#74637b'), blend)
      rugMaterial.opacity = THREE.MathUtils.lerp(rugMaterial.opacity, currentState.woolf ? 0.92 : 0.55, blend)
      rugMaterial.transparent = true
      asciiGroup.visible = currentState.windowOpen
      if (asciiGroup.visible) {
        for (const item of asciiSprites) {
          const phase = (item.baseY + time * item.speed) % 3.2
          item.sprite.position.y = 1.95 + phase
          item.sprite.position.x = item.baseX + Math.sin(time * 0.55 + item.baseY) * 0.04
        }
      }
      star.rotation.y = time * 0.28
      star.rotation.z = Math.sin(time * 0.35) * 0.12
      for (let index = 0; index < 90; index += 1) {
        dustPositions[index * 3] = dustSeeds[index * 3] + Math.sin(time * 0.25 + index) * 0.08
        dustPositions[index * 3 + 1] = 0.3 + ((dustSeeds[index * 3 + 1] + time * 0.035) % 5.5)
        dustPositions[index * 3 + 2] = dustSeeds[index * 3 + 2]
      }
      dustGeometry.attributes.position.needsUpdate = true
      dust.visible = currentState.materialized

      const showingOrbit = orbitStart !== null
      let overhead = 0
      if (orbitStart !== null) {
        const progress = THREE.MathUtils.clamp((time - orbitStart - 0.65) / 9.4, 0, 1)
        const eased = THREE.MathUtils.smootherstep(progress, 0, 1)
        overhead = Math.sin(eased * Math.PI) ** 2
        orbit.yaw = orbitStartYaw + eased * Math.PI * 2
        orbit.targetPitch = THREE.MathUtils.lerp(0.06, 0.55, overhead)
        orbit.targetZoom = THREE.MathUtils.lerp(1.10, 1.16, overhead)
        if (progress === 1) {
          orbit.yaw = orbit.targetYaw = orbitStartYaw
          orbitStart = null
        }
      } else {
        orbit.yaw = THREE.MathUtils.lerp(orbit.yaw, orbit.targetYaw, blend)
      }
      orbit.pitch = THREE.MathUtils.lerp(orbit.pitch, orbit.targetPitch, blend)
      orbit.zoom = THREE.MathUtils.lerp(orbit.zoom, orbit.targetZoom, blend)
      cameraGoal.copy(currentState.journalOpen ? deskCamera : defaultCamera)
      targetGoal.copy(currentState.journalOpen ? deskTarget : defaultTarget)
      if (demoFocus && !currentState.journalOpen) {
        interactiveGroups[demoFocus].getWorldPosition(targetGoal)
        targetGoal.y += demoFocus === 'window' ? -0.35 : demoFocus === 'desk' ? 1.6 : 0.9
        cameraGoal.copy(targetGoal).add(demoFocus === 'desk' ? new THREE.Vector3(2.7, 3.1, 5.9) : new THREE.Vector3(4.0, 2.8, 8.0))
      }
      if (showingOrbit) targetGoal.y -= overhead * 0.45
      const offset = cameraGoal.clone().sub(targetGoal)
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), orbit.yaw)
      offset.y += orbit.pitch * 10
      offset.multiplyScalar(orbit.zoom)
      cameraGoal.copy(targetGoal).add(offset)
      camera.position.lerp(cameraGoal, blend)
      // Dollhouse cutaway: a wall between the camera and furniture fades instead of blocking the 360° view.
      wall.opacity = THREE.MathUtils.lerp(wall.opacity, THREE.MathUtils.lerp(0.04, 1, THREE.MathUtils.smoothstep(camera.position.z, -4.5, 1.1)), blend)
      sideWall.opacity = THREE.MathUtils.lerp(sideWall.opacity, THREE.MathUtils.lerp(0.04, 1, THREE.MathUtils.smoothstep(camera.position.x, -6.4, -1.2)), blend)
      wall.depthWrite = wall.opacity > 0.55
      sideWall.depthWrite = sideWall.opacity > 0.55
      lookTarget.lerp(targetGoal, blend)
      camera.lookAt(lookTarget)
      renderer.render(scene, camera)
      window.__SCENE_STATS__ = {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      }
    }

    const animate = (now: number) => {
      if (disposed) return
      const delta = Math.min(0.05, (now - lastFrame) / 1000)
      lastFrame = now
      // Let the journal own the compositor while it opens; the frozen room remains beneath its backdrop.
      if (manualTime === null && !currentState.journalOpen) render((now / 1000) % DURATION, delta)
      animationFrame = requestAnimationFrame(animate)
    }

    const setHoveredObject = (object: RoomObject | null) => {
      if (hoveredObject === object) return
      hoveredObject = object
      if (object) renderer.domElement.dataset.hovering = object
      else delete renderer.domElement.dataset.hovering
      // Reduced-motion and capture modes render on demand instead of running a continuous loop.
      if (reducedMotion || capture) stateRenderRef.current?.()
    }
    const hitTest = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(interactiveMeshes, false)[0]
      return (hit?.object.userData.roomObject as RoomObject | undefined) ?? null
    }
    const pointerDown = (event: PointerEvent) => {
      demoFocus = null
      orbitStart = null
      if (event.button !== 0) return
      drag = { x: event.clientX, y: event.clientY, yaw: orbit.targetYaw, pitch: orbit.targetPitch, moved: false, pointerId: event.pointerId }
      renderer.domElement.setPointerCapture(event.pointerId)
      setHoveredObject(null)
      renderer.domElement.style.cursor = 'grabbing'
    }
    const pointerMove = (event: PointerEvent) => {
      if (drag) {
        const dx = event.clientX - drag.x
        const dy = event.clientY - drag.y
        if (Math.hypot(dx, dy) > 6) drag.moved = true
        setHoveredObject(null)
        orbit.targetYaw = drag.yaw - dx * 0.0062
        orbit.targetPitch = THREE.MathUtils.clamp(drag.pitch + dy * 0.0011, -0.16, 0.14)
        return
      }
      const object = hitTest(event)
      setHoveredObject(object)
      renderer.domElement.style.cursor = object ? 'pointer' : 'grab'
    }
    const pointerUp = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return
      const wasMoved = drag.moved
      drag = null
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId)
      const object = wasMoved ? null : hitTest(event)
      setHoveredObject(object)
      renderer.domElement.style.cursor = object ? 'pointer' : 'grab'
      if (object) propsRef.current.onActivate(object)
    }
    const pointerCancel = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return
      drag = null
      setHoveredObject(null)
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId)
      renderer.domElement.style.cursor = 'grab'
    }
    const pointerLeave = () => {
      if (drag) return
      setHoveredObject(null)
      renderer.domElement.style.cursor = 'grab'
    }
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      orbit.targetZoom = THREE.MathUtils.clamp(orbit.targetZoom + event.deltaY * 0.00045, 0.78, 1.18)
    }
    const demoObject = (event: Event) => {
      const { object, phase, move } = (event as CustomEvent<{
        object: RoomObject
        phase: 'prepare-orbit' | 'orbit' | 'focus' | 'wide' | 'point' | 'activate'
        move?: (x: number, y: number) => void
      }>).detail
      if (phase === 'prepare-orbit' || phase === 'orbit') {
        demoFocus = null
        setHoveredObject(null)
        orbit.targetPitch = 0.06
        orbit.targetZoom = 1.10
        if (phase === 'orbit') {
          orbitStart = sceneTime
          orbitStartYaw = orbit.yaw
        }
        return
      }
      if (phase === 'focus' || phase === 'wide') {
        orbitStart = null
        demoFocus = phase === 'wide' ? null : object
        if (phase === 'wide') {
          orbit.targetYaw = -0.28
          orbit.targetPitch = 0.12
          orbit.targetZoom = 1.17
        } else {
          orbit.targetYaw = 0
          orbit.targetPitch = 0
          orbit.targetZoom = 0.89
        }
        setHoveredObject(object)
        return
      }
      if (phase === 'activate') {
        propsRef.current.onActivate(object)
        return
      }
      const position = interactiveGroups[object].getWorldPosition(new THREE.Vector3())
      position.y += object === 'desk' ? 1.7 : object === 'window' ? 0 : 0.6
      position.project(camera)
      const bounds = renderer.domElement.getBoundingClientRect()
      move?.(bounds.left + (position.x + 1) * bounds.width / 2, bounds.top + (1 - position.y) * bounds.height / 2)
    }
    if (portfolioDemo) renderer.domElement.addEventListener('motif-demo-object', demoObject)
    renderer.domElement.addEventListener('pointerdown', pointerDown)
    renderer.domElement.addEventListener('pointermove', pointerMove)
    renderer.domElement.addEventListener('pointerup', pointerUp)
    renderer.domElement.addEventListener('pointercancel', pointerCancel)
    renderer.domElement.addEventListener('pointerleave', pointerLeave)
    renderer.domElement.addEventListener('wheel', wheel, { passive: false })
    renderer.domElement.style.cursor = 'grab'

    const resize = () => {
      if (disposed) return
      const width = host.clientWidth
      const height = host.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      render(sceneTime, 1, capture || reducedMotion)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    const seek = (time: number) => {
      manualTime = THREE.MathUtils.clamp(time, 0, DURATION)
      render(manualTime, 1, true)
    }
    window.__seek = seek
    window.__capture = (time: number) => {
      seek(time)
      return renderer.domElement.toDataURL('image/png')
    }
    window.__restore = () => {
      manualTime = null
      lastFrame = performance.now()
    }
    stateRenderRef.current = () => render(manualTime ?? sceneTime, 1, capture || reducedMotion)

    Promise.all(texturePromises).then((loaded) => {
      if (disposed) return
      textures = loaded
      artMaterial.map = textures[0]
      artMaterial.needsUpdate = true
      plateMaterial.map = textures[1]
      plateMaterial.needsUpdate = true
      specimenMaterial.map = textures[3]
      specimenMaterial.needsUpdate = true
      ready = true
      render(manualTime ?? 0, 1, capture || reducedMotion)
      window.__SCENE_READY__ = true
    }).catch((loadError: unknown) => {
      console.error('Room texture loading failed', loadError)
      window.__SCENE_ERROR__ = loadError instanceof Error ? loadError.message : String(loadError)
      window.__SCENE_READY__ = true
      setError(t("部分房间纹理未能载入，物件交互仍可使用。"))
    })

    setShadow(room)
    render(manualTime ?? 0, 1, true)
    if (!capture && !reducedMotion) animationFrame = requestAnimationFrame(animate)
    else window.__SCENE_READY__ = ready

    return () => {
      disposed = true
      stateRenderRef.current = null
      cancelAnimationFrame(animationFrame)
      observer.disconnect()
      renderer.domElement.removeEventListener('motif-demo-object', demoObject)
      renderer.domElement.removeEventListener('pointerdown', pointerDown)
      renderer.domElement.removeEventListener('pointermove', pointerMove)
      renderer.domElement.removeEventListener('pointerup', pointerUp)
      renderer.domElement.removeEventListener('pointercancel', pointerCancel)
      renderer.domElement.removeEventListener('pointerleave', pointerLeave)
      renderer.domElement.removeEventListener('wheel', wheel)
      const geometries = new Set<THREE.BufferGeometry>()
      const materials = new Set<THREE.Material>()
      const maps = new Set<THREE.Texture>()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Sprite) {
          if ('geometry' in object && object.geometry) geometries.add(object.geometry)
          const objectMaterials = Array.isArray(object.material) ? object.material : [object.material]
          for (const material of objectMaterials) {
            materials.add(material)
            for (const value of Object.values(material)) if (value instanceof THREE.Texture) maps.add(value)
          }
        }
      })
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
      maps.forEach((texture) => texture.dispose())
      textures.forEach((texture) => texture.dispose())
      renderer.dispose()
      renderer.domElement.remove()
      delete window.__SCENE_READY__
      delete window.__SCENE_STATS__
      delete window.__seek
      delete window.__capture
      delete window.__restore
      delete window.__CAPTURE_MODE__
    }
  }, [])

  useEffect(() => {
    stateRenderRef.current?.()
  }, [props.materialized, props.lightOn, props.woolf, props.windowOpen, props.wardrobeOpen, props.journalOpen])

  return (
    <div className="room-scene" ref={hostRef}>
      {error && <div className="room-scene-error" role="status">{error}</div>}
    </div>
  )
}


