export default function(text: string, pageTitle: string) {
	let infoboxes: string[] = text.match(/{{Infobox.*?\|.*?}}/sgi) || [];

	infoboxes.forEach((infobox: string) => {
		if ((infobox.match(/(?<=\|title\s*=\s*)\S+.+?(?=\||}})/sg) || [''])[0].trim() === pageTitle) {
			let newInfobox = infobox.replace(/\|title\s*=\s*.+?(?=\||}})/sg, '');
			text = text.replace(infobox, newInfobox);
		}
	})

	return text;
}

export let summary = 'removing title parameter';