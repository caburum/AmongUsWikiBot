export default function(text: string) {
	return text.replace(/(?<={{)(?!raw:|w:)[a-z](?=.*?(\||}}))/gs, function (c: string) { // do not replace raw: and w: transclusions
		return c.toUpperCase();
	})
}

export let summary = 'capitalizing template names';