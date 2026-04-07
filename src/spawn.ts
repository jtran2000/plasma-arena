import {
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Mesh,
  Color3,
  Color4,
  PhysicsAggregate,
  PhysicsShapeType,
  Quaternion,
  ParticleSystem,
  PointLight,
  VertexData,
  DynamicTexture,
} from "@babylonjs/core";
import {
  BallAndSocketConstraint,
  type PhysicsConstraint,
} from "@babylonjs/core/Physics/v2/physicsConstraint.js";
import {
  AdvancedDynamicTexture,
  Rectangle,
  TextBlock,
  Control,
} from "@babylonjs/gui";
import {
  ARENA,
  LIGHTING,
  PLAYER,
  BLASTER,
  SCORING,
  ENEMY,
  BULLET_HOLE,
  ENEMY_HEALTH_BAR,
  RIFLE,
} from "./constants.js";
const { PLASMA, HEAT } = BLASTER;
import { g, releaseBayonetEmbed, type Enemy } from "./game.js";
import {
  playEnemySpawnSound,
  playEnemyDeathSound,
  playLaserSound,
  startFireSound,
  stopFireSound,
} from "./audio.js";
import {
  effectiveCooldown,
  effectiveHeatMax,
  incrementScore,
} from "./progression.js";

// ─── Mesh definitions ────────────────────────────────────────────────────────

// Player
const PLAYER_MESH = {
  capsule: { height: 1.8, radius: 0.4 },
};

// Arena
const ARENA_STYLE = {
  room: ARENA.size,
  ceil: ARENA.ceil,

  floor: {
    size: { height: 0.2 } as const,
    diffuse: new Color3(0.25, 0.22, 0.18),
    specular: new Color3(0.05, 0.05, 0.05),
  },

  ceiling: {
    size: { height: 0.2 } as const,
    diffuse: new Color3(0.12, 0.12, 0.15),
  },

  wall: {
    thickness: 0.3,
    diffuse: new Color3(0.3, 0.28, 0.24),
    specular: new Color3(0.02, 0.02, 0.02),
  },

  pillar: {
    size: { width: 1.4, depth: 1.4 } as const,
    positions: [
      [-10, -10],
      [-10, 10],
      [10, -10],
      [10, 10],
      [-20, 0],
      [20, 0],
      [0, -20],
      [0, 20],
      [-18, -18],
      [-18, 18],
      [18, -18],
      [18, 18],
    ] as [number, number][],
  },

  crate: {
    size: 1,
    diffuse: new Color3(0.45, 0.32, 0.18),
    positions: [
      [5, 0.5, 8],
      [-7, 0.5, 5],
      [10, 0.5, -6],
      [-5, 0.5, -10],
      [5, 1.5, 8],
      [-14, 0.5, 12],
      [15, 0.5, -3],
      [-3, 0.5, -16],
      [12, 0.5, 14],
      [-16, 0.5, -8],
      [8, 0.5, -15],
      [-12, 0.5, -14],
      [18, 0.5, 10],
      [-8, 0.5, 18],
      [0, 0.5, -12],
      [14, 0.5, 5],
      [-16, 0.5, -8],
      [-16, 1.5, -8],
      [12, 0.5, 14],
      [12, 1.5, 14],
    ] as [number, number, number][],
  },

  accentStrip: {
    height: 0.15,
    depth: 0.05,
    yPos: 0.5,
    wallInset: 0.2,
    diffuse: new Color3(0.6, 0.3, 0.05),
    emissive: new Color3(0.3, 0.15, 0.02),
  },
};

// Weapon
const WEAPON = {
  rootPos: new Vector3(0.22, -0.2, 0.5),

  body: {
    size: { width: 0.07, height: 0.08, depth: 0.3 } as const,
    pos: new Vector3(0, 0, 0.02),
    diffuse: new Color3(0.07, 0.08, 0.16),
    specular: new Color3(0.3, 0.3, 0.6),
    emissive: new Color3(0.01, 0.01, 0.04),
  },

  barrel: {
    size: { diameter: 0.024, height: 0.44, tessellation: 10 } as const,
    pos: new Vector3(0, 0.016, 0.33),
    rotX: Math.PI / 2,
    diffuse: new Color3(0.18, 0.18, 0.24),
    specular: new Color3(0.9, 0.9, 1.0),
  },

  cell: {
    size: { width: 0.05, height: 0.1, depth: 0.12 } as const,
    pos: new Vector3(0, 0.09, -0.04),
    diffuse: new Color3(0.04, 0.25, 0.36),
    emissive: new Color3(0.0, 0.12, 0.2),
  },

  grip: {
    size: { width: 0.06, height: 0.12, depth: 0.07 } as const,
    pos: new Vector3(0, -0.095, -0.06),
    diffuse: new Color3(0.1, 0.09, 0.09),
  },

  accent: {
    size: { width: 0.009, height: 0.009, depth: 0.24 } as const,
    pos: new Vector3(0, 0.044, 0.04),
    diffuse: new Color3(0.0, 0.5, 0.9),
    emissive: new Color3(0.0, 0.3, 0.7),
  },

  lens: {
    size: { diameter: 0.034, segments: 6 } as const,
    pos: new Vector3(0, 0.016, 0.555),
    diffuse: new Color3(0.0, 0.9, 1.0),
    emissive: new Color3(0.0, 0.8, 1.0),
  },

  barrelTipPos: new Vector3(0, 0.016, 0.58),
};

const RIFLE_WEAPON = {
  rootPos: new Vector3(0.24, -0.22, 0.58),
  body: {
    size: { width: 0.09, height: 0.09, depth: 0.58 } as const,
    pos: new Vector3(0, 0, 0.08),
    diffuse: new Color3(0.12, 0.13, 0.16),
    specular: new Color3(0.25, 0.25, 0.3),
    emissive: new Color3(0.02, 0.02, 0.03),
  },
  barrel: {
    size: { diameter: 0.028, height: 0.78, tessellation: 14 } as const,
    pos: new Vector3(0, 0.015, 0.68),
    rotX: Math.PI / 2,
    diffuse: new Color3(0.18, 0.18, 0.2),
    emissive: new Color3(0.04, 0.03, 0.02),
  },
  stock: {
    size: { width: 0.07, height: 0.07, depth: 0.22 } as const,
    pos: new Vector3(0, -0.01, -0.18),
    diffuse: new Color3(0.3, 0.18, 0.08),
  },
  grip: {
    size: { width: 0.05, height: 0.16, depth: 0.03 } as const,
    pos: new Vector3(0, -0.12, 0.03),
    diffuse: new Color3(0.08, 0.08, 0.09),
  },
  mag: {
    size: { width: 0.045, height: 0.18, depth: 0.09 } as const,
    pos: new Vector3(0, -0.11, 0.13),
    diffuse: new Color3(0.72, 0.32, 0.06),
    emissive: new Color3(0.26, 0.08, 0.01),
  },
  brake: {
    size: { width: 0.05, height: 0.05, depth: 0.08 } as const,
    pos: new Vector3(0, 0.015, 1.08),
    diffuse: new Color3(0.16, 0.16, 0.18),
    emissive: new Color3(0.04, 0.04, 0.05),
  },
  scope: {
    tube: {
      size: {
        diameter: 0.066,
        height: 0.28,
        tessellation: 18,
        cap: Mesh.NO_CAP,
      } as const,
      pos: new Vector3(0, 0.1375, -0.02),
      rotX: Math.PI / 2,
    },
    rearLens: {
      radius: 0.026,
      tessellation: 32,
      pos: new Vector3(0, 0.1375, -0.148),
      diffuse: new Color3(0.42, 0.42, 0.44),
      emissive: new Color3(0.03, 0.03, 0.035),
      specular: new Color3(0.35, 0.35, 0.38),
    },
    rearShroud: {
      size: {
        diameter: 0.068,
        height: 0.036,
        tessellation: 24,
        cap: Mesh.NO_CAP,
        sideOrientation: Mesh.DOUBLESIDE,
      } as const,
      pos: new Vector3(0, 0.1375, -0.157),
      rotX: Math.PI / 2,
    },
    rearRim: {
      size: { diameter: 0.076, thickness: 0.017, tessellation: 24 } as const,
      pos: new Vector3(0, 0.1375, -0.164),
      rotX: Math.PI / 2,
    },
    frontRim: {
      size: { diameter: 0.08, thickness: 0.017, tessellation: 24 } as const,
      pos: new Vector3(0, 0.1375, 0.12),
      rotX: Math.PI / 2,
    },
    mount: {
      size: { width: 0.075, height: 0.02, depth: 0.2 } as const,
      pos: new Vector3(0, 0.06, -0.02),
    },
    bracket: {
      postSize: { width: 0.04, height: 0.026, depth: 0.025 } as const,
      postCapSize: { width: 0.04, height: 0.01, depth: 0.025 } as const,
      postCapInnerGap: 0.02,
      collarInnerRadius: 0.0335,
      collarOuterRadius: 0.043,
      collarDepth: 0.028,
      collarArcSegments: 24,
      rearPos: new Vector3(0, 0.083, -0.075),
      frontPos: new Vector3(0, 0.083, 0.035),
      capYOffset: 0.018,
      diffuse: new Color3(0.68, 0.43, 0.16),
      emissive: new Color3(0.12, 0.07, 0.02),
      specular: new Color3(0.75, 0.55, 0.28),
    },
    diffuse: new Color3(0.005, 0.005, 0.006),
    emissive: new Color3(0.0, 0.0, 0.0),
  },
  bayonet: {
    blade: {
      length: 0.42,
      baseHeight: 0.045,
      tipHeight: 0.008,
      thickness: 0.012,
      pos: new Vector3(0, -0.04, 1.305),
    },
    hilt: {
      size: { width: 0.016, height: 0.06, depth: 0.045 } as const,
      pos: new Vector3(0, -0.04, 1.095),
      diffuse: new Color3(0.08, 0.07, 0.055),
      emissive: new Color3(0.02, 0.015, 0.01),
    },
    diffuse: new Color3(0.75, 0.78, 0.82),
    emissive: new Color3(0.08, 0.09, 0.1),
    specular: new Color3(0.75, 0.78, 0.9),
  },
  barrelTipPos: new Vector3(0, 0.015, 1.13),
};

// Enemy
const ENEMY_COLOR = new Color3(0.45, 0.45, 0.45);

const ENEMY_MESH = {
  capsule: { height: 2.5, radius: 0.6 } as const,
  body: { width: 0.65, height: 1.1, depth: 0.3 } as const,
  bodyOffset: new Vector3(0, 0.15, 0),
  head: { height: 0.47, radius: 0.15 } as const,
  headOffset: new Vector3(0, 0.8, 0),
  leg: { width: 0.2, height: 0.9, depth: 0.2 } as const,
  legOffsetY: -0.4, // top of leg (pivot) relative to capsule center
  legSpacing: 0.225, // lateral offset from center (leg edges align with body edges)
  arm: { width: 0.15, height: 0.7, depth: 0.15 } as const,
  armOffsetY: 0.65, // shoulder height (body top is ~0.7)
  armSpacing: 0.4, // just touching body edge (body half-width 0.325 + arm half-width 0.075)
};

// Laser beam
const LASER_BEAM = {
  radius: 0.014,
  tessellation: 6,
  diffuse: new Color3(0, 1, 1),
  emissive: new Color3(0, 0.9, 1),
};

// Bullet hole
const BULLET_HOLE_STYLE = {
  radius: 0.08,
  tessellation: 8,
  surfaceOffset: 0.01,
  diffuse: new Color3(0.05, 0.05, 0.05),
  emissive: new Color3(0.02, 0.02, 0.02),
};

// ─── Arena materials (private) ────────────────────────────────────────────────
function makeFloorMat(): StandardMaterial {
  const mat = new StandardMaterial("floor", g.scene);
  mat.diffuseColor = ARENA_STYLE.floor.diffuse;
  mat.specularColor = ARENA_STYLE.floor.specular;
  return mat;
}

function makeWallMat(): StandardMaterial {
  const mat = new StandardMaterial("wall", g.scene);
  mat.diffuseColor = ARENA_STYLE.wall.diffuse;
  mat.specularColor = ARENA_STYLE.wall.specular;
  return mat;
}

function makeCeilMat(): StandardMaterial {
  const mat = new StandardMaterial("ceil", g.scene);
  mat.diffuseColor = ARENA_STYLE.ceiling.diffuse;
  return mat;
}

function makeAccentMat(): StandardMaterial {
  const mat = new StandardMaterial("accent", g.scene);
  mat.diffuseColor = ARENA_STYLE.accentStrip.diffuse;
  mat.emissiveColor = ARENA_STYLE.accentStrip.emissive;
  return mat;
}

function makeCrateMat(): StandardMaterial {
  const mat = new StandardMaterial("crate", g.scene);
  mat.diffuseColor = ARENA_STYLE.crate.diffuse;
  return mat;
}

// ─── Arena meshes (private) ───────────────────────────────────────────────────
function makeFloor(): Mesh {
  return MeshBuilder.CreateBox(
    "floor",
    {
      width: ARENA_STYLE.room,
      height: ARENA_STYLE.floor.size.height,
      depth: ARENA_STYLE.room,
    },
    g.scene,
  );
}

function makeCeil(): Mesh {
  return MeshBuilder.CreateBox(
    "ceil",
    {
      width: ARENA_STYLE.room,
      height: ARENA_STYLE.ceiling.size.height,
      depth: ARENA_STYLE.room,
    },
    g.scene,
  );
}

function makeWallBox(w: number, h: number): Mesh {
  return MeshBuilder.CreateBox(
    "wall",
    { width: w, height: h, depth: ARENA_STYLE.wall.thickness },
    g.scene,
  );
}

function makePillar(): Mesh {
  return MeshBuilder.CreateBox(
    "pillar",
    {
      width: ARENA_STYLE.pillar.size.width,
      height: ARENA_STYLE.ceil,
      depth: ARENA_STYLE.pillar.size.depth,
    },
    g.scene,
  );
}

function makeCrate(): Mesh {
  return MeshBuilder.CreateBox(
    "crate",
    { size: ARENA_STYLE.crate.size },
    g.scene,
  );
}

function makeAccentStrip(): Mesh {
  return MeshBuilder.CreateBox(
    "strip",
    {
      width: ARENA_STYLE.room - 1,
      height: ARENA_STYLE.accentStrip.height,
      depth: ARENA_STYLE.accentStrip.depth,
    },
    g.scene,
  );
}

// ─── Arena setup (exported) ───────────────────────────────────────────────────
export function setupArenaFloor(): Mesh {
  const m = makeFloor();
  m.position.y = -0.1;
  m.material = makeFloorMat();
  m.receiveShadows = true;
  new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
  return m;
}

export function setupArenaCeil(): Mesh {
  const m = makeCeil();
  m.position.y = ARENA_STYLE.ceil + 0.1;
  m.material = makeCeilMat();
  new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
  return m;
}

export function setupArenaWalls(): Mesh[] {
  const mat = makeWallMat();
  const ROOM = ARENA_STYLE.room;
  const CEIL = ARENA_STYLE.ceil;
  const half = ROOM / 2;
  return [
    [new Vector3(0, CEIL / 2, -half), 0],
    [new Vector3(0, CEIL / 2, half), 0],
    [new Vector3(-half, CEIL / 2, 0), Math.PI / 2],
    [new Vector3(half, CEIL / 2, 0), Math.PI / 2],
  ].map(([pos, rotY]) => {
    const m = makeWallBox(ROOM, CEIL);
    m.position = pos as Vector3;
    m.rotation.y = rotY as number;
    m.material = mat;
    m.receiveShadows = true;
    new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
    return m;
  });
}

export function setupArenaPillars(): Mesh[] {
  const mat = makeWallMat();
  return ARENA_STYLE.pillar.positions.map(([x, z]) => {
    const m = makePillar();
    m.position = new Vector3(x, ARENA_STYLE.ceil / 2, z);
    m.material = mat;
    m.receiveShadows = true;
    new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
    return m;
  });
}

export function setupArenaCrates(): Mesh[] {
  const mat = makeCrateMat();
  return ARENA_STYLE.crate.positions.map(([x, y, z]) => {
    const m = makeCrate();
    m.position = new Vector3(x, y, z);
    m.material = mat;
    m.receiveShadows = true;
    new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
    return m;
  });
}

export function setupArenaAccentStrips(): Mesh[] {
  const mat = makeAccentMat();
  const half = ARENA_STYLE.room / 2;
  const stripInset = half - ARENA_STYLE.accentStrip.wallInset;
  return [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((rot) => {
    const m = makeAccentStrip();
    m.rotation.y = rot;
    m.position = new Vector3(
      rot === 0 || rot === Math.PI ? 0 : rot > 0 ? stripInset : -stripInset,
      ARENA_STYLE.accentStrip.yPos,
      rot === 0 ? -stripInset : rot === Math.PI ? stripInset : 0,
    );
    m.material = mat;
    return m;
  });
}

// ─── Weapon materials (private) ───────────────────────────────────────────────
function makeWeaponBodyMat(): StandardMaterial {
  const mat = new StandardMaterial("wBodyMat", g.scene);
  mat.diffuseColor = WEAPON.body.diffuse;
  mat.specularColor = WEAPON.body.specular;
  mat.emissiveColor = WEAPON.body.emissive;
  return mat;
}

function makeWeaponBarrelMat(): StandardMaterial {
  const mat = new StandardMaterial("wBarrelMat", g.scene);
  mat.diffuseColor = WEAPON.barrel.diffuse;
  mat.specularColor = WEAPON.barrel.specular;
  return mat;
}

function makeWeaponCellMat(): StandardMaterial {
  const mat = new StandardMaterial("wCellMat", g.scene);
  mat.diffuseColor = WEAPON.cell.diffuse;
  mat.emissiveColor = WEAPON.cell.emissive;
  return mat;
}

function makeWeaponGripMat(): StandardMaterial {
  const mat = new StandardMaterial("wGripMat", g.scene);
  mat.diffuseColor = WEAPON.grip.diffuse;
  return mat;
}

function makeWeaponAccentMat(): StandardMaterial {
  const mat = new StandardMaterial("wAccentMat", g.scene);
  mat.diffuseColor = WEAPON.accent.diffuse;
  mat.emissiveColor = WEAPON.accent.emissive;
  return mat;
}

function makeWeaponLensMat(): StandardMaterial {
  const mat = new StandardMaterial("wLensMat", g.scene);
  mat.diffuseColor = WEAPON.lens.diffuse;
  mat.emissiveColor = WEAPON.lens.emissive;
  return mat;
}

// ─── Weapon meshes (private) ──────────────────────────────────────────────────
function makeWeaponBodyMesh(): Mesh {
  return MeshBuilder.CreateBox("wBody", WEAPON.body.size, g.scene);
}

function makeWeaponBarrelMesh(): Mesh {
  return MeshBuilder.CreateCylinder("wBarrel", WEAPON.barrel.size, g.scene);
}

function makeWeaponCellMesh(): Mesh {
  return MeshBuilder.CreateBox("wCell", WEAPON.cell.size, g.scene);
}

function makeWeaponGripMesh(): Mesh {
  return MeshBuilder.CreateBox("wGrip", WEAPON.grip.size, g.scene);
}

function makeWeaponAccentMesh(): Mesh {
  return MeshBuilder.CreateBox("wAccent", WEAPON.accent.size, g.scene);
}

function makeWeaponLensMesh(): Mesh {
  return MeshBuilder.CreateSphere("wLens", WEAPON.lens.size, g.scene);
}

function makeRifleBodyMesh(): Mesh {
  return MeshBuilder.CreateBox("rBody", RIFLE_WEAPON.body.size, g.scene);
}

function makeRifleBarrelMesh(): Mesh {
  return MeshBuilder.CreateCylinder(
    "rBarrel",
    RIFLE_WEAPON.barrel.size,
    g.scene,
  );
}

function makeRifleStockMesh(): Mesh {
  const { width, height, depth } = RIFLE_WEAPON.stock.size;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const halfDepth = depth / 2;
  const mesh = new Mesh("rStock", g.scene);
  const vertexData = new VertexData();

  // Side profile is a right triangle with the right angle at the top rear.
  vertexData.positions = [
    -halfWidth,
    halfHeight,
    -halfDepth,
    -halfWidth,
    -halfHeight,
    -halfDepth,
    -halfWidth,
    halfHeight,
    halfDepth,
    halfWidth,
    halfHeight,
    -halfDepth,
    halfWidth,
    -halfHeight,
    -halfDepth,
    halfWidth,
    halfHeight,
    halfDepth,
  ];
  vertexData.indices = [
    0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4,
  ];
  const normals: number[] = [];
  VertexData.ComputeNormals(vertexData.positions, vertexData.indices, normals);
  vertexData.normals = normals;
  vertexData.applyToMesh(mesh);
  return mesh;
}

function makeRifleGripMesh(): Mesh {
  return MeshBuilder.CreateBox("rGrip", RIFLE_WEAPON.grip.size, g.scene);
}

function makeRifleMagMesh(): Mesh {
  return MeshBuilder.CreateBox("rMag", RIFLE_WEAPON.mag.size, g.scene);
}

function makeRifleBrakeMesh(): Mesh {
  return MeshBuilder.CreateBox("rBrake", RIFLE_WEAPON.brake.size, g.scene);
}

function makeRifleScopeBracketCollarMesh(): Mesh {
  const mesh = new Mesh("rScopeBracketCollar", g.scene);
  const vertexData = new VertexData();
  const positions: number[] = [];
  const indices: number[] = [];
  const {
    collarArcSegments,
    collarDepth,
    collarInnerRadius,
    collarOuterRadius,
  } = RIFLE_WEAPON.scope.bracket;
  const halfDepth = collarDepth / 2;

  for (let i = 0; i <= collarArcSegments; i++) {
    const t = i / collarArcSegments;
    const angle = t * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    positions.push(
      cos * collarInnerRadius,
      sin * collarInnerRadius,
      -halfDepth,
      cos * collarInnerRadius,
      sin * collarInnerRadius,
      halfDepth,
      cos * collarOuterRadius,
      sin * collarOuterRadius,
      -halfDepth,
      cos * collarOuterRadius,
      sin * collarOuterRadius,
      halfDepth,
    );
  }

  for (let i = 0; i < collarArcSegments; i++) {
    const a = i * 4;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    const e = a + 4;
    const f = a + 5;
    const h = a + 7;
    const g2 = a + 6;
    indices.push(
      a,
      e,
      b,
      e,
      f,
      b,
      c,
      d,
      g2,
      g2,
      d,
      h,
      b,
      f,
      d,
      d,
      f,
      h,
      a,
      c,
      e,
      e,
      c,
      g2,
    );
  }

  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.applyToMesh(mesh);
  return mesh;
}

function makeRifleScopeMesh(): Mesh {
  const root = new Mesh("rScope", g.scene);
  root.isPickable = false;

  const tube = MeshBuilder.CreateCylinder(
    "rScopeTube",
    RIFLE_WEAPON.scope.tube.size,
    g.scene,
  );
  tube.parent = root;
  tube.position = RIFLE_WEAPON.scope.tube.pos.clone();
  tube.rotation.x = RIFLE_WEAPON.scope.tube.rotX;
  tube.isPickable = false;
  tube.renderingGroupId = 1;

  const rearLens = MeshBuilder.CreateDisc(
    "rScopeLens",
    {
      radius: RIFLE_WEAPON.scope.rearLens.radius,
      tessellation: RIFLE_WEAPON.scope.rearLens.tessellation,
      sideOrientation: Mesh.DOUBLESIDE,
    },
    g.scene,
  );
  rearLens.parent = root;
  rearLens.position = RIFLE_WEAPON.scope.rearLens.pos.clone();
  rearLens.material = makeRifleScopeLensMat();
  rearLens.isPickable = false;
  rearLens.renderingGroupId = 1;

  const rearShroud = MeshBuilder.CreateCylinder(
    "rScopeRearShroud",
    RIFLE_WEAPON.scope.rearShroud.size,
    g.scene,
  );
  rearShroud.parent = root;
  rearShroud.position = RIFLE_WEAPON.scope.rearShroud.pos.clone();
  rearShroud.rotation.x = RIFLE_WEAPON.scope.rearShroud.rotX;
  rearShroud.isPickable = false;
  rearShroud.renderingGroupId = 1;

  const rearRim = MeshBuilder.CreateTorus(
    "rScopeRearRim",
    RIFLE_WEAPON.scope.rearRim.size,
    g.scene,
  );
  rearRim.parent = root;
  rearRim.position = RIFLE_WEAPON.scope.rearRim.pos.clone();
  rearRim.rotation.x = RIFLE_WEAPON.scope.rearRim.rotX;
  rearRim.isPickable = false;
  rearRim.renderingGroupId = 1;

  const frontRim = MeshBuilder.CreateTorus(
    "rScopeFrontRim",
    RIFLE_WEAPON.scope.frontRim.size,
    g.scene,
  );
  frontRim.parent = root;
  frontRim.position = RIFLE_WEAPON.scope.frontRim.pos.clone();
  frontRim.rotation.x = RIFLE_WEAPON.scope.frontRim.rotX;
  frontRim.isPickable = false;
  frontRim.renderingGroupId = 1;

  const mount = MeshBuilder.CreateBox(
    "rScopeMount",
    RIFLE_WEAPON.scope.mount.size,
    g.scene,
  );
  mount.parent = root;
  mount.position = RIFLE_WEAPON.scope.mount.pos.clone();
  mount.isPickable = false;
  mount.renderingGroupId = 1;

  for (const pos of [
    RIFLE_WEAPON.scope.bracket.rearPos,
    RIFLE_WEAPON.scope.bracket.frontPos,
  ]) {
    const post = MeshBuilder.CreateBox(
      "rScopeBracket",
      RIFLE_WEAPON.scope.bracket.postSize,
      g.scene,
    );
    post.parent = root;
    post.position = pos.clone();
    post.isPickable = false;
    post.renderingGroupId = 1;

    const capHalfWidth =
      (RIFLE_WEAPON.scope.bracket.postCapSize.width -
        RIFLE_WEAPON.scope.bracket.postCapInnerGap) /
      2;
    const capOffsetX =
      RIFLE_WEAPON.scope.bracket.postCapInnerGap / 2 + capHalfWidth / 2;
    for (const capX of [-capOffsetX, capOffsetX]) {
      const postCap = MeshBuilder.CreateBox(
        "rScopeBracket",
        {
          ...RIFLE_WEAPON.scope.bracket.postCapSize,
          width: capHalfWidth,
        },
        g.scene,
      );
      postCap.parent = root;
      postCap.position = new Vector3(
        pos.x + capX,
        pos.y + RIFLE_WEAPON.scope.bracket.capYOffset,
        pos.z,
      );
      postCap.isPickable = false;
      postCap.renderingGroupId = 1;
    }

    const collar = makeRifleScopeBracketCollarMesh();
    collar.parent = root;
    collar.position = new Vector3(pos.x, RIFLE_WEAPON.scope.tube.pos.y, pos.z);
    collar.isPickable = false;
    collar.renderingGroupId = 1;
  }

  return root;
}

function makeRifleBayonetMesh(): Mesh {
  const root = new Mesh("rBayonet", g.scene);
  root.isPickable = false;

  const { blade, hilt } = RIFLE_WEAPON.bayonet;
  const halfThickness = blade.thickness / 2;
  const halfBase = blade.baseHeight / 2;
  const halfTip = blade.tipHeight / 2;
  const halfLength = blade.length / 2;

  const bladeMesh = new Mesh("rBayonetBlade", g.scene);
  const vertexData = new VertexData();
  vertexData.positions = [
    -halfThickness,
    -halfBase,
    -halfLength,
    halfThickness,
    -halfBase,
    -halfLength,
    halfThickness,
    halfBase,
    -halfLength,
    -halfThickness,
    halfBase,
    -halfLength,
    -halfThickness,
    -halfTip,
    halfLength,
    halfThickness,
    -halfTip,
    halfLength,
    halfThickness,
    halfTip,
    halfLength,
    -halfThickness,
    halfTip,
    halfLength,
  ];
  vertexData.indices = [
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 1,
    5, 6, 1, 6, 2, 0, 3, 7, 0, 7, 4,
  ];
  const normals: number[] = [];
  VertexData.ComputeNormals(vertexData.positions, vertexData.indices, normals);
  vertexData.normals = normals;
  vertexData.applyToMesh(bladeMesh);
  bladeMesh.parent = root;
  bladeMesh.position = blade.pos.clone();
  bladeMesh.material = makeRifleBayonetMat();
  bladeMesh.isPickable = false;
  bladeMesh.renderingGroupId = 1;

  const hiltMesh = MeshBuilder.CreateBox("rBayonetHilt", hilt.size, g.scene);
  const hiltMat = new StandardMaterial("rifleBayonetHilt", g.scene);
  hiltMat.diffuseColor = hilt.diffuse;
  hiltMat.emissiveColor = hilt.emissive;
  hiltMesh.parent = root;
  hiltMesh.position = hilt.pos.clone();
  hiltMesh.material = hiltMat;
  hiltMesh.isPickable = false;
  hiltMesh.renderingGroupId = 1;

  return root;
}

function makeRifleBodyMat(): StandardMaterial {
  const mat = new StandardMaterial("rifleBody", g.scene);
  mat.diffuseColor = RIFLE_WEAPON.body.diffuse;
  mat.specularColor = new Color3(0.35, 0.35, 0.38);
  mat.emissiveColor = RIFLE_WEAPON.body.emissive;
  return mat;
}

function makeRifleBarrelMat(): StandardMaterial {
  const mat = new StandardMaterial("rifleBarrel", g.scene);
  mat.diffuseColor = RIFLE_WEAPON.barrel.diffuse;
  mat.emissiveColor = RIFLE_WEAPON.barrel.emissive;
  return mat;
}

function makeRifleGripMat(): StandardMaterial {
  const mat = new StandardMaterial("rifleGrip", g.scene);
  mat.diffuseColor = RIFLE_WEAPON.grip.diffuse;
  return mat;
}

function makeRifleStockMat(): StandardMaterial {
  const mat = new StandardMaterial("rifleStock", g.scene);
  mat.diffuseColor = RIFLE_WEAPON.stock.diffuse;
  mat.backFaceCulling = false;
  return mat;
}

function makeRifleMagMat(): StandardMaterial {
  const mat = new StandardMaterial("rifleMag", g.scene);
  mat.diffuseColor = RIFLE_WEAPON.mag.diffuse;
  mat.emissiveColor = RIFLE_WEAPON.mag.emissive;
  return mat;
}

function makeRifleBrakeMat(): StandardMaterial {
  const mat = new StandardMaterial("rifleBrake", g.scene);
  mat.diffuseColor = RIFLE_WEAPON.brake.diffuse;
  mat.emissiveColor = RIFLE_WEAPON.brake.emissive;
  return mat;
}

function makeRifleScopeMat(): StandardMaterial {
  const mat = new StandardMaterial("rifleScope", g.scene);
  mat.diffuseColor = RIFLE_WEAPON.scope.diffuse;
  mat.emissiveColor = RIFLE_WEAPON.scope.emissive;
  mat.specularColor = new Color3(0.08, 0.08, 0.09);
  mat.backFaceCulling = false;
  return mat;
}

function makeRifleScopeLensMat(): StandardMaterial {
  const texSize = 128;
  const tex = new DynamicTexture(
    "rifleScopeLensTexture",
    { width: texSize, height: texSize },
    g.scene,
  );
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, texSize, texSize);
  ctx.fillStyle = "rgba(115, 125, 135, 0.48)";
  ctx.fillRect(0, 0, texSize, texSize);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.96)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(texSize / 2, 0);
  ctx.lineTo(texSize / 2, texSize);
  ctx.moveTo(0, texSize / 2);
  ctx.lineTo(texSize, texSize / 2);
  ctx.stroke();
  tex.hasAlpha = true;
  tex.update(false);

  const mat = new StandardMaterial("rifleScopeLens", g.scene);
  mat.diffuseColor = RIFLE_WEAPON.scope.rearLens.diffuse;
  mat.emissiveColor = RIFLE_WEAPON.scope.rearLens.emissive;
  mat.specularColor = RIFLE_WEAPON.scope.rearLens.specular;
  mat.diffuseTexture = tex;
  mat.useAlphaFromDiffuseTexture = true;
  mat.alpha = 0.82;
  mat.disableLighting = false;
  mat.backFaceCulling = false;
  return mat;
}

function makeRifleScopeBracketMat(): StandardMaterial {
  const mat = new StandardMaterial("rifleScopeBracket", g.scene);
  mat.diffuseColor = RIFLE_WEAPON.scope.bracket.diffuse;
  mat.emissiveColor = RIFLE_WEAPON.scope.bracket.emissive;
  mat.specularColor = RIFLE_WEAPON.scope.bracket.specular;
  return mat;
}

function makeRifleBayonetMat(): StandardMaterial {
  const mat = new StandardMaterial("rifleBayonet", g.scene);
  mat.diffuseColor = RIFLE_WEAPON.bayonet.diffuse;
  mat.emissiveColor = RIFLE_WEAPON.bayonet.emissive;
  mat.specularColor = RIFLE_WEAPON.bayonet.specular;
  return mat;
}

// ─── Weapon setup (exported) ──────────────────────────────────────────────────
export function setupWeaponRoot(): Mesh {
  const root = new Mesh("weaponRoot", g.scene);
  root.parent = g.camera;
  root.position = WEAPON.rootPos.clone();
  root.isPickable = false;
  return root;
}

export function setupRifleRoot(): Mesh {
  const root = new Mesh("rifleRoot", g.scene);
  root.parent = g.camera;
  root.position = RIFLE_WEAPON.rootPos.clone();
  root.isPickable = false;
  return root;
}

export function setupWeaponParts(root: Mesh): {
  cell: Mesh;
  barrel: Mesh;
  barrelTip: Mesh;
} {
  function wp(
    mesh: Mesh,
    mat: StandardMaterial,
    localPos: Vector3,
    localRotX = 0,
  ): Mesh {
    mesh.parent = root;
    mesh.position = localPos;
    mesh.rotation.x = localRotX;
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.renderingGroupId = 1;
    return mesh;
  }

  wp(makeWeaponBodyMesh(), makeWeaponBodyMat(), WEAPON.body.pos.clone());
  const barrel = wp(
    makeWeaponBarrelMesh(),
    makeWeaponBarrelMat(),
    WEAPON.barrel.pos.clone(),
    WEAPON.barrel.rotX,
  );
  const cell = wp(
    makeWeaponCellMesh(),
    makeWeaponCellMat(),
    WEAPON.cell.pos.clone(),
  );
  wp(makeWeaponGripMesh(), makeWeaponGripMat(), WEAPON.grip.pos.clone());
  wp(makeWeaponAccentMesh(), makeWeaponAccentMat(), WEAPON.accent.pos.clone());
  wp(makeWeaponLensMesh(), makeWeaponLensMat(), WEAPON.lens.pos.clone());

  const barrelTip = new Mesh("wBarrelTip", g.scene);
  barrelTip.parent = root;
  barrelTip.position = WEAPON.barrelTipPos.clone();
  barrelTip.isVisible = false;
  barrelTip.isPickable = false;

  return { cell, barrel, barrelTip };
}

export function setupRifleParts(root: Mesh): {
  mag: Mesh;
  barrel: Mesh;
  barrelTip: Mesh;
  brake: Mesh;
  scope: Mesh;
  bayonet: Mesh;
} {
  function wp(
    mesh: Mesh,
    mat: StandardMaterial,
    localPos: Vector3,
    localRotX = 0,
  ): Mesh {
    mesh.parent = root;
    mesh.position = localPos;
    mesh.rotation.x = localRotX;
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.renderingGroupId = 1;
    return mesh;
  }

  wp(makeRifleBodyMesh(), makeRifleBodyMat(), RIFLE_WEAPON.body.pos.clone());
  wp(makeRifleStockMesh(), makeRifleStockMat(), RIFLE_WEAPON.stock.pos.clone());
  wp(makeRifleGripMesh(), makeRifleGripMat(), RIFLE_WEAPON.grip.pos.clone());
  const barrel = wp(
    makeRifleBarrelMesh(),
    makeRifleBarrelMat(),
    RIFLE_WEAPON.barrel.pos.clone(),
    RIFLE_WEAPON.barrel.rotX,
  );
  const mag = wp(
    makeRifleMagMesh(),
    makeRifleMagMat(),
    RIFLE_WEAPON.mag.pos.clone(),
  );
  const brake = wp(
    makeRifleBrakeMesh(),
    makeRifleBrakeMat(),
    RIFLE_WEAPON.brake.pos.clone(),
  );
  brake.isVisible = false;
  const scope = wp(makeRifleScopeMesh(), makeRifleScopeMat(), Vector3.Zero());
  const scopeBracketMat = makeRifleScopeBracketMat();
  for (const child of scope.getChildMeshes(false)) {
    if (child.name === "rScopeLens") continue;
    child.material =
      child.name === "rScopeBracket" || child.name === "rScopeBracketCollar"
        ? scopeBracketMat
        : scope.material;
  }
  scope.setEnabled(false);
  const bayonet = wp(
    makeRifleBayonetMesh(),
    makeRifleBayonetMat(),
    Vector3.Zero(),
  );
  bayonet.setEnabled(false);

  const barrelTip = new Mesh("rBarrelTip", g.scene);
  barrelTip.parent = root;
  barrelTip.position = RIFLE_WEAPON.barrelTipPos.clone();
  barrelTip.isVisible = false;
  barrelTip.isPickable = false;

  return { mag, barrel, barrelTip, brake, scope, bayonet };
}

// ─── Player mesh (exported) ───────────────────────────────────────────────────
export function makePlayerMesh(): { mesh: Mesh; aggregate: PhysicsAggregate } {
  const mesh = MeshBuilder.CreateCapsule(
    "player",
    PLAYER_MESH.capsule,
    g.scene,
  );
  mesh.position.y = PLAYER.spawnY;
  mesh.isVisible = false;
  const aggregate = new PhysicsAggregate(
    mesh,
    PhysicsShapeType.CAPSULE,
    { mass: PLAYER.mass, friction: 0.7, restitution: 0 },
    g.scene,
  );
  aggregate.body.setMassProperties({
    mass: PLAYER.mass,
    inertia: Vector3.Zero(),
    inertiaOrientation: Quaternion.Identity(),
  });
  return { mesh, aggregate };
}

// ─── Enemy material & meshes (exported) ───────────────────────────────────────
function makeEnemyMat(): StandardMaterial {
  const mat = new StandardMaterial("emat", g.scene);
  mat.diffuseColor = ENEMY_COLOR.clone();
  mat.emissiveColor = mat.diffuseColor.scale(0.2);
  return mat;
}

export function makeEnemyMats(): {
  bodyMat: StandardMaterial;
  headMat: StandardMaterial;
} {
  const bodyMat = makeEnemyMat();
  const headMat = bodyMat.clone("emat_head") as StandardMaterial;
  return { bodyMat, headMat };
}

export function makeEnemyPhysCapsule(position: Vector3): {
  mesh: Mesh;
  aggregate: PhysicsAggregate;
} {
  const mesh = MeshBuilder.CreateCapsule(
    "enemyPhys",
    ENEMY_MESH.capsule,
    g.scene,
  );
  mesh.isVisible = false;
  mesh.position = position;
  const aggregate = new PhysicsAggregate(
    mesh,
    PhysicsShapeType.CAPSULE,
    { mass: ENEMY.mass, friction: 0.7, restitution: 0 },
    g.scene,
  );
  aggregate.body.setMassProperties({
    mass: ENEMY.mass,
    inertia: Vector3.Zero(),
    inertiaOrientation: Quaternion.Identity(),
  });
  return { mesh, aggregate };
}

export function makeEnemyBodyMesh(): Mesh {
  const mesh = MeshBuilder.CreateBox("enemyBody", ENEMY_MESH.body, g.scene);
  mesh.position = ENEMY_MESH.bodyOffset.clone();
  return mesh;
}

export function makeEnemyLegMesh(side: "left" | "right"): Mesh {
  const { width, height, depth } = ENEMY_MESH.leg;
  // Pivot node sits at top of leg
  const pivot = new Mesh("enemyLegPivot", g.scene);
  pivot.isPickable = false;
  pivot.position = new Vector3(
    side === "left" ? -ENEMY_MESH.legSpacing : ENEMY_MESH.legSpacing,
    ENEMY_MESH.legOffsetY,
    0,
  );
  const leg = MeshBuilder.CreateBox(
    "enemyLeg",
    { width, height, depth },
    g.scene,
  );
  leg.parent = pivot;
  leg.position = new Vector3(0, -height / 2, 0); // hang down from pivot
  return pivot;
}

export function makeEnemyArmMesh(side: "left" | "right"): Mesh {
  const { width, height, depth } = ENEMY_MESH.arm;
  const pivot = new Mesh("enemyArmPivot", g.scene);
  pivot.isPickable = false;
  pivot.position = new Vector3(
    side === "left" ? -ENEMY_MESH.armSpacing : ENEMY_MESH.armSpacing,
    ENEMY_MESH.armOffsetY,
    0,
  );
  const arm = MeshBuilder.CreateBox(
    "enemyArm",
    { width, height, depth },
    g.scene,
  );
  arm.parent = pivot;
  arm.position = new Vector3(0, -height / 2, 0);
  return pivot;
}

export function makeEnemyHeadMesh(): Mesh {
  const { height, radius } = ENEMY_MESH.head;
  const mesh = MeshBuilder.CreateCapsule(
    "enemyHead",
    { height, radius, capSubdivisions: 6, subdivisions: 1, tessellation: 12 },
    g.scene,
  );
  // Truncate the bottom cap — flatten all vertices below the cutoff
  const cutY = -height / 2 + radius * 0.9;
  const positions = mesh.getVerticesData("position")!;
  for (let i = 1; i < positions.length; i += 3) {
    if (positions[i] < cutY) positions[i] = cutY;
  }
  mesh.setVerticesData("position", positions);
  mesh.position = ENEMY_MESH.headOffset.clone();
  return mesh;
}

// ─── Ragdoll split halves (exported) ─────────────────────────────────────────
export function makeBodySplitHalves(
  worldPos: Vector3,
  mat: StandardMaterial,
): [Mesh, Mesh] {
  const { width, depth } = ENEMY_MESH.body;
  const halfH = ENEMY_MESH.body.height / 2;

  const top = MeshBuilder.CreateBox(
    "bodyHalf",
    { width, height: halfH, depth },
    g.scene,
  );
  top.position = new Vector3(worldPos.x, worldPos.y + halfH / 2, worldPos.z);
  top.material = mat;

  const bottom = MeshBuilder.CreateBox(
    "bodyHalf",
    { width, height: halfH, depth },
    g.scene,
  );
  bottom.position = new Vector3(worldPos.x, worldPos.y - halfH / 2, worldPos.z);
  bottom.material = mat;

  return [top, bottom];
}

export function makeHeadSplitHalves(
  worldPos: Vector3,
  mat: StandardMaterial,
): [Mesh, Mesh] {
  const { height, radius } = ENEMY_MESH.head;
  const halfH = height / 2;

  const top = MeshBuilder.CreateCapsule(
    "headHalf",
    {
      height: halfH,
      radius,
      capSubdivisions: 6,
      subdivisions: 1,
      tessellation: 12,
    },
    g.scene,
  );
  top.position = new Vector3(worldPos.x, worldPos.y + halfH / 4, worldPos.z);
  top.material = mat;

  const bottom = MeshBuilder.CreateCapsule(
    "headHalf",
    {
      height: halfH,
      radius,
      capSubdivisions: 6,
      subdivisions: 1,
      tessellation: 12,
    },
    g.scene,
  );
  bottom.position = new Vector3(worldPos.x, worldPos.y - halfH / 4, worldPos.z);
  bottom.material = mat;

  return [top, bottom];
}

function makeLimbSplitHalves(
  name: string,
  dims: { width: number; height: number; depth: number },
  worldPos: Vector3,
  mat: StandardMaterial,
): [Mesh, Mesh] {
  const halfH = dims.height / 2;
  const top = MeshBuilder.CreateBox(
    name,
    { width: dims.width, height: halfH, depth: dims.depth },
    g.scene,
  );
  top.position = new Vector3(worldPos.x, worldPos.y + halfH / 2, worldPos.z);
  top.material = mat;
  const bottom = MeshBuilder.CreateBox(
    name,
    { width: dims.width, height: halfH, depth: dims.depth },
    g.scene,
  );
  bottom.position = new Vector3(worldPos.x, worldPos.y - halfH / 2, worldPos.z);
  bottom.material = mat;
  return [top, bottom];
}

export function makeArmSplitHalves(
  worldPos: Vector3,
  mat: StandardMaterial,
): [Mesh, Mesh] {
  return makeLimbSplitHalves("armHalf", ENEMY_MESH.arm, worldPos, mat);
}

export function makeLegSplitHalves(
  worldPos: Vector3,
  mat: StandardMaterial,
): [Mesh, Mesh] {
  return makeLimbSplitHalves("legHalf", ENEMY_MESH.leg, worldPos, mat);
}

// ─── Lamppost (exported) ─────────────────────────────────────────────────────
export function setupLamppost(): { pole: Mesh; lightY: number } {
  const lampY = LIGHTING.lampHeight;

  const poleMat = new StandardMaterial("poleMat", g.scene);
  poleMat.diffuseColor = new Color3(0.2, 0.2, 0.22);
  poleMat.specularColor = new Color3(0.4, 0.4, 0.4);

  const pole = MeshBuilder.CreateCylinder(
    "pole",
    { diameter: 0.15, height: lampY },
    g.scene,
  );
  pole.position.y = lampY / 2;
  pole.material = poleMat;
  new PhysicsAggregate(pole, PhysicsShapeType.CYLINDER, { mass: 0 }, g.scene);

  const head = MeshBuilder.CreateCylinder(
    "lampHead",
    { diameterTop: 0.1, diameterBottom: 0.8, height: 0.4, tessellation: 8 },
    g.scene,
  );
  head.position.y = lampY - 0.2;
  head.material = poleMat;

  const bulbMat = new StandardMaterial("bulbMat", g.scene);
  bulbMat.diffuseColor = new Color3(1, 0.9, 0.7);
  bulbMat.emissiveColor = new Color3(1, 0.85, 0.5);
  const bulb = MeshBuilder.CreateSphere("bulb", { diameter: 0.3 }, g.scene);
  bulb.position.y = lampY - 0.4;
  bulb.material = bulbMat;

  return { pole, lightY: lampY - 0.3 };
}

// ─── Supplies (exported) ──────────────────────────────────────────────────────
export function makeHealthSupply(position: Vector3): {
  mesh: Mesh;
  aggregate: PhysicsAggregate;
} {
  const mat = new StandardMaterial("supplyMat", g.scene);
  mat.diffuseColor = new Color3(0.1, 0.9, 0.2);
  mat.emissiveColor = new Color3(0.1, 0.6, 0.1);
  const mesh = MeshBuilder.CreateSphere("supply", { diameter: 0.4 }, g.scene);
  mesh.position = position.clone();
  mesh.position.y = Math.max(mesh.position.y, 0.3);
  mesh.material = mat;
  mesh.isPickable = false;
  const aggregate = new PhysicsAggregate(
    mesh,
    PhysicsShapeType.BOX,
    { mass: 1, friction: 0.8, restitution: 0.2 },
    g.scene,
  );
  return { mesh, aggregate };
}

export function makeAmmoSupply(position: Vector3): {
  mesh: Mesh;
  aggregate: PhysicsAggregate;
} {
  const mat = new StandardMaterial("supplyMat", g.scene);
  mat.diffuseColor = WEAPON.cell.diffuse.clone();
  mat.emissiveColor = WEAPON.cell.emissive.clone();
  const s = WEAPON.cell.size;
  const mesh = MeshBuilder.CreateBox(
    "supply",
    { width: s.width * 4, height: s.height * 4, depth: s.depth * 4 },
    g.scene,
  );
  mesh.position = position.clone();
  mesh.position.y = Math.max(mesh.position.y, 0.3);
  mesh.material = mat;
  mesh.isPickable = false;
  const aggregate = new PhysicsAggregate(
    mesh,
    PhysicsShapeType.BOX,
    { mass: 1, friction: 0.8, restitution: 0.2 },
    g.scene,
  );
  return { mesh, aggregate };
}

// ─── Laser beam (exported) ────────────────────────────────────────────────────
export function makeBeam(from: Vector3, to: Vector3): Mesh {
  const mat = new StandardMaterial("laserMat", g.scene);
  mat.diffuseColor = LASER_BEAM.diffuse;
  mat.emissiveColor = LASER_BEAM.emissive;
  mat.disableLighting = true;
  const beam = MeshBuilder.CreateTube(
    "laserBeam",
    {
      path: [from, to],
      radius: LASER_BEAM.radius,
      tessellation: LASER_BEAM.tessellation,
      updatable: false,
      cap: 0,
    },
    g.scene,
  );
  beam.material = mat;
  beam.isPickable = false;
  return beam;
}

// ─── Ragdoll physics helpers (exported) ──────────────────────────────────────
export function makeRagdollBodyAggregate(mesh: Mesh): PhysicsAggregate {
  return new PhysicsAggregate(
    mesh,
    PhysicsShapeType.BOX,
    { mass: 8, friction: 0.6, restitution: 0.05 },
    g.scene,
  );
}

export function makeRagdollHeadAggregate(mesh: Mesh): PhysicsAggregate {
  return new PhysicsAggregate(
    mesh,
    PhysicsShapeType.CAPSULE,
    { mass: 2, friction: 0.5, restitution: 0.3 },
    g.scene,
  );
}

export function makeRagdollArmAggregate(mesh: Mesh): PhysicsAggregate {
  return new PhysicsAggregate(
    mesh,
    PhysicsShapeType.BOX,
    { mass: 1, friction: 0.6, restitution: 0.05 },
    g.scene,
  );
}

export function makeRagdollLegAggregate(mesh: Mesh): PhysicsAggregate {
  return new PhysicsAggregate(
    mesh,
    PhysicsShapeType.BOX,
    { mass: 2, friction: 0.6, restitution: 0.05 },
    g.scene,
  );
}

export function makeRagdollHalfAggregate(
  mesh: Mesh,
  mass: number,
): PhysicsAggregate {
  return new PhysicsAggregate(
    mesh,
    PhysicsShapeType.BOX,
    { mass, friction: 0.6, restitution: 0.05 },
    g.scene,
  );
}

// ─── Bullet hole (exported) ───────────────────────────────────────────────────
const BULLET_HOLE_SURFACE_OFFSET = BULLET_HOLE_STYLE.surfaceOffset;
const SURFACE_MARK_Z_OFFSET = -2;
const SURFACE_MARK_Z_OFFSET_UNITS = -2;

function makeMaskedMarkMaterial(
  name: string,
  color: Color3,
  width: number,
  height: number,
): StandardMaterial {
  const tex = new DynamicTexture(`${name}Mask`, { width, height }, g.scene);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(width * 0.45, height * 0.45);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  tex.hasAlpha = true;
  tex.update(false);

  const mat = new StandardMaterial(name, g.scene);
  mat.diffuseColor = color;
  mat.emissiveColor = color;
  mat.specularColor = Color3.Black();
  mat.opacityTexture = tex;
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mat.zOffset = SURFACE_MARK_Z_OFFSET;
  mat.zOffsetUnits = SURFACE_MARK_Z_OFFSET_UNITS;
  return mat;
}

export function makeBulletHoleDisc(): Mesh {
  const disc = MeshBuilder.CreateDisc(
    "bhole",
    {
      radius: BULLET_HOLE_STYLE.radius,
      tessellation: BULLET_HOLE_STYLE.tessellation,
    },
    g.scene,
  );
  disc.material = makeMaskedMarkMaterial(
    "bholeMat",
    BULLET_HOLE_STYLE.emissive,
    64,
    64,
  );
  disc.isPickable = false;
  return disc;
}

// ─── Plasma projectile (exported) ───────────────────────────────────────────
export function makePlasmaMesh(pos: Vector3): Mesh {
  const mat = new StandardMaterial("plasmaMat", g.scene);
  mat.diffuseColor = new Color3(0, 1, 1);
  mat.emissiveColor = new Color3(0, 0.9, 1);
  mat.disableLighting = true;
  const mesh = MeshBuilder.CreateSphere(
    "plasma",
    { diameter: PLASMA.radius * 2, segments: 8 },
    g.scene,
  );
  mesh.material = mat;
  mesh.position = pos.clone();
  mesh.isPickable = false;
  return mesh;
}

export function makePlasmaChargeMesh(): Mesh {
  const mat = new StandardMaterial("plasmaChargeMat", g.scene);
  mat.diffuseColor = new Color3(0, 1, 1);
  mat.emissiveColor = new Color3(0, 0.9, 1);
  mat.disableLighting = true;
  mat.alpha = 0.5;
  const mesh = MeshBuilder.CreateSphere(
    "plasmaCharge",
    { diameter: PLASMA.radius * 2, segments: 8 },
    g.scene,
  );
  mesh.material = mat;
  mesh.renderingGroupId = 1;
  mesh.parent = g.barrelTip;
  mesh.position.setAll(0);
  mesh.isPickable = false;
  return mesh;
}

export function makeRifleTracerMesh(
  pos: Vector3,
  dir: Vector3,
  isCrit: boolean,
): Mesh {
  const mat = new StandardMaterial("rifleTracerMat", g.scene);
  mat.diffuseColor = isCrit ? new Color3(0.6, 0, 1) : new Color3(1, 0.9, 0.2);
  mat.emissiveColor = isCrit
    ? new Color3(0.5, 0, 0.9)
    : new Color3(1, 0.85, 0.1);
  const mesh = MeshBuilder.CreateBox(
    "rifleTracer",
    {
      width: RIFLE.tracerWidth,
      height: RIFLE.tracerWidth,
      depth: RIFLE.tracerLength,
    },
    g.scene,
  );
  mesh.material = mat;
  mesh.position = pos.clone();
  mesh.isPickable = false;
  mesh.renderingGroupId = 1;
  mesh.rotationQuaternion = Quaternion.FromLookDirectionLH(
    dir.normalizeToNew(),
    Vector3.Up(),
  );
  return mesh;
}

export function spawnRifleMuzzleFlash(isCrit: boolean): void {
  const scopedFlash =
    g.rifleScoped && g.upgrades.rifleScope && g.rifleScopeAimT >= 0.995;

  const flash = MeshBuilder.CreateSphere(
    "rifleMuzzleFlash",
    { diameter: scopedFlash ? 0.08 : 0.3, segments: 6 },
    g.scene,
  );
  const mat = new StandardMaterial("rifleMuzzleFlashMat", g.scene);
  mat.diffuseColor = isCrit
    ? new Color3(0.7, 0.2, 1)
    : new Color3(1, 0.9, 0.25);
  mat.emissiveColor = isCrit
    ? new Color3(0.6, 0.1, 0.95)
    : new Color3(1, 0.75, 0.15);
  mat.alpha = 0.95;
  flash.material = mat;
  flash.parent = scopedFlash ? g.camera : g.rifleBarrelTip;
  flash.position = scopedFlash
    ? new Vector3(
        0,
        RIFLE.MUZZLE_FLASH.scopedCameraOffsetY,
        RIFLE.MUZZLE_FLASH.scopedCameraOffsetZ,
      )
    : Vector3.Zero();
  flash.isPickable = false;
  flash.renderingGroupId = 1;

  const flashScale = g.upgrades.muzzleBrake ? RIFLE.MUZZLE_BRAKE.flashScale : 1;

  const start = performance.now();
  const obs = g.scene.onBeforeRenderObservable.add(() => {
    const t = Math.min((performance.now() - start) / 60, 1);
    flash.scaling.setAll(
      (RIFLE.MUZZLE_FLASH.baseScale + t * RIFLE.MUZZLE_FLASH.expandScale) *
        flashScale,
    );
    mat.alpha = 0.95 * (1 - t);
    if (t >= 1) {
      g.scene.onBeforeRenderObservable.remove(obs);
      flash.dispose();
      mat.dispose();
    }
  });
}

// ─── Spawn functions (moved from update.ts) ─────────────────────────────────

export function spawnEnemy(): void {
  const playerPos = g.playerMesh.position;
  let x: number, z: number;
  do {
    x = (Math.random() * 2 - 1) * (ARENA.size / 2 - 2);
    z = (Math.random() * 2 - 1) * (ARENA.size / 2 - 2);
  } while (
    (x - playerPos.x) ** 2 + (z - playerPos.z) ** 2 <
    ENEMY.minSpawnDist ** 2
  );

  const { mesh: physMesh, aggregate } = makeEnemyPhysCapsule(
    new Vector3(x, ARENA.ceil - 0.5, z),
  );

  const { bodyMat, headMat } = makeEnemyMats();

  const visualRoot = new Mesh("enemyVisual", g.scene);
  visualRoot.parent = physMesh;
  visualRoot.isVisible = false;
  visualRoot.isPickable = false;

  const bodyMesh = makeEnemyBodyMesh();
  bodyMesh.parent = visualRoot;
  bodyMesh.material = bodyMat;

  const head = makeEnemyHeadMesh();
  head.parent = visualRoot;
  head.material = headMat;

  const leftLeg = makeEnemyLegMesh("left");
  leftLeg.parent = visualRoot;
  const leftLegBox = leftLeg.getChildMeshes()[0] as Mesh;
  leftLegBox.material = bodyMat;

  const rightLeg = makeEnemyLegMesh("right");
  rightLeg.parent = visualRoot;
  const rightLegBox = rightLeg.getChildMeshes()[0] as Mesh;
  rightLegBox.material = bodyMat;

  const leftArm = makeEnemyArmMesh("left");
  leftArm.parent = visualRoot;
  const leftArmBox = leftArm.getChildMeshes()[0] as Mesh;
  leftArmBox.material = bodyMat;

  const rightArm = makeEnemyArmMesh("right");
  rightArm.parent = visualRoot;
  const rightArmBox = rightArm.getChildMeshes()[0] as Mesh;
  rightArmBox.material = bodyMat;

  g.shadowGenerator.addShadowCaster(bodyMesh);
  g.shadowGenerator.addShadowCaster(head);
  g.shadowGenerator.addShadowCaster(leftLegBox);
  g.shadowGenerator.addShadowCaster(rightLegBox);
  g.shadowGenerator.addShadowCaster(leftArmBox);
  g.shadowGenerator.addShadowCaster(rightArmBox);

  g.enemies.push({
    physMesh,
    visualRoot,
    bodyMesh,
    headMesh: head,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    aggregate,
    hp: ENEMY.hp + ENEMY.hpPerWave * (g.state.wave - 1),
    maxHp: ENEMY.hp + ENEMY.hpPerWave * (g.state.wave - 1),
    speed: ENEMY.speed + ENEMY.speedPerWave * (g.state.wave - 1),
    state: "patrol",
    patrolTarget: physMesh.position.clone(),
    attackCooldown: 0,
    meleeDamage:
      ENEMY.meleeDamage + ENEMY.meleeDamagePerWave * (g.state.wave - 1),
    meleeIntervalMs:
      60000 /
      (ENEMY.meleeAttacksPerMin +
        ENEMY.meleeAttacksPerMinPerWave * (g.state.wave - 1)),
    zigzagTimer: Math.random() * Math.PI * 2,
    flashTime: 0,
    flashMesh: null,
    baseEmissive: bodyMat.diffuseColor.scale(0.2),
    walkPhase: Math.random() * Math.PI * 2,
    lastFootLeft: false,
    facingYaw: Math.random() * Math.PI * 2,
    attackAnimTime: 0,
    onFire: false,
    fireParticle: null,
    fireLight: null,
    fireAudioSource: null,
    fireAudioPanner: null,
    fireAudioGain: null,
    fireSpreadTimer: 0,
    fireDmgAccum: 0,
    healthBarPlane: null,
    healthBarTexture: null,
    healthBarFill: null,
  });
  const enemy = g.enemies[g.enemies.length - 1];
  createEnemyHealthBar(enemy);
  playEnemySpawnSound(new Vector3(x, ARENA.ceil - 0.5, z));
}

export function spawnSupply(
  position: Vector3,
  forceType?: "health" | "ammo",
): void {
  const type = forceType ?? (Math.random() < 0.5 ? "health" : "ammo");
  const { mesh, aggregate } =
    type === "health" ? makeHealthSupply(position) : makeAmmoSupply(position);
  g.supplies.push({ mesh, aggregate, type });
}

export function spawnPlasma(
  pos: Vector3,
  dir: Vector3,
  chargeMultiplier: number,
  heatPenalty: number,
  isCrit: boolean,
  hasGravity: boolean,
  ricochetDepth: number,
): void {
  const mesh = makePlasmaMesh(pos);
  mesh.scaling.setAll(chargeMultiplier);
  const plasmaMat = mesh.material as StandardMaterial;
  if (isCrit) {
    plasmaMat.diffuseColor = new Color3(0.6, 0, 1);
    plasmaMat.emissiveColor = new Color3(0.5, 0, 0.9);
  }
  if (heatPenalty < 1) {
    const t = 1 - heatPenalty;
    plasmaMat.alpha = 1 - t * 0.6;
    plasmaMat.emissiveColor = Color3.Lerp(
      plasmaMat.emissiveColor,
      new Color3(0.2, 0.3, 0.3),
      t,
    );
  }
  g.plasmas.push({
    mesh,
    velocity: dir.scale(PLASMA.speed / chargeMultiplier),
    age: 0,
    heatPenalty,
    chargeMultiplier,
    isCrit,
    hasGravity,
    ricochetDepth,
  });
}

// ─── Visual effects (moved from update.ts) ──────────────────────────────────

export function spawnLightningBolt(
  from: Vector3,
  to: Vector3,
  isCrit = false,
): void {
  const segments = 8;
  const path: Vector3[] = [from.clone()];
  const dir = to.subtract(from);
  const dist = dir.length();
  const step = dir.scale(1 / segments);
  const perp1 = Vector3.Cross(dir, new Vector3(1, 0, 0));
  if (perp1.lengthSquared() < 0.01)
    perp1.copyFrom(Vector3.Cross(dir, new Vector3(0, 0, 1)));
  perp1.normalize();
  const perp2 = Vector3.Cross(dir, perp1).normalize();
  for (let i = 1; i < segments; i++) {
    const jitter = dist * 0.08;
    path.push(
      from
        .add(step.scale(i))
        .add(perp1.scale((Math.random() - 0.5) * jitter))
        .add(perp2.scale((Math.random() - 0.5) * jitter)),
    );
  }
  path.push(to.clone());

  const bolt = MeshBuilder.CreateTube(
    "lightning",
    { path, radius: 0.03, tessellation: 4, updatable: false, cap: 0 },
    g.scene,
  );
  const mat = new StandardMaterial("lightningMat", g.scene);
  mat.diffuseColor = isCrit ? new Color3(0.6, 0, 1) : new Color3(0.5, 0.7, 1);
  mat.emissiveColor = isCrit
    ? new Color3(0.5, 0, 0.9)
    : new Color3(0.6, 0.8, 1);
  mat.disableLighting = true;
  bolt.material = mat;
  bolt.isPickable = false;
  setTimeout(() => bolt.dispose(), 150);
}

export function spawnExplosionParticle(
  position: Vector3,
  isCrit = false,
): void {
  const ps = new ParticleSystem("explosion", 120, g.scene);
  ps.particleTexture = g.particleTex;
  ps.emitter = position;
  ps.minEmitBox = new Vector3(-0.3, -0.3, -0.3);
  ps.maxEmitBox = new Vector3(0.3, 0.3, 0.3);
  ps.color1 = isCrit ? new Color4(0.7, 0.1, 1, 1) : new Color4(0, 1, 1, 1);
  ps.color2 = isCrit
    ? new Color4(0.4, 0, 0.8, 0.8)
    : new Color4(0, 0.5, 1, 0.8);
  ps.colorDead = isCrit
    ? new Color4(0.15, 0, 0.2, 0)
    : new Color4(0.1, 0.15, 0.2, 0);
  ps.minSize = 0.15;
  ps.maxSize = 0.5;
  ps.minLifeTime = 0.3;
  ps.maxLifeTime = 0.8;
  ps.emitRate = 800;
  ps.minEmitPower = 5;
  ps.maxEmitPower = 15;
  ps.direction1 = new Vector3(-1, -1, -1);
  ps.direction2 = new Vector3(1, 1, 1);
  ps.gravity = new Vector3(0, -10, 0);
  ps.updateSpeed = 0.02;
  ps.start();
  setTimeout(() => ps.stop(), 100);
  setTimeout(() => ps.dispose(false), 1200);
}

export function spawnDeathParticle(position: Vector3): void {
  const ps = new ParticleSystem("death", 80, g.scene);
  ps.particleTexture = g.particleTex;
  ps.emitter = position;
  ps.minEmitBox = new Vector3(-0.3, -0.3, -0.3);
  ps.maxEmitBox = new Vector3(0.3, 0.3, 0.3);
  ps.color1 = new Color4(1, 0.1, 0.0, 1);
  ps.color2 = new Color4(0.6, 0.0, 0.0, 0.8);
  ps.colorDead = new Color4(0, 0, 0, 0);
  ps.minSize = 0.1;
  ps.maxSize = 0.3;
  ps.minLifeTime = 0.3;
  ps.maxLifeTime = 0.9;
  ps.emitRate = 600;
  ps.minEmitPower = 4;
  ps.maxEmitPower = 10;
  ps.direction1 = new Vector3(-1, -1, -1);
  ps.direction2 = new Vector3(1, 1, 1);
  ps.gravity = new Vector3(0, -15, 0);
  ps.updateSpeed = 0.02;
  ps.start();
  setTimeout(() => ps.stop(), 100);
  setTimeout(() => ps.dispose(false), 1200);
}

export function spawnHitParticle(
  position: Vector3,
  color: Color4,
  normal: Vector3,
): void {
  const ps = new ParticleSystem("hit", 40, g.scene);
  ps.particleTexture = g.particleTex;
  ps.emitter = position;
  ps.minEmitBox = new Vector3(-0.05, -0.05, -0.05);
  ps.maxEmitBox = new Vector3(0.05, 0.05, 0.05);
  ps.color1 = color;
  ps.color2 = new Color4(color.r, color.g, color.b, 0.5);
  ps.colorDead = new Color4(0, 0, 0, 0);
  ps.minSize = 0.04;
  ps.maxSize = 0.12;
  ps.minLifeTime = 0.1;
  ps.maxLifeTime = 0.4;
  ps.emitRate = 400;
  ps.minEmitPower = 3;
  ps.maxEmitPower = 7;

  const n = normal.normalize();
  const perp = (
    Math.abs(n.x) < 0.9
      ? Vector3.Cross(n, new Vector3(1, 0, 0))
      : Vector3.Cross(n, new Vector3(0, 1, 0))
  ).normalize();
  const perp2 = Vector3.Cross(n, perp);
  ps.direction1 = n.subtract(perp).subtract(perp2);
  ps.direction2 = n.add(perp).add(perp2);

  ps.gravity = new Vector3(0, -12, 0);
  ps.updateSpeed = 0.02;
  ps.start();
  setTimeout(() => ps.stop(), 80);
  setTimeout(() => ps.dispose(false), 600);
}

export function spawnBayonetBloodDrip(position: Vector3): void {
  const ps = new ParticleSystem("bayonetBlood", 28, g.scene);
  ps.particleTexture = g.particleTex;
  ps.emitter = position.clone();
  ps.minEmitBox = new Vector3(-0.025, -0.01, -0.025);
  ps.maxEmitBox = new Vector3(0.025, 0.01, 0.025);
  ps.color1 = new Color4(0.85, 0.0, 0.0, 1);
  ps.color2 = new Color4(0.35, 0.0, 0.0, 0.85);
  ps.colorDead = new Color4(0.08, 0, 0, 0);
  ps.minSize = 0.035;
  ps.maxSize = 0.08;
  ps.minLifeTime = 0.45;
  ps.maxLifeTime = 0.9;
  ps.emitRate = 90;
  ps.minEmitPower = 0.15;
  ps.maxEmitPower = 0.55;
  ps.direction1 = new Vector3(-0.1, -1, -0.1);
  ps.direction2 = new Vector3(0.1, -0.55, 0.1);
  ps.gravity = new Vector3(0, -9, 0);
  ps.updateSpeed = 0.02;
  ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  ps.start();
  setTimeout(() => ps.stop(), 260);
  setTimeout(() => ps.dispose(false), 1200);
}

export function spawnBayonetBloodBurst(position: Vector3): void {
  const ps = new ParticleSystem("bayonetBloodBurst", 110, g.scene);
  ps.particleTexture = g.particleTex;
  ps.emitter = position.clone();
  ps.minEmitBox = new Vector3(-0.035, -0.035, -0.035);
  ps.maxEmitBox = new Vector3(0.035, 0.035, 0.035);
  ps.color1 = new Color4(1, 0.02, 0.0, 1);
  ps.color2 = new Color4(0.45, 0.0, 0.0, 0.9);
  ps.colorDead = new Color4(0.05, 0, 0, 0);
  ps.minSize = 0.035;
  ps.maxSize = 0.13;
  ps.minLifeTime = 0.25;
  ps.maxLifeTime = 0.85;
  ps.emitRate = 1600;
  ps.minEmitPower = 4;
  ps.maxEmitPower = 12;
  ps.direction1 = new Vector3(-1, -1, -1);
  ps.direction2 = new Vector3(1, 1, 1);
  ps.gravity = new Vector3(0, -14, 0);
  ps.updateSpeed = 0.02;
  ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  ps.start();
  setTimeout(() => ps.stop(), 85);
  setTimeout(() => ps.dispose(false), 1200);
}

export function spawnBayonetGash(
  position: Vector3,
  normal: Vector3 | null,
  parentMesh: Mesh,
): void {
  const n = normal?.normalizeToNew() ?? Vector3.Up();
  const gash = MeshBuilder.CreateDecal("bayonetGash", parentMesh, {
    position: position.add(n.scale(BULLET_HOLE_SURFACE_OFFSET * 1.4)),
    normal: n,
    size: new Vector3(0.09, 0.42, 0.08),
    localMode: true,
  });
  const mat = makeMaskedMarkMaterial(
    "bayonetGashMat",
    new Color3(0.24, 0, 0),
    32,
    128,
  );
  gash.material = mat;
  gash.isPickable = false;
}

export function spawnSmokeParticles(): void {
  const emitPos = g.barrelTip.getAbsolutePosition().clone();
  const ps = new ParticleSystem("smoke", 50, g.scene);
  ps.particleTexture = g.particleTex;
  ps.emitter = emitPos;
  ps.minEmitBox = new Vector3(-0.01, -0.01, -0.01);
  ps.maxEmitBox = new Vector3(0.01, 0.01, 0.01);
  ps.minSize = 0.02;
  ps.maxSize = 0.08;
  ps.minLifeTime = 0.5;
  ps.maxLifeTime = 1.2;
  ps.emitRate = 50;
  ps.direction1 = new Vector3(-0.02, 0.3, -0.02);
  ps.direction2 = new Vector3(0.02, 0.6, 0.02);
  ps.minEmitPower = 0.2;
  ps.maxEmitPower = 0.5;
  ps.color1 = new Color4(0.6, 0.6, 0.6, 0.5);
  ps.color2 = new Color4(0.35, 0.35, 0.35, 0.3);
  ps.colorDead = new Color4(0.1, 0.1, 0.1, 0);
  ps.gravity = new Vector3(0, 0.4, 0);
  ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  ps.renderingGroupId = 1;
  ps.start();
  const obs = g.scene.onBeforeRenderObservable.add(() => {
    const p = g.barrelTip.getAbsolutePosition();
    emitPos.x = p.x;
    emitPos.y = p.y;
    emitPos.z = p.z;
  });
  setTimeout(() => {
    ps.stop();
    setTimeout(() => {
      ps.dispose(false);
      g.scene.onBeforeRenderObservable.remove(obs);
    }, 1500);
  }, 1500);
}

// ─── Enemy Health Bar (3D GUI — world space) ──────────────────────────────
function createEnemyHealthBar(enemy: import("./game.js").Enemy): void {
  const plane = MeshBuilder.CreatePlane(
    "hpBarPlane",
    {
      width: ENEMY_HEALTH_BAR.width,
      height: ENEMY_HEALTH_BAR.height,
    },
    g.scene,
  );
  plane.parent = enemy.physMesh;
  plane.position.y = ENEMY_HEALTH_BAR.offsetY;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;

  const tex = AdvancedDynamicTexture.CreateForMesh(
    plane,
    ENEMY_HEALTH_BAR.texW,
    ENEMY_HEALTH_BAR.texH,
  );

  const bg = new Rectangle("hpBg");
  bg.background = ENEMY_HEALTH_BAR.bgColor;
  bg.color = "transparent";
  bg.thickness = 0;
  bg.width = 1;
  bg.height = 1;
  tex.addControl(bg);

  const fill = new Rectangle("hpFill");
  fill.background = ENEMY_HEALTH_BAR.color;
  fill.color = "transparent";
  fill.thickness = 0;
  fill.width = 1;
  fill.height = 1;
  fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  tex.addControl(fill);

  enemy.healthBarPlane = plane;
  enemy.healthBarTexture = tex;
  enemy.healthBarFill = fill;
  // Hidden at full health
  plane.setEnabled(false);
}

export function disposeEnemyHealthBar(enemy: import("./game.js").Enemy): void {
  if (enemy.healthBarPlane) {
    if (enemy.healthBarTexture) {
      enemy.healthBarTexture.dispose();
      enemy.healthBarTexture = null;
    }
    enemy.healthBarPlane.dispose();
    enemy.healthBarPlane = null;
    enemy.healthBarFill = null;
  }
}

export function updateEnemyHealthBar(enemy: import("./game.js").Enemy): void {
  if (!enemy.healthBarFill || !enemy.healthBarPlane) return;
  const frac = Math.max(0, enemy.hp / enemy.maxHp);
  enemy.healthBarFill.width = frac;
  enemy.healthBarPlane.setEnabled(frac < 1);
}

export function spawnDamageNumber(
  position: Vector3,
  amount: number,
  isCrit: boolean,
): void {
  const plane = MeshBuilder.CreatePlane(
    "dmgPlane",
    { width: 1.2, height: 0.4 },
    g.scene,
  );
  plane.position = position.clone();
  plane.position.y += 0.5;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;

  const tex = AdvancedDynamicTexture.CreateForMesh(plane, 120, 40);

  const text = new TextBlock();
  text.text = String(Math.round(amount));
  text.color = isCrit ? "#cc44ff" : "#ff4444";
  text.fontSize = isCrit ? 36 : 28;
  text.fontWeight = "bold";
  text.outlineWidth = 3;
  text.outlineColor = "#000000";
  tex.addControl(text);

  const startY = plane.position.y;
  const duration = 800;
  const startTime = performance.now();
  const obs = g.scene.onBeforeRenderObservable.add(() => {
    const t = Math.min((performance.now() - startTime) / duration, 1);
    plane.position.y = startY + t * 1.5;
    plane.visibility = 1 - t;
    if (t >= 1) {
      g.scene.onBeforeRenderObservable.remove(obs);
      tex.dispose();
      plane.dispose();
    }
  });
}

export function spawnFireEffect(enemy: import("./game.js").Enemy): void {
  const emitPos = enemy.bodyMesh.getAbsolutePosition().clone();
  const ps = new ParticleSystem("fire", 60, g.scene);
  ps.particleTexture = g.particleTex;
  ps.emitter = emitPos;
  ps.minEmitBox = new Vector3(-0.25, -0.3, -0.25);
  ps.maxEmitBox = new Vector3(0.25, 0.5, 0.25);
  ps.color1 = new Color4(1, 0.6, 0.1, 1);
  ps.color2 = new Color4(1, 0.2, 0.0, 0.8);
  ps.colorDead = new Color4(0.2, 0.2, 0.2, 0);
  ps.minSize = 0.08;
  ps.maxSize = 0.25;
  ps.minLifeTime = 0.2;
  ps.maxLifeTime = 0.6;
  ps.emitRate = 80;
  ps.minEmitPower = 0.5;
  ps.maxEmitPower = 2;
  ps.direction1 = new Vector3(-0.3, 0.5, -0.3);
  ps.direction2 = new Vector3(0.3, 1.5, 0.3);
  ps.gravity = new Vector3(0, 2, 0);
  ps.updateSpeed = 0.02;
  ps.start();

  const light = new PointLight("fireLight", emitPos.clone(), g.scene);
  light.diffuse = new Color3(1, 0.5, 0.1);
  light.intensity = 1.5;
  light.range = 5;

  enemy.fireParticle = ps;
  enemy.fireLight = light;

  const audio = startFireSound(emitPos);
  enemy.fireAudioSource = audio.source;
  enemy.fireAudioPanner = audio.panner;
  enemy.fireAudioGain = audio.gain;

  // Track enemy position each frame
  const obs = g.scene.onBeforeRenderObservable.add(() => {
    if (enemy.fireParticle !== ps) {
      g.scene.onBeforeRenderObservable.remove(obs);
      return;
    }
    const p = enemy.bodyMesh.getAbsolutePosition();
    emitPos.x = p.x;
    emitPos.y = p.y;
    emitPos.z = p.z;
    light.position.copyFrom(p);
    // Flicker
    light.intensity = 1.2 + Math.random() * 0.6;
    // Update audio position
    if (enemy.fireAudioPanner) {
      enemy.fireAudioPanner.positionX.value = p.x;
      enemy.fireAudioPanner.positionY.value = p.y;
      enemy.fireAudioPanner.positionZ.value = p.z;
    }
  });
}

export function disposeFireEffect(enemy: import("./game.js").Enemy): void {
  if (enemy.fireParticle) {
    enemy.fireParticle.stop();
    enemy.fireParticle.dispose(false);
    enemy.fireParticle = null;
  }
  if (enemy.fireLight) {
    enemy.fireLight.dispose();
    enemy.fireLight = null;
  }
  if (enemy.fireAudioSource) {
    if (enemy.fireAudioGain) {
      stopFireSound(enemy.fireAudioSource, enemy.fireAudioGain);
    } else {
      try {
        enemy.fireAudioSource.stop();
      } catch (_) {
        /* already stopped */
      }
    }
    enemy.fireAudioSource = null;
    enemy.fireAudioPanner = null;
    enemy.fireAudioGain = null;
  }
  enemy.onFire = false;
}

export function spawnLaserBeam(
  from: Vector3,
  to: Vector3,
  isCrit = false,
): void {
  const dist = Vector3.Distance(from, to);
  if (dist < 0.05) return;

  playLaserSound((effectiveCooldown() * 0.6) / 1000);

  const beam = makeBeam(from, to);
  const mat = beam.material as StandardMaterial;
  if (isCrit) {
    mat.diffuseColor = new Color3(0.6, 0, 1);
    mat.emissiveColor = new Color3(0.5, 0, 0.9);
  }
  const beamHeatMax = effectiveHeatMax();
  const critHeat = beamHeatMax * HEAT.critical;
  if (g.state.heat >= critHeat) {
    const t = (g.state.heat - critHeat) / (beamHeatMax - critHeat);
    mat.alpha = 1 - t * 0.6;
    mat.emissiveColor = Color3.Lerp(
      mat.emissiveColor,
      new Color3(0.2, 0.3, 0.3),
      t,
    );
  }
  setTimeout(() => beam.dispose(), effectiveCooldown() * 0.6);
}

export function spawnBulletHole(
  position: Vector3,
  normal: Vector3 | null,
  parentMesh?: Mesh,
  opts?: {
    color?: Color3;
    glow?: boolean;
  },
): void {
  if (!parentMesh && g.bulletHoles.length >= 200) {
    g.bulletHoles.shift()!.dispose();
    g.bulletHoleTimes.shift();
  }

  const disc = makeBulletHoleDisc();
  const mat = disc.material as StandardMaterial;
  const color = opts?.color;
  if (color) {
    mat.diffuseColor = color;
    mat.disableLighting = true;
    mat.emissiveColor = color;
    mat.specularColor = Color3.Black();
  } else {
    mat.emissiveColor = new Color3(1, 0.9, 0.2);
  }
  const n = normal ?? Vector3.Up();
  const worldPos = position.add(n.scale(BULLET_HOLE_SURFACE_OFFSET));

  if (parentMesh) {
    const decal = MeshBuilder.CreateDecal("bhole", parentMesh, {
      position: worldPos,
      normal: n.normalizeToNew(),
      size: new Vector3(
        BULLET_HOLE_STYLE.radius * 2,
        BULLET_HOLE_STYLE.radius * 2,
        0.05,
      ),
      localMode: true,
    });
    decal.material = mat;
    decal.isPickable = false;
    disc.dispose();
    if (opts?.glow !== false) {
      g.glowingHoles.push({ mesh: decal, time: BULLET_HOLE.glowMs });
    }
    return;
  } else {
    disc.position = worldPos;
    disc.lookAt(position.add(n));
    g.bulletHoles.push(disc);
    g.bulletHoleTimes.push(60_000);
  }
  if (opts?.glow !== false) {
    g.glowingHoles.push({ mesh: disc, time: BULLET_HOLE.glowMs });
  }
}

// ─── Kill / Ragdoll (moved from update.ts) ──────────────────────────────────

export function killEnemy(
  enemy: Enemy,
  killMesh: Mesh,
  hitPoint?: Vector3,
  orbKill = false,
  intactKill = false,
): void {
  const bodyWorldPos = enemy.bodyMesh.getAbsolutePosition().clone();
  playEnemyDeathSound(bodyWorldPos);
  const headWorldPos = enemy.headMesh.getAbsolutePosition().clone();
  const isHeadshot = killMesh.name === "enemyHead";

  spawnDeathParticle(isHeadshot ? headWorldPos : bodyWorldPos);

  if (enemy.flashMesh) {
    (enemy.flashMesh.material as StandardMaterial).emissiveColor =
      enemy.baseEmissive.clone();
    enemy.flashMesh = null;
  }

  // Clean up fire effects and health bar
  const wasBurning = enemy.onFire;
  disposeFireEffect(enemy);
  disposeEnemyHealthBar(enemy);

  // Blacken body parts if enemy died while on fire
  const blacken = (mat: StandardMaterial) => {
    if (!wasBurning) return;
    mat.diffuseColor = new Color3(0.05, 0.05, 0.05);
    mat.emissiveColor = new Color3(0.08, 0.03, 0.0);
    mat.specularColor = new Color3(0.02, 0.02, 0.02);
  };

  const awayDir = hitPoint
    ? new Vector3(
        bodyWorldPos.x - hitPoint.x,
        0,
        bodyWorldPos.z - hitPoint.z,
      ).normalizeToNew()
    : new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalizeToNew();

  if (awayDir.lengthSquared() < 0.01) {
    awayDir.copyFrom(new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5));
    awayDir.normalize();
  }

  const finishKill = () => {
    g.state.kills++;
    incrementScore(
      isHeadshot ? Math.round(SCORING.kill * 1.5) : SCORING.kill,
      hitPoint,
    );
  };

  const bayonetEmbed = g.bayonetEmbed;
  if (bayonetEmbed?.enemy === enemy) {
    const enemyIndex = g.enemies.indexOf(enemy);

    if (wasBurning) {
      for (const mesh of [
        enemy.bodyMesh,
        enemy.headMesh,
        ...enemy.visualRoot.getChildMeshes(),
      ]) {
        const mat = mesh.material;
        if (mat instanceof StandardMaterial) blacken(mat);
      }
    }

    enemy.physMesh.position.copyFrom(bayonetEmbed.pinPosition);
    enemy.aggregate.body.setTargetTransform(
      bayonetEmbed.pinPosition,
      Quaternion.Identity(),
    );
    enemy.aggregate.body.setLinearVelocity(Vector3.Zero());
    enemy.aggregate.body.setAngularVelocity(Vector3.Zero());
    enemy.visualRoot.rotationQuaternion =
      bayonetEmbed.targetVisualRotation.clone();
    enemy.leftLeg.rotation.x = 0.18;
    enemy.rightLeg.rotation.x = -0.14;
    enemy.leftLeg.rotation.z = 0.22;
    enemy.rightLeg.rotation.z = -0.22;
    enemy.leftArm.rotation.x = -0.25;
    enemy.rightArm.rotation.x = 0.2;
    enemy.leftArm.rotation.z = 0.34;
    enemy.rightArm.rotation.z = -0.34;
    enemy.physMesh.computeWorldMatrix(true);
    enemy.visualRoot.computeWorldMatrix(true);

    releaseBayonetEmbed({ preserveEnemyPose: true });
    enemy.physMesh.isPickable = false;
    enemy.visualRoot.isPickable = false;
    for (const mesh of enemy.visualRoot.getChildMeshes()) {
      mesh.isPickable = false;
    }
    enemy.aggregate.dispose();
    if (enemyIndex >= 0) g.enemies.splice(enemyIndex, 1);
    setTimeout(() => enemy.physMesh.dispose(false, true), 3500);
    finishKill();
    return;
  }

  if (intactKill) {
    const enemyIndex = g.enemies.indexOf(enemy);
    const visualRootWorldPos = enemy.visualRoot.getAbsolutePosition().clone();
    const visualRootWorldRot = enemy.visualRoot.rotation.clone();

    const fallbackIntactCorpse = () => {
      if (wasBurning) {
        for (const mesh of [
          enemy.bodyMesh,
          enemy.headMesh,
          ...enemy.visualRoot.getChildMeshes(),
        ]) {
          const mat = mesh.material;
          if (mat instanceof StandardMaterial) blacken(mat);
        }
      }

      enemy.leftLeg.rotation.z = 0.18;
      enemy.rightLeg.rotation.z = -0.18;
      enemy.leftArm.rotation.z = 0.28;
      enemy.rightArm.rotation.z = -0.28;

      const corpseRoot = MeshBuilder.CreateBox(
        "enemyCorpse",
        { width: 1.1, height: 1.9, depth: 0.5 },
        g.scene,
      );
      corpseRoot.position = bodyWorldPos.clone();
      corpseRoot.isVisible = false;
      corpseRoot.isPickable = false;

      enemy.visualRoot.parent = corpseRoot;
      enemy.visualRoot.position = visualRootWorldPos.subtract(
        corpseRoot.position,
      );
      enemy.visualRoot.rotation = visualRootWorldRot;

      const corpseAgg = new PhysicsAggregate(
        corpseRoot,
        PhysicsShapeType.BOX,
        { mass: ENEMY.mass * 0.35, friction: 0.8, restitution: 0.05 },
        g.scene,
      );
      corpseAgg.body.applyImpulse(
        awayDir.scale(24).addInPlaceFromFloats(0, 1.5, 0),
        headWorldPos,
      );
      corpseAgg.body.setAngularVelocity(
        new Vector3(awayDir.z * 1.5, 0, -awayDir.x * 1.5),
      );

      setTimeout(() => {
        corpseAgg.dispose();
        corpseRoot.dispose(false, true);
      }, 3500);
    };

    enemy.visualRoot.setParent(null);
    enemy.visualRoot.position = visualRootWorldPos;
    enemy.visualRoot.rotation = visualRootWorldRot;
    enemy.aggregate.dispose();
    enemy.physMesh.dispose();
    if (enemyIndex >= 0) g.enemies.splice(enemyIndex, 1);

    try {
      const RAGDOLL_MASK = 0x2;
      const RAGDOLL_COLLIDE_MASK = 0xfffffffd;
      const constraints: PhysicsConstraint[] = [];
      const aggregates: PhysicsAggregate[] = [];
      const colliders: Mesh[] = [];

      const makeColliderPart = (
        name: string,
        visual: Mesh,
        size: { width: number; height: number; depth: number },
        mass: number,
      ): { collider: Mesh; aggregate: PhysicsAggregate; visual: Mesh } => {
        const world = visual.getWorldMatrix().clone();
        const scaling = new Vector3();
        const rotation = new Quaternion();
        const position = new Vector3();
        world.decompose(scaling, rotation, position);

        const collider = MeshBuilder.CreateBox(name, size, g.scene);
        collider.position = position;
        collider.rotationQuaternion = rotation;
        collider.isVisible = false;
        collider.isPickable = false;

        visual.setParent(collider);
        visual.isPickable = false;

        const aggregate = new PhysicsAggregate(
          collider,
          PhysicsShapeType.BOX,
          { mass, friction: 0.85, restitution: 0.02 },
          g.scene,
        );
        aggregate.shape.filterMembershipMask = RAGDOLL_MASK;
        aggregate.shape.filterCollideMask = RAGDOLL_COLLIDE_MASK;
        aggregates.push(aggregate);
        colliders.push(collider);
        return { collider, aggregate, visual };
      };

      const localPivot = (mesh: Mesh, worldPoint: Vector3) =>
        Vector3.TransformCoordinates(
          worldPoint,
          mesh.getWorldMatrix().clone().invert(),
        );

      const makeSocket = (
        parent: { collider: Mesh; aggregate: PhysicsAggregate },
        child: { collider: Mesh; aggregate: PhysicsAggregate },
        worldPivot: Vector3,
      ) => {
        const socket = new BallAndSocketConstraint(
          localPivot(parent.collider, worldPivot),
          localPivot(child.collider, worldPivot),
          Vector3.Right(),
          Vector3.Right(),
          g.scene,
        );
        parent.aggregate.body.addConstraint(child.aggregate.body, socket);
        socket.isCollisionsEnabled = false;
        constraints.push(socket);
      };

      const leftLegVisual = enemy.leftLeg.getChildMeshes()[0] as Mesh;
      const rightLegVisual = enemy.rightLeg.getChildMeshes()[0] as Mesh;
      const leftArmVisual = enemy.leftArm.getChildMeshes()[0] as Mesh;
      const rightArmVisual = enemy.rightArm.getChildMeshes()[0] as Mesh;
      const leftHip = enemy.leftLeg.getAbsolutePosition().clone();
      const rightHip = enemy.rightLeg.getAbsolutePosition().clone();
      const leftShoulder = enemy.leftArm.getAbsolutePosition().clone();
      const rightShoulder = enemy.rightArm.getAbsolutePosition().clone();
      const neck = new Vector3(
        bodyWorldPos.x,
        bodyWorldPos.y + ENEMY_MESH.body.height * 0.5,
        bodyWorldPos.z,
      );

      if (wasBurning) {
        for (const mesh of [
          enemy.bodyMesh,
          enemy.headMesh,
          leftLegVisual,
          rightLegVisual,
          leftArmVisual,
          rightArmVisual,
        ]) {
          const mat = mesh.material;
          if (mat instanceof StandardMaterial) blacken(mat);
        }
      }

      const body = makeColliderPart(
        "enemyRagdollBody",
        enemy.bodyMesh,
        { width: 0.54, height: 0.9, depth: 0.24 },
        7,
      );
      const head = makeColliderPart(
        "enemyRagdollHead",
        enemy.headMesh,
        { width: 0.24, height: 0.32, depth: 0.24 },
        1.4,
      );
      const leftLeg = makeColliderPart(
        "enemyRagdollLeg",
        leftLegVisual,
        { width: 0.14, height: 0.74, depth: 0.14 },
        1.7,
      );
      const rightLeg = makeColliderPart(
        "enemyRagdollLeg",
        rightLegVisual,
        { width: 0.14, height: 0.74, depth: 0.14 },
        1.7,
      );
      const leftArm = makeColliderPart(
        "enemyRagdollArm",
        leftArmVisual,
        { width: 0.1, height: 0.56, depth: 0.1 },
        0.8,
      );
      const rightArm = makeColliderPart(
        "enemyRagdollArm",
        rightArmVisual,
        { width: 0.1, height: 0.56, depth: 0.1 },
        0.8,
      );

      enemy.leftLeg.dispose();
      enemy.rightLeg.dispose();
      enemy.leftArm.dispose();
      enemy.rightArm.dispose();
      enemy.visualRoot.dispose();

      makeSocket(body, head, neck);
      makeSocket(body, leftLeg, leftHip);
      makeSocket(body, rightLeg, rightHip);
      makeSocket(body, leftArm, leftShoulder);
      makeSocket(body, rightArm, rightShoulder);

      body.aggregate.body.applyImpulse(
        awayDir.scale(14).addInPlaceFromFloats(0, 0.8, 0),
        bodyWorldPos,
      );
      body.aggregate.body.setAngularVelocity(
        new Vector3(awayDir.z * 0.7, 0, -awayDir.x * 0.7),
      );

      setTimeout(() => {
        for (const constraint of constraints) constraint.dispose();
        for (const aggregate of aggregates) aggregate.dispose();
        for (const collider of colliders) collider.dispose(false, true);
      }, 3500);
    } catch {
      fallbackIntactCorpse();
    }

    finishKill();
    return;
  }

  const limbs: {
    mesh: Mesh;
    pos: Vector3;
    name: string;
    splitFn: (p: Vector3, m: StandardMaterial) => [Mesh, Mesh];
    makeAgg: (m: Mesh) => PhysicsAggregate;
    mass: number;
  }[] = [];
  for (const pivot of [enemy.leftLeg, enemy.rightLeg]) {
    const box = pivot.getChildMeshes()[0] as Mesh;
    const wPos = box.getAbsolutePosition().clone();
    box.parent = null;
    box.position = wPos;
    pivot.dispose();
    limbs.push({
      mesh: box,
      pos: wPos,
      name: "enemyLeg",
      splitFn: makeLegSplitHalves,
      makeAgg: makeRagdollLegAggregate,
      mass: 2,
    });
  }
  for (const pivot of [enemy.leftArm, enemy.rightArm]) {
    const box = pivot.getChildMeshes()[0] as Mesh;
    const wPos = box.getAbsolutePosition().clone();
    box.parent = null;
    box.position = wPos;
    pivot.dispose();
    limbs.push({
      mesh: box,
      pos: wPos,
      name: "enemyArm",
      splitFn: makeArmSplitHalves,
      makeAgg: makeRagdollArmAggregate,
      mass: 1,
    });
  }

  enemy.bodyMesh.parent = null;
  enemy.bodyMesh.position = bodyWorldPos;
  enemy.headMesh.parent = null;
  enemy.headMesh.position = headWorldPos;
  enemy.visualRoot.dispose();

  // Blacken all parts if burned to death
  if (wasBurning) {
    blacken(enemy.bodyMesh.material as StandardMaterial);
    blacken(enemy.headMesh.material as StandardMaterial);
    for (const l of limbs) blacken(l.mesh.material as StandardMaterial);
  }

  enemy.aggregate.dispose();
  enemy.physMesh.dispose();
  g.enemies.splice(g.enemies.indexOf(enemy), 1);

  const splitPart = (
    mesh: Mesh,
    pos: Vector3,
    splitFn: (p: Vector3, m: StandardMaterial) => [Mesh, Mesh],
    mass: number,
    impulseScale: number,
  ) => {
    const mat = mesh.material as StandardMaterial;
    mesh.dispose();
    const [top, bot] = splitFn(pos, mat);
    const topAgg = makeRagdollHalfAggregate(top, mass);
    topAgg.body.applyImpulse(
      new Vector3(
        awayDir.x * impulseScale,
        impulseScale * 0.8,
        awayDir.z * impulseScale,
      ),
      pos,
    );
    const botAgg = makeRagdollHalfAggregate(bot, mass);
    botAgg.body.applyImpulse(
      new Vector3(
        awayDir.x * impulseScale * 0.6,
        -2,
        awayDir.z * impulseScale * 0.6,
      ),
      pos,
    );
    setTimeout(() => {
      topAgg.dispose();
      top.dispose();
      botAgg.dispose();
      bot.dispose();
    }, 3500);
  };

  const ragdollPiece = (
    mesh: Mesh,
    pos: Vector3,
    makeAgg: (m: Mesh) => PhysicsAggregate,
    impulse: Vector3,
  ) => {
    const agg = makeAgg(mesh);
    agg.body.applyImpulse(impulse, pos);
    setTimeout(() => {
      agg.dispose();
      mesh.dispose();
    }, 3500);
  };

  const killName = killMesh.name;

  if (orbKill) {
    splitPart(enemy.bodyMesh, bodyWorldPos, makeBodySplitHalves, 5, 22);
    splitPart(enemy.headMesh, headWorldPos, makeHeadSplitHalves, 1, 4);
    for (const l of limbs) splitPart(l.mesh, l.pos, l.splitFn, l.mass, 6);
  } else if (isHeadshot) {
    splitPart(enemy.headMesh, headWorldPos, makeHeadSplitHalves, 1, 4);
    ragdollPiece(
      enemy.bodyMesh,
      bodyWorldPos,
      makeRagdollBodyAggregate,
      awayDir.scale(40).addInPlaceFromFloats(0, 5, 0),
    );
    for (const l of limbs)
      ragdollPiece(
        l.mesh,
        l.pos,
        l.makeAgg,
        new Vector3(awayDir.x * 10, 3 + Math.random() * 3, awayDir.z * 10),
      );
  } else if (killName === "enemyArm" || killName === "enemyLeg") {
    for (const l of limbs) {
      if (l.mesh === killMesh) {
        splitPart(l.mesh, l.pos, l.splitFn, l.mass, 6);
      } else {
        ragdollPiece(
          l.mesh,
          l.pos,
          l.makeAgg,
          new Vector3(awayDir.x * 10, 3 + Math.random() * 3, awayDir.z * 10),
        );
      }
    }
    ragdollPiece(
      enemy.bodyMesh,
      bodyWorldPos,
      makeRagdollBodyAggregate,
      awayDir.scale(40).addInPlaceFromFloats(0, 5, 0),
    );
    ragdollPiece(
      enemy.headMesh,
      headWorldPos,
      makeRagdollHeadAggregate,
      new Vector3(
        (Math.random() - 0.5) * 8,
        3 + Math.random() * 4,
        (Math.random() - 0.5) * 8,
      ),
    );
  } else {
    splitPart(enemy.bodyMesh, bodyWorldPos, makeBodySplitHalves, 5, 22);
    ragdollPiece(
      enemy.headMesh,
      headWorldPos,
      makeRagdollHeadAggregate,
      new Vector3(
        (Math.random() - 0.5) * 8,
        3 + Math.random() * 4,
        (Math.random() - 0.5) * 8,
      ),
    );
    for (const l of limbs)
      ragdollPiece(
        l.mesh,
        l.pos,
        l.makeAgg,
        new Vector3(awayDir.x * 10, 3 + Math.random() * 3, awayDir.z * 10),
      );
  }

  finishKill();
}

export function splitRagdoll(
  mesh: Mesh,
  beamDir: Vector3,
  hitPoint?: Vector3,
): void {
  const worldPos = mesh.getAbsolutePosition().clone();
  const mat = mesh.material as StandardMaterial;
  const name = mesh.name;

  if (mesh.physicsBody) mesh.physicsBody.dispose();
  mesh.dispose();

  const awayDir = hitPoint
    ? new Vector3(
        worldPos.x - hitPoint.x,
        0,
        worldPos.z - hitPoint.z,
      ).normalizeToNew()
    : beamDir.normalize();

  let topHalf: Mesh, bottomHalf: Mesh;
  if (name === "enemyHead") {
    [topHalf, bottomHalf] = makeHeadSplitHalves(worldPos, mat);
  } else if (name === "enemyArm") {
    [topHalf, bottomHalf] = makeArmSplitHalves(worldPos, mat);
  } else if (name === "enemyLeg") {
    [topHalf, bottomHalf] = makeLegSplitHalves(worldPos, mat);
  } else {
    [topHalf, bottomHalf] = makeBodySplitHalves(worldPos, mat);
  }

  const topAgg = makeRagdollHalfAggregate(topHalf, 1);
  topAgg.body.applyImpulse(
    new Vector3(awayDir.x * 4, 6 + Math.random() * 3, awayDir.z * 4),
    worldPos,
  );
  const bottomAgg = makeRagdollHalfAggregate(bottomHalf, 1);
  bottomAgg.body.applyImpulse(
    new Vector3(awayDir.x * 2, 1 + Math.random() * 2, awayDir.z * 2),
    worldPos,
  );

  setTimeout(() => {
    topAgg.dispose();
    topHalf.dispose();
    bottomAgg.dispose();
    bottomHalf.dispose();
  }, 3500);

  if (hitPoint)
    spawnHitParticle(hitPoint, new Color4(0.8, 0.0, 0.0, 1), beamDir.negate());

  incrementScore(1, hitPoint);
}

export function hitDebris(
  mesh: Mesh,
  beamDir: Vector3,
  hitPoint?: Vector3,
): void {
  const shrink = 0.75;
  mesh.scaling.scaleInPlace(shrink);

  const body = mesh.physicsBody;
  if (body && hitPoint) {
    const pushForce = beamDir.normalize().scale(12);
    body.applyImpulse(pushForce, hitPoint);
  }

  if (mesh.scaling.x < 0.15) {
    if (mesh.physicsBody) {
      mesh.physicsBody.dispose();
    }
    mesh.dispose();
  }

  incrementScore(1, hitPoint);
}
