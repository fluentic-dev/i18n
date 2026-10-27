const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// This monorepo also tests newer React on web. Native must use its app's React.
config.resolver.resolveRequest = (context, name, platform) => {
  if (name === 'react' || name.startsWith('react/')) {
    return context.resolveRequest(context, require.resolve(name, { paths: [__dirname] }), platform);
  }
  return context.resolveRequest(context, name, platform);
};
module.exports = config;
