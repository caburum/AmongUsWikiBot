export default function(text: string) {
	return text.replace(/^(=+)\s*(.*?)\s*(=+)$/gm, '$1 $2 $3')
}

export let summary = 'formatting headings';