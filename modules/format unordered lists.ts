export default function(text: string) {
	return text.replace(/^(\*+)([^\s\*].*)$/gm, '$1 $2')
}

export let summary = 'formatting lists';
