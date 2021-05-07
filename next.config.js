module.exports = {
  future: {
    webpack5: true,
  },
  webpack: (config, { isServer, dev, webpack }) => {
    config.output.hotUpdateMainFilename =
      "static/webpack/[fullhash].[runtime].hot-update.json";

    if (!isServer) {
      config.resolve.fallback.fs = false;
    }

    return config;
  },
};
