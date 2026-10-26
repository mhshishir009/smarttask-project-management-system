
import "reflect-metadata";
import { AppDataSource } from "./infrastructure/database/data-source";

async function startServer(): Promise<void> {
  try {
    // Step 1: Connect to PostgreSQL
    await AppDataSource.initialize();

    console.log("PostgreSQL connected successfully!");

    // Step 2: Load Express app after database connection
    const { default: app } = require("./app");

    // Step 3: Start HTTP Server
    const PORT = Number(process.env.PORT || 5000);

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exitCode = 1;
  }
}

void startServer();
