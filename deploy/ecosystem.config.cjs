// PM2 file for the API on the Lightsail instance. Change cwd to the folder where the API code is on the server.
// The settings (MONGODB_URI, JWT_SECRET, ...) are read from the .env file in that folder.
module.exports = {
  apps: [
    {
      name: "solcacao-api",
      script: "dist/server.js",
      cwd: "/home/ubuntu/solcacao-api",
      env: { NODE_ENV: "production" },
    },
  ],
};
