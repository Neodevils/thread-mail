import {
	InteractionReplyFlags,
	type StringSelectInteraction,
	type MiniInteractionComponent,
	TextDisplayBuilder,
	ContainerBuilder,
	SectionBuilder,
	ThumbnailBuilder,
} from "@minesa-org/mini-interaction";
import { fetchDiscord } from "../../utils/discord.ts";
import { db } from "../../utils/database.ts";

/**
 * Handler for the server selection menu in the /create command.
 */
export const createMenuHandler: MiniInteractionComponent = {
	customId: "create:select_server",
	handler: async (interaction: StringSelectInteraction) => {
		const guildId = interaction.data.values[0];
		const user = interaction.user ?? interaction.member?.user;

		if (!user) {
			return interaction.reply({
				content: "<:Oops:1453370232277307474> Could not resolve user.",
				flags: [InteractionReplyFlags.Ephemeral],
			});
		}

		try {
			// Check for any existing active ticket (global limit)
			const userData = await db.get(`user:${user.id}`);
			if (userData && userData.activeTicketId) {
				const existingTicket = await db.get(
					`ticket:${userData.activeTicketId}`,
				);
				if (existingTicket && existingTicket.status === "open") {
					return interaction.reply({
						components: [
							new ContainerBuilder()
								.addComponent(
									new TextDisplayBuilder().setContent(
										"## <:Oops:1453370232277307474> You already have an open ticket!",
									),
								)
								.addComponent(
									new TextDisplayBuilder().setContent(
										"Please use </send:1453302198086664248> command in DMs to communicate with staff.",
									),
								)
								.toJSON(),
						],
						flags: [
							InteractionReplyFlags.IsComponentsV2,
							InteractionReplyFlags.Ephemeral,
						],
					});
				}
			}

			// Generate unique ticket ID (still using timestamp for internal use)
			const ticketId = Date.now().toString();

			// Generate sequential case number
			let caseNumber = 1;
			try {
				const counterData: any = await db.get(`counter:${guildId}`);
				if (counterData && counterData.lastCaseNumber) {
					caseNumber = counterData.lastCaseNumber + 1;
				}
				// Update counter immediately
				await db.set(`counter:${guildId}`, {
					lastCaseNumber: caseNumber,
				});
				console.log(
					`[CREATE] Guild ${guildId} case number: ${caseNumber}`,
				);
			} catch (error) {
				console.log("Counter error:", error);
				caseNumber = 1; // Fallback
			}

			// 1. Fetch Guild info to get system_channel_id
			const guild = await fetchDiscord(
				`/guilds/${guildId}`,
				process.env.DISCORD_BOT_TOKEN!,
				true,
			);
			const systemChannelId = guild.system_channel_id;

			if (!systemChannelId) {
				return interaction.reply({
					content:
						"<:Oops:1453370232277307474> This server does not have a system channel configured. Please create a thread manually or tell the server owner to configure a system channel.\n\n-# You may want to forward this message to the server owner to configure a system channel.",
				});
			}

			// 2. Create the thread
			const thread = await fetch(
				`https://discord.com/api/v10/channels/${systemChannelId}/threads`,
				{
					method: "POST",
					headers: {
						Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						name: `#${caseNumber} - ${user.username}`,
						auto_archive_duration: 10080, // 1 week
						type: 12, // Guild Private Thread
					}),
				},
			).then((res) => res.json());

			// 3. Send initial message with ping to notify staff
			try {
				// Check if server has a custom ping role set
				let pingMention = "@here"; // Default fallback
				try {
					const guildData = await db.get(`guild:${guildId}`);
					if (guildData && guildData.pingRoleId) {
						pingMention = `<@&${guildData.pingRoleId}>`;
					}
				} catch (dbError) {
					console.log("Could not fetch guild ping role, using @here:", dbError);
				}

				await fetch(`https://discord.com/api/v10/channels/${thread.id}/messages`, {
					method: "POST",
					headers: {
						Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						content: `${pingMention}\n\n## <:thread_create:1453370244054777917> New Ticket #${caseNumber}\n\n**User:** ${user.username}\n**Status:** Open\n\nPlease assist this user with their inquiry.`,
					}),
				});
			} catch (messageError) {
				console.error("Error sending initial thread message:", messageError);
				// Don't fail the entire operation if the message fails
			}

			// Create webhook for the system channel (if not exists)
			let webhookUrl = null;
			try {
				const webhooks = await fetchDiscord(
					`/channels/${systemChannelId}/webhooks`,
					process.env.DISCORD_BOT_TOKEN!,
					true,
				);
				let existingWebhook = webhooks.find(
					(wh: any) => wh.name === "TicketSystem",
				);

				if (!existingWebhook) {
					// Create webhook using direct fetch
					const webhookResponse = await fetch(
						`https://discord.com/api/v10/channels/${systemChannelId}/webhooks`,
						{
							method: "POST",
							headers: {
								Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								name: "TicketSystem",
							}),
						},
					);

					if (webhookResponse.ok) {
						existingWebhook = await webhookResponse.json();
					}
				}

				webhookUrl = `https://discord.com/api/webhooks/${existingWebhook.id}/${existingWebhook.token}`;
			} catch (webhookError) {
				console.log("Webhook creation error:", webhookError);
			}

			await db.set(`guild:${guildId}`, {
				guildId,
				guildName: guild.name,
				systemChannelId,
				webhookUrl,
				status: "active",
			});

			await db.set(`ticket:${ticketId}`, {
				ticketId,
				caseNumber,
				guildId,
				userId: user.id,
				username: user.username,
				threadId: thread.id,
				status: "open",
			});

			await db.set(`thread:${thread.id}`, {
				ticketId,
			});

			// Store user's active ticket
			await db.set(`user:${user.id}`, {
				activeTicketId: ticketId,
				guildId,
			});

			return interaction.update({
				components: [
					new ContainerBuilder()
						.addComponent(
							new SectionBuilder()
								.addComponent(
									new TextDisplayBuilder().setContent(
										[
											`## <:thread:1453370245212536832> Ticket created in ${guild.name}!`,
											"You can now send messages using </send:1453302198086664248> command in our DMs!",
										].join("\n"),
									),
								)
								.setAccessory(
									new ThumbnailBuilder().setMedia(
										guild.icon
											? {
													url: `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`,
											  }
											: null,
									),
								),
						)
						.toJSON(),
				],
				flags: [InteractionReplyFlags.IsComponentsV2],
			});
		} catch (error) {
			console.error("Error in create menu handler:", error);
			return interaction.reply({
				content:
					"<:Oops:1453370232277307474> Failed to create thread. Check bot permissions in the selected server.",
			});
		}
	},
};

export default createMenuHandler;
