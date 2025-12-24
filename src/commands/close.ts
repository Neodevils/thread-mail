import {
	CommandBuilder,
	CommandContext,
	IntegrationType,
	InteractionReplyFlags,
	MiniPermFlags,
	ContainerBuilder,
	TextDisplayBuilder,
	SectionBuilder,
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
			return interaction.reply({
				content: "<:Oops:1453370232277307474> Could not resolve user.",
				flags: [InteractionReplyFlags.Ephemeral],
			});
		}

		if (!channel || channel.type !== 12 || !channel.name) {
			return interaction.reply({
				content:
					"<:Oops:1453370232277307474> This command can only be used in ticket threads.",
				flags: [InteractionReplyFlags.Ephemeral],
			});
		}

		try {
			// Find ticket by thread ID
			const threadData = await db.get(`thread:${channel.id}`);
			if (!threadData || !threadData.ticketId) {
				return interaction.reply({
					content:
						"<:Oops:1453370232277307474> This is not a valid ticket thread.",
					flags: [InteractionReplyFlags.Ephemeral],
				});
			}

			const ticketData = await db.get(`ticket:${threadData.ticketId}`);
			if (!ticketData) {
				return interaction.reply({
					content:
						"<:Oops:1453370232277307474> Ticket data not found.",
					flags: [InteractionReplyFlags.Ephemeral],
				});
			}

			await interaction.reply({
				content: `<:thread_archive_server:1453370235536281713> **Archived the ticket.**`,
			});

			await db.update(`user:${ticketData.userId}`, {
				activeTicketId: null,
			});

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
								components: [
									new ContainerBuilder()
										.addComponent(
											new TextDisplayBuilder().setContent(
												[
													`## <:thread_archive_user:1453370242381254687> Your ticket has been closed!`,
													"",
													"Staff have resolved your issue. If you need further assistance, you can create a new ticket anytime using </create:1453302198086664249> command in the server.",
												].join("\n"),
											),
										)
										.toJSON(),
								],
								flags: [InteractionReplyFlags.IsComponentsV2],
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

			try {
				await db.delete(`ticket:${threadData.ticketId}`);
				await db.delete(`thread:${channel.id}`);
			} catch (deleteError) {
				console.error("Error deleting ticket data:", deleteError);
			}
		} catch (error) {
			console.error("Error closing ticket:", error);
			return interaction.reply({
				content:
					"<:Oops:1453370232277307474> Failed to close the ticket. Please try again.",
				flags: [InteractionReplyFlags.Ephemeral],
			});
		}
	},
};

export default closeCommand;
