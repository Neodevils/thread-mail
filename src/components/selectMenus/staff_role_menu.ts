import {
	type MiniInteractionComponent,
	type RoleSelectInteraction,
} from "@minesa-org/mini-interaction";
import { db } from "../../utils/database.ts";

const staffRoleMenu: MiniInteractionComponent = {
	customId: "create:select_staff_role",

	handler: async (interaction: RoleSelectInteraction) => {
		const selectedRoleId = interaction.getRoleValues()[0];
		const user = interaction.user ?? interaction.member?.user;

		if (!selectedRoleId || !user) {
			return interaction.reply({
				content: "❌ No role selected or user not found.",
				ephemeral: true,
			});
		}

		try {
			// Get user's pending guild setup
			const userData = await db.get(user.id);
			const pendingGuildId = userData?.pendingGuildId;

			if (!pendingGuildId) {
				return interaction.reply({
					content: "❌ No pending guild setup found. Please start over with /create.",
					ephemeral: true,
				});
			}

			// Update guild settings with staff role
			await db.update(`guild:${pendingGuildId}`, {
				staffRoleId: selectedRoleId,
				status: "active",
			});

			// Clear user's pending guild
			await db.update(user.id, {
				pendingGuildId: null,
			});

			// Get role info for confirmation
			const guild = await db.get(`guild:${pendingGuildId}`);

			return interaction.reply({
				content: `✅ **Setup Complete!**\n\n**Server:** ${guild.guildName}\n**Staff Role:** <@&${selectedRoleId}>\n**Thread:** <#${guild.threadId}>\n\nUsers can now create tickets using \`/send\` command!`,
				ephemeral: true,
			});

		} catch (error) {
			console.error("Error in staff role menu handler:", error);
			return interaction.reply({
				content: "❌ Failed to complete setup. Please try again.",
				ephemeral: true,
			});
		}
	},
};

export default staffRoleMenu;
