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

const setPingRoleCommand: MiniInteractionCommand = {
	data: new CommandBuilder()
		.setName("set-ping-role")
		.setDescription(
			"Set a role to ping when new ticket threads are created",
		)
		.setContexts([CommandContext.Guild])
		.setIntegrationTypes([IntegrationType.GuildInstall])
		.setDefaultMemberPermissions(MiniPermFlags.ManageGuild)
		.addRoleOption((option) =>
			option
				.setName("role")
				.setDescription("The role to ping when new threads are created")
				.setRequired(true),
		)
		.toJSON(),

	handler: async (interaction: CommandInteraction) => {
		const startTime = Date.now();
		console.log(
			`[DEBUG] set-ping-role command started for guild: ${interaction.guild?.id} at ${startTime}`,
		);

		// First, acknowledge the interaction within 3 seconds
		try {
			const deferStart = Date.now();
			await interaction.deferReply({
				flags: [InteractionReplyFlags.Ephemeral],
			});
			console.log(
				`[DEBUG] deferReply successful in ${Date.now() - deferStart}ms`,
			);
		} catch (deferError) {
			console.error(
				`[DEBUG] deferReply failed after ${Date.now() - startTime}ms:`,
				deferError,
			);
			return;
		}

		const user = interaction.user ?? interaction.member?.user;
		const guild = interaction.guild;
		const roleId = interaction.options.getRole("role")?.id;

		console.log(
			`[DEBUG] Extracted data - user: ${user?.id}, guild: ${guild?.id}, role: ${roleId}`,
		);

		if (!user) {
			return interaction.editReply({
				content: "<:Oops:1453370232277307474> Could not resolve user.",
			});
		}

		if (!guild) {
			return interaction.editReply({
				content:
					"<:Oops:1453370232277307474> This command can only be used in a server.",
			});
		}

		if (!roleId) {
			return interaction.editReply({
				content:
					"<:Oops:1453370232277307474> Please specify a role to ping.",
			});
		}

		try {
			const dbStart = Date.now();
			console.log(
				`[DEBUG] Starting database operations at ${dbStart}ms from start`,
			);

			// Get existing guild data or create new
			let guildData = await db.get(`guild:${guild.id}`);
			console.log(
				`[DEBUG] Retrieved guild data in ${Date.now() - dbStart}ms:`,
				guildData,
			);

			if (!guildData) {
				guildData = {
					guildId: guild.id,
				};
				console.log(`[DEBUG] Created new guild data`);
			}

			// Update with ping role
			guildData.pingRoleId = roleId;
			console.log(`[DEBUG] Updated guild data with role: ${roleId}`);

			// Clean up any timestamp fields that might cause conflicts
			// MiniDatabase automatically handles createdAt/updatedAt timestamps
			const cleanGuildData = { ...guildData };
			delete cleanGuildData.createdAt;
			delete cleanGuildData.updatedAt;

			const saveStart = Date.now();
			console.log(
				`[DEBUG] About to save data at ${saveStart}ms from start:`,
				cleanGuildData,
			);
			await db.set(`guild:${guild.id}`, cleanGuildData);
			console.log(
				`[DEBUG] Database save completed in ${
					Date.now() - saveStart
				}ms - FORCE LOG`,
			);

			console.log(`[DEBUG] About to send success response - FORCE LOG`);
			try {
				const result = await interaction.editReply({
					content: `✅ Successfully set <@&${roleId}> as the role to ping when new ticket threads are created in this server.`,
				});
				console.log(
					`[DEBUG] Success response sent successfully - FORCE LOG`,
				);
				return result;
			} catch (responseError) {
				console.error(
					`[DEBUG] Failed to send success response - FORCE LOG:`,
					responseError,
				);
				// Try followUp instead
				try {
					console.log(`[DEBUG] Trying followUp instead - FORCE LOG`);
					const followUpResult = await interaction.followUp({
						content: `✅ Successfully set <@&${roleId}> as the role to ping when new ticket threads are created in this server.`,
						flags: [InteractionReplyFlags.Ephemeral],
					});
					console.log(`[DEBUG] followUp successful - FORCE LOG`);
					return followUpResult;
				} catch (followUpError) {
					console.error(
						`[DEBUG] followUp also failed - FORCE LOG:`,
						followUpError,
					);
					throw responseError;
				}
			}
		} catch (error) {
			console.error("[DEBUG] Error in set-ping-role:", error);
			console.log(`[DEBUG] About to send error response`);
			try {
				const result = await interaction.editReply({
					content:
						"<:Oops:1453370232277307474> Failed to set ping role. Please try again.",
				});
				console.log(`[DEBUG] Error response sent successfully`);
				return result;
			} catch (responseError) {
				console.error(
					`[DEBUG] Failed to send error response:`,
					responseError,
				);
				throw responseError;
			}
		}
	},
};

export default setPingRoleCommand;
