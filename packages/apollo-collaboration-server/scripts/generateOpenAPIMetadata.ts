/**
 * Writes `src/openapi-metadata.ts`, which describes the DTO properties and
 * route return types that the OpenAPI generator (`src/openapi.ts`) can't get
 * from decorators alone. It's built from the TypeScript types and JSDoc
 * comments in `src/`.
 *
 * Run as part of `yarn workspace @apollo-annotation/collaboration-server run openapi`
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PluginMetadataGenerator } from '@nestjs/cli/lib/compiler/plugins/plugin-metadata-generator.js'
import { ReadonlyVisitor } from '@nestjs/swagger/plugin'

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const sourceDir = path.join(packageRoot, 'src')

const generator = new PluginMetadataGenerator()
generator.generate({
  visitors: [
    new ReadonlyVisitor({
      classValidatorShim: false,
      esmCompatible: true,
      introspectComments: true,
      pathToSource: sourceDir,
    }),
  ],
  outputDir: sourceDir,
  filename: 'openapi-metadata.ts',
  // Relative to the working directory
  tsconfigPath: path.relative(
    process.cwd(),
    path.join(packageRoot, 'tsconfig.build.json'),
  ),
})
