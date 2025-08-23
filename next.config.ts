import type { NextConfig } from 'next';
import TerserPlugin from 'terser-webpack-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';

const ConfigDefault: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  eslint: {
    dirs: ['src'],
  },
  compiler: {},
  productionBrowserSourceMaps: false,

  webpack(config, { isServer, dev }) {
    if (!dev && !isServer) {
      config.optimization ||= {};
      config.optimization.minimize = true;
      config.optimization.minimizer = [
        ...(config.optimization.minimizer || []),
        new TerserPlugin({
          terserOptions: {
            ecma: 2020,
            module: true,
            toplevel: true,
            compress: {
              passes: 3,
              drop_console: true,
              drop_debugger: true,
              pure_getters: true,
              unsafe: true,
              unsafe_arrows: true,
              unsafe_comps: true,
              unsafe_math: true,
              unsafe_methods: true,
              unsafe_symbols: true,
              hoist_funs: true,
              hoist_vars: true,
              reduce_funcs: true,
              reduce_vars: true,
            },
            mangle: {
              toplevel: true,
              properties: {
                regex: /^_/,
              },
            },
            format: {
              comments: false,
            },
          },
          extractComments: false,
        }),
        new CssMinimizerPlugin(),
      ];
    }

    config.module.rules.push({
      test: /\.svg$/i,
      issuer: { and: [/\.(js|ts|md)x?$/] },
      use: ['@svgr/webpack'],
    });

    return config;
  },
};

export default ConfigDefault;
