const bare = (value) => !/^(?:[a-z][a-z\d+.-]*:|\/|\.\/|\.\.\/)/i.test(value)
export function readImportMaps(document, base, graph, context) {
  const maps = []
  for (const element of document.querySelectorAll('script[type="importmap"]')) {
    let value
    try {
      value = JSON.parse(element.textContent)
    } catch (error) {
      throw graph.error('parse', base, context, error.message)
    }
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).some((key) => !['imports', 'scopes'].includes(key))
    )
      throw graph.error('undeclared', base, context, 'Invalid finite import map')
    const table = (entries) => {
      if (!entries || typeof entries !== 'object' || Array.isArray(entries))
        throw graph.error('undeclared', base, context, 'Invalid finite import mapping')
      return Object.entries(entries)
        .map(([key, target]) => {
          if (typeof target !== 'string' || !target || (key.endsWith('/') && !target.endsWith('/')))
            throw graph.error(
              'undeclared',
              key,
              context,
              'Import mapping must name a finite resource URL'
            )
          return [
            bare(key) ? key : graph.resolve(key, base, context),
            graph.resolve(target, base, context),
          ]
        })
        .sort((a, b) => b[0].length - a[0].length)
    }
    const scopes = Object.entries(value.scopes || {})
      .map(([prefix, entries]) => [graph.resolve(prefix, base, context), table(entries)])
      .sort((a, b) => b[0].length - a[0].length)
    maps.push({ imports: table(value.imports || {}), scopes })
    element.remove()
  }
  return (specifier, importer) => {
    const key = bare(specifier) ? specifier : graph.resolve(specifier, importer, context)
    for (const map of maps) {
      const tables = [
        ...map.scopes
          .filter(([prefix]) => importer.startsWith(prefix))
          .map(([, entries]) => entries),
        map.imports,
      ]
      for (const entries of tables) {
        for (const [prefix, target] of entries) {
          if (key === prefix) return target
          if (prefix.endsWith('/') && key.startsWith(prefix))
            return graph.resolve(key.slice(prefix.length), target, context)
        }
      }
    }
    if (bare(specifier))
      throw graph.error(
        'undeclared',
        specifier,
        context,
        'Bare module specifier needs a finite import map'
      )
    return key
  }
}
