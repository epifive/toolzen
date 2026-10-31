/**
 * PM2 process file for VPS hosting.
 *   npm run build
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: "toolzen",
      script: "server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "512M",
    },
  ],
};
