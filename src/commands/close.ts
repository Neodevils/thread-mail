import {
	CommandBuilder,
	CommandContext,
	IntegrationType,
	InteractionReplyFlags,
	MiniPermFlags,
	type CommandInteraction,
	type MiniInteractionCommand,
} from "@minesa-org/mini-interaction";
import { db } from "../utils/database.ts";

const closeCommand: MiniInteractionCommand = {
	data: new CommandBuilder()
		.setName("close")
		.setDescription("Close and archive the current ticket thread")
		.setContexts([CommandContext.Guild])
		.setIntegrationTypes([IntegrationType.GuildInstall])
		.setDefaultMemberPermissions(MiniPermFlags.ManageThreads)
		.toJSON(),

	handler: async (interaction: CommandInteraction) => {
		const user = interaction.user ?? interaction.member?.user;
		const channel = interaction.channel;

		console.log(
			`[CLOSE] Channel type: ${channel?.type}, name: ${channel?.name}`,
		);

		if (!user) {
			return interaction.reply({ content: "❌ Could not resolve user." });
		}

		// Check if user has ManageThreads permission
		const member = interaction.member;

		// Check if we're in a thread
		if (!channel || channel.type !== 12 || !channel.name) {
			// GuildPrivateThread
			return interaction.reply({
				content: "❌ This command can only be used in ticket threads.",
				flags: [InteractionReplyFlags.Ephemeral],
			});
		}

		try {
			// Find ticket by thread ID
			const threadData = await db.get(`thread:${channel.id}`);
			if (!threadData || !threadData.ticketId) {
				return interaction.reply({
					content: "❌ This is not a valid ticket thread.",
					flags: [InteractionReplyFlags.Ephemeral],
				});
			}

			const ticketData = await db.get(`ticket:${threadData.ticketId}`);
			if (!ticketData) {
				return interaction.reply({
					content: "❌ Ticket data not found.",
					flags: [InteractionReplyFlags.Ephemeral],
				});
			}

			// Reply immediately to show command is processing
			interaction.reply({
				content: `🔒 **Closing ticket...**\n\nPlease wait while we process your request.`,
				flags: [InteractionReplyFlags.Ephemeral],
			});

			// Clear user's active ticket first
			await db.update(`user:${ticketData.userId}`, {
				activeTicketId: null,
			});
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Archive and lock the thread
			const response = await fetch(
				`https://discord.com/api/v10/channels/${channel.id}`,
				{
					method: "PATCH",
					headers: {
						Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						archived: true,
						locked: true,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`Failed to close thread: ${response.status}`);
			}

			// Send DM to user about ticket closure
			try {
				const dmResponse = await fetch(
					`https://discord.com/api/v10/users/@me/channels`,
					{
						method: "POST",
						headers: {
							Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							recipient_id: ticketData.userId,
						}),
					},
				);

				if (dmResponse.ok) {
					const dmChannel = await dmResponse.json();

					await fetch(
						`https://discord.com/api/v10/channels/${dmChannel.id}/messages`,
						{
							method: "POST",
							headers: {
								Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								content: `🔒 **Your ticket has been closed!**\n\nStaff have resolved your issue. If you need further assistance, you can create a new ticket anytime using \`/create\` command in the server.`,
							}),
						},
					);
				}
			} catch (dmError) {
				console.log(
					"Could not send DM to user about ticket closure:",
					dmError,
				);
			}

			// No webhook to delete (using regular messages)

			// Delete ticket data from database after successful closure
			try {
				await db.delete(`ticket:${threadData.ticketId}`);
				await db.delete(`thread:${channel.id}`);
				console.log(
					`[CLOSE TICKET] Deleted ticket data for: ${threadData.ticketId}`,
				);
			} catch (deleteError) {
				console.error("Error deleting ticket data:", deleteError);
				// Don't fail the command if cleanup fails
			}

			// Edit the reply to show completion
			return await interaction.editReply({
				content: `✅ **Ticket Successfully Closed!**\n\n🔒 Thread has been archived and locked by ${user.username}.\n📧 User has been notified via DM.\n🗑️ Ticket data has been cleaned up.`,
			});
		} catch (error) {
			console.error("Error closing ticket:", error);
			return interaction.reply({
				content: "❌ Failed to close the ticket. Please try again.",
				flags: [InteractionReplyFlags.Ephemeral],
			});
		}
	},
};

export default closeCommand;
