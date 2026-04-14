module.exports = {
  apps: [
    {
      name: 'blog-api',
      cwd: './packages/server',
      script: 'dist/src/main.js',
      env: { PORT: 3001, HOST: '127.0.0.1', NODE_ENV: 'production' }
    },
    {
      name: 'blog-web',
      cwd: './packages/frontend',
      script: 'node_modules/.bin/next',
      args: 'start -H 127.0.0.1',
      env: { PORT: 3000, NODE_ENV: 'production' }
    }
  ]
};
