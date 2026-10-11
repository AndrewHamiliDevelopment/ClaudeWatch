import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial } from 'three'
import { expect, it } from 'vitest'
import { createMeshBatches, updateMeshBatches, releaseMeshBatches } from './mesh-batches'

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
