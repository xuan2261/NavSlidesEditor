// Synthetic source authority fixture, not native or dashboard qualification.
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { authored, styleLocation, geometryStyleFixture } from './geometry-style-fixture.js'
export function geometryGroupFillFixture() {
  const presentation = { ...geometryProjectionFixture(), pptxSemantic: geometryStyleFixture() }
  const document = presentation.pptxSemantic
  const partUri = 'ppt/slideLayouts/slideLayout1.xml'
  const groupAuthored = (value) => ({ source: styleLocation(partUri, [0, 1]), value })
  document.definitions.group = {
    id: 'group',
    kind: 'group',
    source: { ...styleLocation(partUri, [0]), nativeId: '7' },
    components: [
      {
        id: 'group:group-properties',
        kind: 'property',
        locator: styleLocation(partUri, [0, 1]).componentLocator,
      },
    ],
    content: { extent: { cx: 100, cy: 80 }, geometrySource: { styleId: 'groupProvider' } },
  }
  document.styles.groupProvider = {
    kind: 'geometry-declarations',
    origin: 'source',
    source: styleLocation(partUri, [0]),
    payload: {
      definitionId: 'group',
      paintComponentId: 'group:group-properties',
      properties: {
        fill: groupAuthored({ color: groupAuthored({ kind: 'scheme', value: 'accent1' }) }),
      },
      styleRefs: {},
      transform: groupAuthored({
        off: groupAuthored({ x: groupAuthored(0), y: groupAuthored(0) }),
        ext: groupAuthored({ cx: groupAuthored(100), cy: groupAuthored(80) }),
        chOff: groupAuthored({ x: groupAuthored(0), y: groupAuthored(0) }),
        chExt: groupAuthored({ cx: groupAuthored(200), cy: groupAuthored(40) }),
        rot: groupAuthored(0),
        flipH: groupAuthored(false),
      }),
    },
  }
  document.styles.provider.payload.properties.fill = authored({ group: true })
  for (const [index, instance] of Object.values(document.instances).entries()) {
    const groupId = `g${index + 1}`,
      contextId = `groupContext${index + 1}`
    const leafContext = document.styles[instance.sourceBinding.contextId]
    const {
      geometry: _geometry,
      matrixBindings: _matrix,
      transformDeclarationIds: _transforms,
      ...host
    } = leafContext.payload
    document.styles[contextId] = {
      kind: 'group-fill-context',
      origin: 'source',
      source: styleLocation(partUri, [0]),
      payload: { ...host, definitionId: 'group', declarationIds: ['groupProvider'] },
    }
    document.instances[groupId] = {
      id: groupId,
      slideId: instance.slideId,
      definitionId: 'group',
      parentInstanceId: null,
      localTransform: [0.5, 0, 0, 2, 0, 0],
      paintIndex: 0,
      overrides: {},
      sourceBinding: { contextId },
      relationshipChain: [...instance.relationshipChain],
    }
    instance.parentInstanceId = groupId
  }
  return presentation
}
