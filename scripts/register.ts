import "dotenv/config";
import { mini } from "../api/interactions.js";

await mini.registerCommands(process.env.DISCORD_BOT_TOKEN!);
console.log("Registration complete!");
