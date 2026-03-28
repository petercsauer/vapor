import type { Configuration } from 'webpack';
import * as fs from 'fs';
import * as path from 'path';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

class CopyNodePtyPrebuildsPlugin {
  apply(compiler: any): void {
    compiler.hooks.afterEmit.tap('CopyNodePtyPrebuildsPlugin', () => {
      const outputPath = compiler.options.output?.path;
      if (!outputPath) {
        return;
      }

      const arch = process.arch;
      const moduleRoot = path.resolve(__dirname, 'node_modules', 'node-pty');

      const prebuildSourceDir = path.resolve(moduleRoot, 'prebuilds', `darwin-${arch}`);
      const prebuildTargetDir = path.resolve(outputPath, 'prebuilds', `darwin-${arch}`);
      if (fs.existsSync(prebuildSourceDir)) {
        fs.mkdirSync(prebuildTargetDir, { recursive: true });
        fs.cpSync(prebuildSourceDir, prebuildTargetDir, { recursive: true });
      }

      const releaseSourceDir = path.resolve(moduleRoot, 'build', 'Release');
      const releaseTargetDir = path.resolve(outputPath, 'build', 'Release');
      if (fs.existsSync(releaseSourceDir)) {
        fs.mkdirSync(releaseTargetDir, { recursive: true });
        for (const fileName of ['pty.node', 'spawn-helper']) {
          const src = path.resolve(releaseSourceDir, fileName);
          const dst = path.resolve(releaseTargetDir, fileName);
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dst);
            if (fileName === 'spawn-helper') {
              fs.chmodSync(dst, 0o755);
            }
          }
        }
      }
    });
  }
}

export const mainConfig: Configuration = {
  entry: './src/index.ts',
  module: {
    rules,
  },
  plugins: [...plugins, new CopyNodePtyPrebuildsPlugin()],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
};
