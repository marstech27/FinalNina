// PM2 Ecosystem Config — Nina Bot (AWS)
// Run: pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: "nina-bot",
      script: "nina_bot.js",
      interpreter: "node",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
        DATA_DIR: "./data/",
      },
      // Log files
      out_file: "./logs/nina-out.log",
      error_file: "./logs/nina-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
