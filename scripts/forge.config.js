module.exports = {
    makers: [
      {
        name: '@electron-forge/maker-squirrel',
        config: {}
      },
      {
        name: '@electron-forge/maker-zip',
        platforms: ['darwin']
      },
      {
        name: '@electron-forge/maker-deb',
        config: {}
      },
      {
        name: '@electron-forge/maker-rpm',
        config: {}
      }
    ],
    plugins: [
      [
        '@electron-forge/plugin-webpack',
        {
          mainConfig: './electron.vite.config.js',
          renderer: {
            config: './electron.vite.config.js',
            entryPoints: [
              {
                html: './src/index.html',
                js: './src/renderer.js'
              }
            ]
          }
        }
      ]
    ]
  };