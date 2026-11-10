// Camera projection of chart-space geometry, not a translated 2D silhouette.
function chartProjection(view = {}, frame) {
  const config = { rotX: 15, rotY: 20, depthPercent: 100, hPercent: 100, rAngAx: true, perspective: 30, ...view }
  const pitch = config.rotX * Math.PI / 180, yaw = config.rotY * Math.PI / 180
  const depth = frame.width * config.depthPercent / 100 * 0.25
  const height = frame.height * config.hPercent / 100
  function camera(x, y, z) {
    x -= frame.x + frame.width / 2
    y = (frame.y + frame.height / 2 - y) * height / frame.height
    z -= depth / 2
    const a = x * Math.cos(yaw) + z * Math.sin(yaw)
    if (config.rAngAx) return [x + z * Math.sin(yaw), y - z * Math.sin(pitch), z * Math.cos(pitch) * Math.cos(yaw)]
    const b = -x * Math.sin(yaw) + z * Math.cos(yaw)
    return [a, y * Math.cos(pitch) - b * Math.sin(pitch), y * Math.sin(pitch) + b * Math.cos(pitch)]
  }
  const distance = Math.max(frame.width, height, depth) * (2 + (240 - config.perspective) / 60)
  function raw(x, y, z) {
    const [a, b, c] = camera(x, y, z)
    const scale = config.rAngAx || !config.perspective ? 1 : distance / (distance - c)
    return [a * scale, -b * scale, c]
  }
  const corners = [frame.x, frame.x + frame.width].flatMap(x => [frame.y, frame.y + frame.height].flatMap(y => [0, depth].map(z => raw(x, y, z))))
  const minX = Math.min(...corners.map(p => p[0])), maxX = Math.max(...corners.map(p => p[0]))
  const minY = Math.min(...corners.map(p => p[1])), maxY = Math.max(...corners.map(p => p[1]))
  const scale = Math.min(frame.width / (maxX - minX || 1), frame.height / (maxY - minY || 1))
  const offsetX = frame.x + (frame.width - (maxX - minX) * scale) / 2
  const offsetY = frame.y + (frame.height - (maxY - minY) * scale) / 2
  function point(x, y, z = 0) {
    const p = raw(x, y, z)
    return [offsetX + (p[0] - minX) * scale, offsetY + (p[1] - minY) * scale]
  }
  return { point, camera, depth, config }
}
function cuboid(x, y, z, width, height, depth) {
  return [[x,y,z], [x+width,y,z], [x+width,y+height,z], [x,y+height,z], [x,y,z+depth], [x+width,y,z+depth], [x+width,y+height,z+depth], [x,y+height,z+depth]]
}
const CUBE_FACES = [[0,1,2,3], [4,7,6,5], [0,4,5,1], [3,2,6,7], [0,3,7,4], [1,5,6,2]]
module.exports = { chartProjection, cuboid, CUBE_FACES }
