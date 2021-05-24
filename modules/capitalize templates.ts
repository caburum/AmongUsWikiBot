export default function(text: string) {
	return text.replace(/(?<={{)[a-z](?=.*?(\||}}))/gs, function (c: string) {
		return c.toUpperCase();
	})
}

export let summary = 'capitalizing template names';