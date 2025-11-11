require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'backend/server.py',
      interpreter: 'python3',
      env: {
        PYTHONUNBUFFERED: '1',
        REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,
        LANGFUSE_HOST: process.env.LANGFUSE_HOST,
        LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
        LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
        LANGFUSE_INIT_PROJECT_ID: process.env.LANGFUSE_INIT_PROJECT_ID
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'frontend',
      script: 'npm',
      args: 'run dev',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    }
  ]
};
