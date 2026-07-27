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
    },
    {
      // Warframe QQ 机器人。
      //
      // interpreter 显式指向 Node 22：博客跑在系统的 Node 20 上，
      // 而 warframe-worldstate-parser 要求 ^22.18；分开指定可以互不影响。
      //
      // 它连的是 NapCat（Docker，宿主机 127.0.0.1:3011 → 容器 3001）。
      name: 'blog-bot',
      cwd: './packages/wf-bot',
      script: 'node_modules/.bin/koishi',
      args: 'start',
      interpreter: '/opt/node22/bin/node',
      env: { NODE_ENV: 'production' }
    }
  ]
};
