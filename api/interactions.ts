import "dotenv/config";
import { MiniInteraction } from "@minesa-org/mini-interaction";
import sendCommand from "../src/commands/send.js";
import createCommand from "../src/commands/create.js";
import { createMenuHandler } from "../src/components/create_menu.js";
import { staffRoleMenuHandler } from "../src/components/staff_role_menu.js";

export const mini = new MiniInteraction({
	applicationId: process.env.DISCORD_APPLICATION_ID!,
	publicKey: process.env.DISCORD_APP_PUBLIC_KEY!,
});

mini.useCommand(sendCommand);
mini.useCommand(createCommand);
mini.useComponents([createMenuHandler, staffRoleMenuHandler]);

export default mini.createNodeHandler();
