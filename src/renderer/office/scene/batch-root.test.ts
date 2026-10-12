import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene, Vector3 } from 'three'
import { expect, it } from 'vitest'
import { createBatchRoot, freezeMatrices, thawMatrices, updateMeshBatches } from './mesh-batches'

function sceneWithPart() {
  const scene = new Scene()
  const district = new Group()
  const root = createBatchRoot()
  const part = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial())
  root.add(part)
  district.add(root)
  scene.add(district)
  const worldX = (): number => new Vector3().setFromMatrixPosition(part.matrixWorld).x
  return { scene, district, root, part, worldX }
}

it('is left out of the pass the renderer makes over the scene each frame', () => {
  const { scene, part, worldX } = sceneWithPart()
  part.position.x = 5
  scene.updateMatrixWorld()
  expect(worldX()).toBe(0)
})

it('has its matrices brought up to date by the batch update, parents included', () => {
  const { district, root, part, worldX } = sceneWithPart()
  part.position.x = 5
  district.position.x = 10
  updateMeshBatches(root, [])
  expect(worldX()).toBe(15)
})

it('takes up positions set since a freeze when it is thawed', () => {
  const { scene, root, part, worldX } = sceneWithPart()
  freezeMatrices(root)
  part.position.x = 3
  scene.updateMatrixWorld()
  expect(worldX()).toBe(0)
  thawMatrices(root)
  expect(worldX()).toBe(3)
})
