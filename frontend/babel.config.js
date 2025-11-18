module.exports = function(api) {
  // Usar cache basado en el entorno para evitar conflictos
  api.cache.using(() => process.env.NODE_ENV);
  
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@utils': './src/utils',
            '@services': './src/services',
            '@store': './src/store',
            '@types': './src/types'
          }
        }
      ]
    ]
  };
};

