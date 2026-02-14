module.exports = {
  apps: [
    {
      name: 'hmso-listener',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        LISTENER_ID: 'default',
      },
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 5000,
      max_restarts: 50,
      min_uptime: '10s',
    },
  ],
};

// MULTI-LISTENER EXAMPLE (for redundancy):
// Uncomment and configure to run multiple instances:
//
// module.exports = {
//   apps: [
//     {
//       name: 'hmso-personal',
//       script: 'dist/index.js',
//       cwd: __dirname,
//       instances: 1,
//       autorestart: true,
//       watch: false,
//       max_memory_restart: '512M',
//       env: {
//         NODE_ENV: 'production',
//         LISTENER_ID: 'personal',
//       },
//       error_file: 'logs/personal-error.log',
//       out_file: 'logs/personal-out.log',
//       log_date_format: 'YYYY-MM-DD HH:mm:ss',
//       restart_delay: 5000,
//       max_restarts: 50,
//       min_uptime: '10s',
//     },
//     {
//       name: 'hmso-company',
//       script: 'dist/index.js',
//       cwd: __dirname,
//       instances: 1,
//       autorestart: true,
//       watch: false,
//       max_memory_restart: '512M',
//       env: {
//         NODE_ENV: 'production',
//         LISTENER_ID: 'company',
//       },
//       error_file: 'logs/company-error.log',
//       out_file: 'logs/company-out.log',
//       log_date_format: 'YYYY-MM-DD HH:mm:ss',
//       restart_delay: 5000,
//       max_restarts: 50,
//       min_uptime: '10s',
//     },
//   ],
// };
