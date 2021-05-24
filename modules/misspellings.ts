export default function(text: string) {
	return text
		.replace(/imposter/g, 'impostor')
		.replace(/Imposter/g, 'Impostor')
}

export let summary = 'fixing misspellings';