/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const { VanillaExtractPlugin } = require('@vanilla-extract/webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const { DefinePlugin, EnvironmentPlugin } = require('webpack')

const commitHash = require('child_process').execSync('git rev-parse HEAD')

const network =
    process.env.DFX_NETWORK ||
    (process.env.NODE_ENV === "production" ? "ic" : "local");
function initCanisterEnv() {
  let localCanisters, prodCanisters;
  try {
    let p = path.resolve(
      "..",
      "..",
      ".dfx",
      "local",
      "canister_ids.json"
    );
    console.log(p)
    localCanisters = require(p);
  } catch (error) {
    console.log(p)
    console.log("No local canister_ids.json found. Continuing production");
  }
  try {
    prodCanisters = require(path.resolve("..","..","canister_ids.json"));
  } catch (error) {
    console.log("No production canister_ids.json found. Continuing with local");
  }

  const canisterConfig = network === "local" ? localCanisters : prodCanisters;

  return Object.entries(canisterConfig).reduce((prev, current) => {
    const [canisterName, canisterDetails] = current;
    prev[canisterName.toUpperCase() + "_CANISTER_ID"] =
      canisterDetails[network];
    return prev;
  }, {});
}
const canisterEnvVariables = initCanisterEnv();

const internetIdentityUrl = network === "local" ? `http://localhost:4943/?canisterId=${canisterEnvVariables["INTERNET_IDENTITY_CANISTER_ID"]}` : `https://identity.ic0.app`

console.log(internetIdentityUrl);

module.exports = {
  devServer: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4943",
        changeOrigin: true,
        pathRewrite: {
          "^/api": "/api",
        },
      },
    },
  },
  babel: {
    plugins: ['@vanilla-extract/babel-plugin'],
  },
  jest: {
    configure(jestConfig) {
      return Object.assign({}, jestConfig, {
        transformIgnorePatterns: ['@uniswap/conedison/format', '@uniswap/conedison/provider'],
        moduleNameMapper: {
          '@uniswap/conedison/format': '@uniswap/conedison/dist/format',
          '@uniswap/conedison/provider': '@uniswap/conedison/dist/provider',
        },
      })
    },
  },
  webpack: {
    plugins: [
      new VanillaExtractPlugin(),
      new DefinePlugin({
        'process.env.REACT_APP_GIT_COMMIT_HASH': JSON.stringify(commitHash.toString()),
      }),
      new EnvironmentPlugin({
        NODE_ENV: "development",
        DFX_NETWORK: "local",
        II_URL: internetIdentityUrl,
        ...canisterEnvVariables,
      }),
    ],
    configure: (webpackConfig) => {
      const instanceOfMiniCssExtractPlugin = webpackConfig.plugins.find(
        (plugin) => plugin instanceof MiniCssExtractPlugin
      )
      if (instanceOfMiniCssExtractPlugin !== undefined) instanceOfMiniCssExtractPlugin.options.ignoreOrder = true

      // We're currently on Webpack 4.x that doesn't support the `exports` field in package.json.
      // See https://github.com/webpack/webpack/issues/9509.
      //
      // In case you need to add more modules, make sure to remap them to the correct path.
      //
      // Map @uniswap/conedison to its dist folder.
      // This is required because conedison uses * to redirect all imports to its dist.
      webpackConfig.resolve.alias['@uniswap/conedison'] = '@uniswap/conedison/dist'

      return webpackConfig
    },
  },
}
