export async function fetchDiscord(
	endpoint: string,
	token: string,
	isBot: boolean = false,
) {
	const response = await fetch(`https://discord.com/api/v10${endpoint}`, {
		headers: {
			Authorization: isBot ? `Bot ${token}` : `Bearer ${token}`,
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Discord API error: ${response.status} ${error}`);
	}

	return await response.json();
}
