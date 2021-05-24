export default function(text: string) {
	let selectedText = text.match(/{{Interlanguage\|.+?}}/si);
	if (selectedText) {
		let replacedText = selectedText[0]
			.replace(/(?<!\n)\|/g, '\n|')
			.replace(/(?<!\n)}}/g, '\n}}')
			.replace(/(?<=[\S])=/g, ' =')
			.replace(/=(?=[\S])/g, '= ');
		return text.replace(selectedText[0], replacedText);
	}
	return text;
}

export let summary = 'expanding templates';