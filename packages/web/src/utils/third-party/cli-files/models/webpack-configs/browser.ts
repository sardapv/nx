/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import { WebpackConfigOptions, BuildOptions } from '../build-options';
import {
  getSourceMapDevTool,
  isPolyfillsEntry,
  normalizeExtraEntryPoints,
} from './utils';

const SubresourceIntegrityPlugin = require('webpack-subresource-integrity');

export function getBrowserConfig(wco: WebpackConfigOptions) {
  const { buildOptions } = wco;
  const extraPlugins = [];

  const { isWebpack5 } = require('../../../../../webpack/entry');

  let isEval = false;
  const { styles: stylesOptimization, scripts: scriptsOptimization } =
    buildOptions.optimization;
  const {
    styles: stylesSourceMap,
    scripts: scriptsSourceMap,
    hidden: hiddenSourceMap,
    vendor: vendorSourceMap,
  } = buildOptions.sourceMap;

  // See https://webpack.js.org/configuration/devtool/ for sourcemap types.
  if (
    (stylesSourceMap || scriptsSourceMap) &&
    buildOptions.evalSourceMap &&
    !stylesOptimization &&
    !scriptsOptimization
  ) {
    // Produce eval sourcemaps for development with serve, which are faster.
    isEval = true;
  }

  if (buildOptions.subresourceIntegrity) {
    extraPlugins.push(
      new SubresourceIntegrityPlugin({
        hashFuncNames: ['sha384'],
      })
    );
  }

  if (buildOptions.extractLicenses) {
    extraPlugins.push(
      new LicenseWebpackPlugin({
        stats: {
          warnings: false,
          errors: false,
        },
        perChunkOutput: false,
        outputFilename: `3rdpartylicenses.txt`,
      })
    );
  }

  if (!isEval && (scriptsSourceMap || stylesSourceMap)) {
    extraPlugins.push(
      getSourceMapDevTool(
        !!scriptsSourceMap,
        !!stylesSourceMap,
        hiddenSourceMap,
        vendorSourceMap
      )
    );
  }

  const globalStylesBundleNames = normalizeExtraEntryPoints(
    buildOptions.styles,
    'styles'
  ).map((style) => style.bundleName);

  return {
    devtool: isEval ? 'eval' : false,
    resolve: {
      mainFields: [
        ...(wco.supportES2015 ? ['es2015'] : []),
        'browser',
        'module',
        'main',
      ],
    },
    output: {
      crossOriginLoading: buildOptions.subresourceIntegrity
        ? 'anonymous'
        : false,
    },
    optimization: {
      runtimeChunk: !!buildOptions.runtimeChunk ? 'single' : false,
      splitChunks: {
        maxAsyncRequests: Infinity,
        cacheGroups: {
          default: !!buildOptions.commonChunk && {
            chunks: 'async',
            minChunks: 2,
            priority: 10,
          },
          common: !!buildOptions.commonChunk && {
            name: 'common',
            chunks: 'async',
            minChunks: 2,
            enforce: true,
            priority: 5,
          },
          ...(isWebpack5
            ? {
                styles: {
                  type: 'css/mini-extract',
                  chunks: 'all',
                },
              }
            : {}),
          vendors: false,
          // TODO(jack): Support both 4 and 5
          vendor: !!buildOptions.vendorChunk && {
            name: 'vendor',
            chunks: isWebpack5 ? (chunk) => chunk.name === 'main' : 'initial',
            enforce: true,
            test: isWebpack5
              ? /[\\/]node_modules[\\/]/
              : (
                  module: { nameForCondition?: Function },
                  chunks: Array<{ name: string }>
                ) => {
                  const moduleName = module.nameForCondition
                    ? module.nameForCondition()
                    : '';

                  return (
                    /[\\/]node_modules[\\/]/.test(moduleName) &&
                    !chunks.some(
                      ({ name }) =>
                        isPolyfillsEntry(name) ||
                        globalStylesBundleNames.includes(name)
                    )
                  );
                },
          },
        },
      },
    },
    plugins: extraPlugins,
    node: false,
  };
}
