import { useRef } from 'react'
import geometryCore from 'revealjs-shared/src/pptx-geometry-document.js'
import affine from 'revealjs-shared/src/pptx-affine.js'
import geometrySvg from 'revealjs-shared/src/pptx-geometry-svg.js'
import connectors from 'revealjs-shared/src/pptx-semantic-connectors.js'
import GeometryPointOverlay from './geometry-point-overlay'

export default function GeometryPointHandles({
  element,
  geometry,
  sourceSvg,
  onUpdateElement,
  onPreview,
}) {
  const drag = useRef(null)
  const env = geometryCore.evaluateGeometryGuides(geometry)
  const resolve = (value) => (typeof value === 'number' ? value : (env[value] ?? Number(value)))
  const renderTransform = geometrySvg.geometryRenderTransform(geometry, element)
  const paths = geometry.paths
  const endpoints =
    geometry.connector !== undefined ? connectors.connectorEndpointLocators(geometry) : null
  const points = paths
    .flatMap((path) =>
      path.commands.flatMap((command) =>
        (command.points || []).map((point) => ({
          ...point,
          x: resolve(point.x),
          y: resolve(point.y),
          scale: {
            x: path.width === undefined ? 1 : geometry.width / path.width,
            y: path.height === undefined ? 1 : geometry.height / path.height,
          },
        }))
      )
    )
    .map((point) => ({
      ...point,
      attached:
        geometry.connector !== undefined &&
        ['start', 'end'].some(
          (end) =>
            element.pptxConnectorBindings?.[end] &&
            endpoints?.[end].componentId === point.componentId
        ),
      position: affine.transformPoint(renderTransform, {
        x: point.x * point.scale.x + (point.localOffset?.x ?? 0),
        y: point.y * point.scale.y + (point.localOffset?.y ?? 0),
      }),
    }))
  const pointCommand = (point, delta) => {
    const command = { type: 'control-point', componentId: point.componentId }
    const offset = { x: point.localOffset?.x ?? 0, y: point.localOffset?.y ?? 0 }
    for (const axis of ['x', 'y']) {
      if (delta[axis] === 0) continue
      if (point.scale[axis] === 0) {
        offset[axis] += delta[axis]
        command.localOffset = offset
      } else command[axis] = point[axis] + delta[axis] / point.scale[axis]
    }
    return command
  }
  const submit = (command) =>
    onUpdateElement(element.id, {
      pptxProjectionOperation: {
        type: 'geometry.edit',
        instanceId: element.pptxInstanceId,
        componentId: geometry.componentId,
        command,
      },
    })
  const finish = (commit) => {
    const transaction = drag.current
    if (!transaction) return
    drag.current = null
    onPreview(null)
    if (transaction.target.hasPointerCapture(transaction.pointerId))
      transaction.target.releasePointerCapture(transaction.pointerId)
    if (commit && transaction.changed) submit(transaction.command)
  }
  const move = (event) => {
    const transaction = drag.current
    if (!transaction || transaction.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const delta = affine.transformPoint(transaction.inverse, {
      x: event.clientX - transaction.clientX,
      y: event.clientY - transaction.clientY,
    })
    transaction.command = pointCommand(transaction.point, delta)
    transaction.changed =
      event.clientX !== transaction.clientX || event.clientY !== transaction.clientY
    onPreview(
      transaction.changed
        ? geometryCore.editGeometryDocument(transaction.geometry, transaction.command)
        : null
    )
  }
  return (
    <GeometryPointOverlay sourceSvg={sourceSvg} geometry={geometry} element={element}>
      {points.map((point, index) => {
        const { attached, position } = point
        return (
          <g
            key={point.componentId}
            data-geometry-point={point.componentId}
            transform={`translate(${position.x} ${position.y})`}
          >
            <g data-geometry-chrome="">
              <circle
                r={22}
                fill="transparent"
                role="button"
                tabIndex={attached ? -1 : 0}
                aria-disabled={attached}
                aria-label={`${attached ? 'Attached' : 'Move'} geometry point ${index + 1}`}
                className="cursor-move focus:outline-none focus-visible:stroke-focus"
                style={{ touchAction: 'none', pointerEvents: 'all' }}
                strokeWidth={1}
                onDoubleClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => {
                  if (event.button !== 0 || drag.current) return
                  event.preventDefault()
                  event.stopPropagation()
                  const matrix = sourceSvg.getScreenCTM()
                  if (!matrix) return
                  const screen = [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]
                  const nearest = points.reduce(
                    (closest, candidate, candidateIndex) => {
                      const center = affine.transformPoint(screen, candidate.position)
                      const distance =
                        (center.x - event.clientX) ** 2 + (center.y - event.clientY) ** 2
                      return distance < closest.distance
                        ? { point: candidate, index: candidateIndex, distance }
                        : closest
                    },
                    { point, index, distance: Infinity }
                  )
                  if (nearest.point.attached) return
                  const inverse = affine.multiply(
                    affine.invert(renderTransform),
                    affine.invert(screen)
                  )
                  drag.current = {
                    target: event.currentTarget,
                    pointerId: event.pointerId,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    point: nearest.point,
                    geometry,
                    inverse: [...inverse.slice(0, 4), 0, 0],
                    changed: false,
                  }
                  const focusTarget =
                    event.currentTarget.ownerSVGElement.querySelectorAll('circle[role="button"]')[
                      nearest.index
                    ]
                  focusTarget.focus()
                  event.currentTarget.setPointerCapture(event.pointerId)
                }}
                onPointerMove={move}
                onPointerUp={(event) => {
                  if (drag.current?.pointerId !== event.pointerId) return
                  move(event)
                  finish(true)
                }}
                onPointerCancel={() => finish(false)}
                onLostPointerCapture={() => finish(false)}
                onKeyDown={(event) => {
                  if (attached) {
                    event.stopPropagation()
                    return
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    event.stopPropagation()
                    finish(false)
                    return
                  }
                  if (drag.current) return
                  const axis = {
                    ArrowLeft: ['x', -1],
                    ArrowRight: ['x', 1],
                    ArrowUp: ['y', -1],
                    ArrowDown: ['y', 1],
                  }[event.key]
                  if (!axis) return
                  event.preventDefault()
                  event.stopPropagation()
                  const delta = { x: 0, y: 0 }
                  delta[axis[0]] =
                    (axis[1] * (event.shiftKey ? 10 : 1)) /
                    (axis[0] === 'x' ? renderTransform[0] : renderTransform[3])
                  submit(pointCommand(point, delta))
                }}
              />
              <circle
                r={4}
                fill="var(--bg-secondary)"
                stroke="var(--selection)"
                strokeWidth={1}
                pointerEvents="none"
              />
            </g>
          </g>
        )
      })}
    </GeometryPointOverlay>
  )
}
