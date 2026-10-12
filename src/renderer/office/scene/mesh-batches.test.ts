import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Texture
} from 'three'
import { expect, it, vi } from 'vitest'
import {
  createMeshBatches,
  freezeMatrices,
  releaseMeshBatches,
  thawMatrices,
  updateMeshBatches
} from './mesh-batches'

it('instances matching geometry/materials while retaining controller refs and transforms', () => {
  const root = new Group()
  const a = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 'red' }))
  const b = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 'red' }))
  b.position.x = 5
  root.add(a, b)
  const batches = createMeshBatches(root)
  expect(batches).toHaveLength(1)
  expect(batches[0].mesh.count).toBe(2)
  updateMeshBatches(root, batches)
  const matrix = new Matrix4()
  batches[0].mesh.getMatrixAt(1, matrix)
  expect(matrix.elements[12]).toBe(5)
  expect(a.layers.isEnabled(0)).toBe(false)
  b.position.x = 7
  updateMeshBatches(root, batches)
  batches[0].mesh.getMatrixAt(1, matrix)
  expect(matrix.elements[12]).toBe(7)
  releaseMeshBatches(root, batches)
  expect(a.layers.isEnabled(0)).toBe(true)
  expect(root.children).toHaveLength(2)
})

it('preserves parent visibility and flattens authored instances into the same batch', () => {
  const root = new Group()
  const parent = new Group()
  const geometry = new BoxGeometry()
  const material = new MeshStandardMaterial()
  const instances = new InstancedMesh(geometry, material, 2)
  instances.setMatrixAt(0, new Matrix4().makeTranslation(1, 0, 0))
  instances.setMatrixAt(1, new Matrix4().makeTranslation(2, 0, 0))
  parent.add(instances)
  root.add(parent, new Mesh(geometry, material))
  const batches = createMeshBatches(root)
  expect(batches[0].mesh.count).toBe(3)
  parent.visible = false
  updateMeshBatches(root, batches)
  const matrix = new Matrix4()
  batches[0].mesh.getMatrixAt(0, matrix)
  expect(matrix.elements[0]).toBe(0)
  parent.visible = true
  updateMeshBatches(root, batches)
  batches[0].mesh.getMatrixAt(1, matrix)
  expect(matrix.elements[12]).toBe(2)
})

it('keeps transparent effects and invisible picking meshes out of opaque batches', () => {
  const root = new Group()
  root.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial({ transparent: true })))
  root.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial({ visible: false })))
  expect(createMeshBatches(root)).toEqual([])
})

it('does not batch different baked geometry transforms that share primitive parameters', () => {
  const root = new Group()
  const material = new MeshStandardMaterial()
  root.add(new Mesh(new BoxGeometry(1, 2, 3), material))
  root.add(new Mesh(new BoxGeometry(1, 2, 3).rotateZ(Math.PI / 2), material))
  expect(createMeshBatches(root)).toHaveLength(0)
})

it('merges transparent textured meshes that opt into one shared batch, and follows them', () => {
  const root = new Group()
  const shadows = [0, 1, 2].map(() => {
    const shadow = new Mesh(
      new PlaneGeometry(0.9, 0.9),
      new MeshBasicMaterial({ map: new Texture(), transparent: true, depthWrite: false })
    )
    shadow.userData.sharedBatch = 'agent-shadow'
    shadow.renderOrder = -1
    return shadow
  })
  const unmarked = new Mesh(
    new PlaneGeometry(0.9, 0.9),
    new MeshBasicMaterial({ map: new Texture(), transparent: true })
  )
  root.add(...shadows, unmarked)
  const batches = createMeshBatches(root)
  expect(batches).toHaveLength(1)
  expect(batches[0].mesh.count).toBe(3)
  expect(batches[0].mesh.renderOrder).toBe(-1)
  expect(unmarked.layers.isEnabled(0)).toBe(true)
  shadows[2].position.x = 4
  updateMeshBatches(root, batches)
  const matrix = new Matrix4()
  batches[0].mesh.getMatrixAt(2, matrix)
  expect(matrix.elements[12]).toBe(4)
})

it('leaves a textured sign in its own draw without serialising its texture', () => {
  const root = new Group()
  const signs = [0, 1].map(
    () => new Mesh(new PlaneGeometry(2, 1), new MeshBasicMaterial({ map: new Texture() }))
  )
  const serialised = signs.map((sign) => vi.spyOn(sign.material, 'toJSON'))
  root.add(...signs)
  expect(createMeshBatches(root)).toEqual([])
  for (const toJSON of serialised) expect(toJSON).not.toHaveBeenCalled()
})

it('draws parts that differ only in colour together, each in its own colour', () => {
  const root = new Group()
  const box = new BoxGeometry(1, 1, 1)
  const [red, blue, alsoRed] = ['red', 'blue', 'red'].map(
    (color) => new Mesh(box, new MeshStandardMaterial({ color, roughness: 0.8 }))
  )
  root.add(red, blue, alsoRed)
  const batches = createMeshBatches(root)
  expect(batches).toHaveLength(1)
  expect(batches[0].mesh.count).toBe(3)
  const tint = new Color()
  batches[0].mesh.getColorAt(0, tint)
  expect(tint.getHexString()).toBe(new Color('red').getHexString())
  batches[0].mesh.getColorAt(1, tint)
  expect(tint.getHexString()).toBe(new Color('blue').getHexString())
  // The batch draws through its own white copy, so the tint is not applied twice.
  const drawn = batches[0].mesh.material as MeshStandardMaterial
  expect(drawn.color.getHexString()).toBe('ffffff')
  expect(red.material.color.getHexString()).toBe(new Color('red').getHexString())
  const disposed = vi.spyOn(drawn, 'dispose')
  releaseMeshBatches(root, batches)
  expect(disposed).toHaveBeenCalledOnce()
})

it('keeps parts apart when their surface differs by more than colour', () => {
  const root = new Group()
  const box = new BoxGeometry(1, 1, 1)
  root.add(
    new Mesh(box, new MeshStandardMaterial({ color: 'red', roughness: 0.8 })),
    new Mesh(box, new MeshStandardMaterial({ color: 'red', roughness: 0.2 })),
    new Mesh(
      box,
      new MeshStandardMaterial({ color: 'red', emissive: 'red', emissiveIntensity: 0.9 })
    )
  )
  expect(createMeshBatches(root)).toHaveLength(0)
})

it('multiplies a part that already carries a colour per instance by its material colour', () => {
  const root = new Group()
  const box = new BoxGeometry(1, 1, 1)
  const authored = new InstancedMesh(box, new MeshStandardMaterial({ color: '#808080' }), 1)
  authored.setMatrixAt(0, new Matrix4())
  authored.setColorAt(0, new Color(1, 0, 0))
  root.add(authored, new Mesh(box, new MeshStandardMaterial({ color: 'blue' })))
  const batches = createMeshBatches(root)
  expect(batches).toHaveLength(1)
  const tint = new Color()
  batches[0].mesh.getColorAt(0, tint)
  const grey = new Color('#808080')
  expect(tint.r).toBeCloseTo(grey.r)
  expect(tint.g).toBe(0)
})

it('freezes placed parts so no frame recomputes them, and thaws them to be placed again', () => {
  const root = new Group()
  const street = new Group()
  const house = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 'red' }))
  house.position.x = 4
  street.add(house)
  root.add(street)
  root.updateWorldMatrix(true, true)

  freezeMatrices(root)
  expect(house.matrixAutoUpdate).toBe(false)
  expect(street.matrixAutoUpdate).toBe(false)
  house.position.x = 9
  root.updateMatrixWorld()
  expect(house.matrixWorld.elements[12]).toBe(4)

  thawMatrices(root)
  expect(house.matrixAutoUpdate).toBe(true)
  expect(house.matrixWorld.elements[12]).toBe(9)
})
