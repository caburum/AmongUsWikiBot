export default function(text: string) {
	return text.replace(/^\*+([^\s\*].*)$/gm, '* $1')
}

export let summary = 'formatting lists';