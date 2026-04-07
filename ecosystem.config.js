module.exports = {
  apps: [
    {
      name: 'blog-api',
      cwd: './packages/server',
      script: 'dist/main.js',
      env: { PORT: 3001, NODE_ENV: 'production' }
    },
    {
      name: 'blog-web',
      cwd: './packages/frontend',
      script: 'node_modules/.bin/next',
      args: 'start',
      env: { PORT: 3000, NODE_ENV: 'production' }
    }
  ]
};
