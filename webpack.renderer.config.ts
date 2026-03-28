import path from 'path';
import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

const rendererRules = [
  // Filter out asset-relocator-loader from renderer
  ...rules.filter((rule) => {
    if (typeof rule === 'object' && rule.use) {
      const use = Array.isArray(rule.use) ? rule.use : [rule.use];
      return !use.some((u) =>
        typeof u === 'object' &&
        'loader' in u &&
        u.loader === '@vercel/webpack-asset-relocator-loader'
      );
    }
    return true;
  }),
  {
    test: /\.css$/,
    exclude: /node_modules[\\/](monaco-editor|react-mosaic-component)/,
    use: [
      { loader: 'style-loader' },
      { loader: 'css-loader' },
    ],
  },
  {
    test: /\.css$/,
    include: /node_modules[\\/]monaco-editor/,
    use: ['style-loader', 'css-loader'],
  },
  {
    test: /\.css$/,
    include: /node_modules[\\/]react-mosaic-component/,
    use: ['style-loader', 'css-loader'],
  },
  {
    test: /\.ttf$/,
    type: 'asset/resource',
  },
];

const rendererPlugins = [
  ...plugins,
  new MonacoWebpackPlugin({
    languages: [
      'javascript', 'typescript', 'python', 'json', 'html', 'css',
      'markdown', 'yaml', 'go', 'rust', 'cpp', 'java', 'shell',
    ],
    features: [
      'find', 'folding', 'hover', 'suggest', 'bracketMatching',
      'minimap', 'multicursor', 'wordHighlighter', 'contextmenu',
      'clipboard', 'comment', 'indentation', 'linesOperations',
    ],
  }),
];

export const rendererConfig: Configuration = {
  module: {
    rules: rendererRules,
  },
  plugins: rendererPlugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react-dnd': path.resolve(__dirname, 'node_modules/react-dnd'),
      'react-dnd-html5-backend': path.resolve(__dirname, 'node_modules/react-dnd-html5-backend'),
      'react-dnd-touch-backend': path.resolve(__dirname, 'node_modules/react-dnd-touch-backend'),
    },
  },
};
