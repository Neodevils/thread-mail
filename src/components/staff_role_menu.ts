import type { MiniInteractionComponent } from "@minesa-org/mini-interaction";
import { db } from "../utils/database.js";

/**
 * Handler for the staff role selection menu in the /create command setup.
 */
export const staffRoleMenuHandler: MiniInteractionComponent = {
	customId: "create:select_staff_role",
	handler: async (interaction: any) => {
		const user = interaction.user ?? interaction.member?.user;
		const roleId = interaction.data.values[0];

		try {
			// 1. Get the pending guildId for this user
			const userData = await db.get(user.id);
			const guildId = userData?.pendingGuildId as string;

			if (!guildId) {
				return interaction.reply({
					content:
						"❌ Setup failed: No pending guild selection found. Please run `/create` again.",
				});
			}

			// 2. Update the guild settings in DB with the staff role
			await db.update(`guild:${guildId}`, {
				staffRoleId: roleId,
				status: "active",
				updatedAt: Date.now(),
			});

			// 3. Clear the pending guildId from the user
			await db.update(user.id, {
				pendingGuildId: null,
			});

			return interaction.reply({
				content: `✅ Setup complete for this server!\n\n**Staff Role:** <@&${roleId}>\n\nYou can now use \`/send\` in the ticket thread to start managing tickets.`,
			});
		} catch (error) {
			console.error("Error in staff role menu handler:", error);
			return interaction.reply({
				content: "❌ Failed to save staff role. Please try again.",
			});
		}
	},
};
