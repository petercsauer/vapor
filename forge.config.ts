import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import * as path from 'path';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: "**/{.webpack/main/**,node-pty,node-pty/**,prebuilds,prebuilds/**,spawn-helper,*.node}",
    },
    name: "Vapor",
    icon: path.resolve(__dirname, "assets", "icon"),
    extraResource: [
      path.resolve(__dirname, "assets", "icon.png"),
      path.resolve(__dirname, "bin", "vpr"),
    ],
    osxSign: process.env.APPLE_IDENTITY
      ? {
          identity: process.env.APPLE_IDENTITY,
          identityValidation: true,
          optionsForFile: () => ({
            hardenedRuntime: true,
            entitlements: path.resolve(__dirname, "entitlements.plist"),
            "entitlements-inherit": path.resolve(__dirname, "entitlements.child.plist"),
          }),
        }
      : undefined,
    osxNotarize: process.env.APPLE_ID
      ? {
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_ID_PASSWORD!,
          teamId: process.env.APPLE_TEAM_ID!,
        }
      : undefined,
  },
  rebuildConfig: {},
  makers: [
    new MakerDMG({
      icon: './assets/icon.icns',
      background: './assets/dmg-background.png',
      format: 'ULFO',
      iconSize: 80,
      contents: (opts: { appPath: string }) => [
        { x: 200, y: 260, type: 'file' as const, path: opts.appPath },
        { x: 590, y: 260, type: 'link' as const, path: '/Applications' },
      ],
      additionalDMGOptions: {
        window: {
          size: { width: 768, height: 512 },
        },
      } as any,
    }),
    new MakerZIP({}, ['darwin']),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer/index.tsx',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
            },
          },
        ],
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'petercsauer',
        name: 'vapor',
      },
      prerelease: false,
      draft: false,
    }),
  ],
};

export default config;
