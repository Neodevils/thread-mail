import {
	CommandBuilder,
	CommandContext,
	ContainerBuilder,
	IntegrationType,
	InteractionReplyFlags,
	MiniPermFlags,
	SectionBuilder,
	TextDisplayBuilder,
	type CommandInteraction,
	type MiniInteractionCommand,
} from "@minesa-org/mini-interaction";
import { db } from "../utils/database.ts";
import { fetchDiscord } from "../utils/discord.ts";

/**
 * /send command - Posts the canonical render of a ticket inside a thread.
 */
const sendCommand: MiniInteractionCommand = {
	data: new CommandBuilder()
		.setName("send")
		.setDescription("Send a message to the ticket system")
		.setContexts([
			CommandContext.Guild,
			CommandContext.Bot,
			CommandContext.DM,
		])
		.setIntegrationTypes([
			IntegrationType.GuildInstall,
			IntegrationType.UserInstall,
		])
		.addStringOption((option) =>
			option
				.setName("content")
				.setDescription("The message content")
				.setRequired(true),
		)
		.toJSON(),

	handler: async (interaction: CommandInteraction) => {
		const { options, guild, channel } = interaction;
		const user = interaction.user ?? interaction.member?.user;

		if (!user) {
			return interaction.reply({ content: "❌ Could not resolve user." });
		}

		const content = options.getString("content")!;

		try {
			const isDM = !guild;

			if (isDM) {
				// DM Usage: User sending message to their ticket
				console.log(`[SEND DM] User: ${user.id} (${user.username})`);

				const userData = await db.get(`user:${user.id}`);
				console.log(`[SEND DM] User data:`, userData);

				if (!userData || !userData.activeTicketId) {
					console.log(`[SEND DM] No active ticket found for user`);
					return interaction.reply({
						content:
							"❌ You don't have an active ticket. Use `/create` command in a server first.",
					});
				}

				const ticketData = await db.get(
					`ticket:${userData.activeTicketId}`,
				);
				console.log(`[SEND DM] Ticket data:`, ticketData);

				if (!ticketData || ticketData.status !== "open") {
					console.log(
						`[SEND DM] Ticket not active:`,
						ticketData?.status,
					);
					return interaction.reply({
						content:
							"❌ Your ticket is not active or doesn't exist.",
					});
				}

				// Send message to the ticket thread with container
				const userAvatar = user.avatar
					? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
					: `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png`;

				const container = new ContainerBuilder()
					.addComponent(
						new SectionBuilder()
							.addComponent(
								new TextDisplayBuilder().setContent(
									`**${user.username}:** ${content}\n\n-# Use </send:1453302198086664248> command in DMs to reply`,
								),
							),
					)
					.setAccentColor(0x3498db);

				const response = await fetch(
					`https://discord.com/api/v10/channels/${ticketData.threadId}/messages`,
					{
						method: "POST",
						headers: {
							Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							components: [container.toJSON()],
							flags: ["IsComponentsV2"],
						}),
					},
				);

				if (!response.ok) {
					throw new Error(
						`Failed to send message: ${response.status}`,
					);
				}

				return interaction.reply({
					content: "✅ Message sent to your ticket!",
				});
			} else {
				// Guild Usage: Staff responding to ticket
				console.log(
					`[SEND GUILD] Channel type: ${channel?.type}, name: ${channel?.name}`,
				);

				// Check if we're in a ticket thread
				if (!channel || channel.type !== 12 || !channel.name) {
					console.log(
						`[SEND GUILD] Validation failed - channel: ${!!channel}, type: ${
							channel?.type
						}, name: ${!!channel?.name}`,
					);
					return interaction.reply({
						content:
							"❌ This command can only be used in ticket threads.",
						flags: [InteractionReplyFlags.Ephemeral],
					});
				}

				// Find ticket by thread ID
				const threadData = await db.get(`thread:${channel.id}`);
				if (!threadData || !threadData.ticketId) {
					return interaction.reply({
						content: "❌ This is not a valid ticket thread.",
						flags: [InteractionReplyFlags.Ephemeral],
					});
				}

				const ticketData = await db.get(
					`ticket:${threadData.ticketId}`,
				);
				if (!ticketData || ticketData.status !== "open") {
					return interaction.reply({
						content:
							"❌ This ticket is not active or doesn't exist.",
						flags: [InteractionReplyFlags.Ephemeral],
					});
				}

				// Send DM to user
				try {
					// Create DM channel
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

					if (!dmResponse.ok) {
						throw new Error(
							`Failed to create DM: ${dmResponse.status}`,
						);
					}

					const dmChannel = await dmResponse.json();

					// Send message to DM with staff appearance
					const botUser = await fetchDiscord(
						`/users/@me`,
						process.env.DISCORD_BOT_TOKEN!,
						true,
					);
					const botAvatar = botUser.avatar
						? `https://cdn.discordapp.com/avatars/${botUser.id}/${botUser.avatar}.png`
						: `https://cdn.discordapp.com/embed/avatars/${
								parseInt(botUser.id) % 5
						  }.png`;

					const messageResponse = await fetch(
						`https://discord.com/api/v10/channels/${dmChannel.id}/messages`,
						{
							method: "POST",
							headers: {
								Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								embeds: [
									{
										description: content,
										author: {
											name: "Staff Response",
											icon_url: botAvatar,
										},
										timestamp: new Date().toISOString(),
										color: 0xe74c3c, // Red color for staff messages
									},
								],
							}),
						},
					);

					if (!messageResponse.ok) {
						throw new Error(
							`Failed to send message: ${messageResponse.status}`,
						);
					}

					return interaction.reply({
						content: "✅ Response sent to user via DM!",
						flags: [InteractionReplyFlags.Ephemeral],
					});
				} catch (dmError) {
					console.error("DM Error:", dmError);
					return interaction.reply({
						content:
							"❌ Could not send DM to user. They may have DMs disabled.",
						flags: [InteractionReplyFlags.Ephemeral],
					});
				}
			}
		} catch (error) {
			console.error("Error in /send command:", error);
			return interaction.reply({
				content: "❌ An error occurred while sending the message.",
			});
		}
	},
};

export default sendCommand;
